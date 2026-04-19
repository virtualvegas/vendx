-- 1. Add external_reference to finance_income
ALTER TABLE public.finance_income
  ADD COLUMN IF NOT EXISTS external_reference text;

CREATE UNIQUE INDEX IF NOT EXISTS finance_income_vendor_extref_unique
  ON public.finance_income (source, external_reference)
  WHERE external_reference IS NOT NULL AND external_reference != '';

-- 2. Replace strict duplicate-block trigger with informative merge-aware trigger
CREATE OR REPLACE FUNCTION public.prevent_duplicate_manual_income()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  -- Skip auto-imported records (they have reference_type set)
  IF NEW.reference_type IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- If user provided a transaction number, check for exact match by source+number
  IF NEW.external_reference IS NOT NULL AND NEW.external_reference != '' THEN
    SELECT id INTO v_existing_id
    FROM public.finance_income
    WHERE COALESCE(source, '') = COALESCE(NEW.source, '')
      AND external_reference = NEW.external_reference
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'Transaction number "%" already exists for source "%". Existing record ID: %. Edit the existing entry instead.',
        NEW.external_reference, COALESCE(NEW.source, 'unknown'), v_existing_id
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- Soft duplicate guard (60s window) for entries without a transaction number
  SELECT id INTO v_existing_id
  FROM public.finance_income
  WHERE income_date = NEW.income_date
    AND amount = NEW.amount
    AND COALESCE(source, '') = COALESCE(NEW.source, '')
    AND category = NEW.category
    AND reference_type IS NULL
    AND (external_reference IS NULL OR external_reference = '')
    AND created_at > now() - interval '60 seconds'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Possible duplicate income (matching record created within last 60 seconds, ID: %). Wait a moment or add a transaction number to differentiate.', v_existing_id
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_manual_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  -- If user provided a transaction number, check for exact match by vendor+number
  IF NEW.external_reference IS NOT NULL AND NEW.external_reference != '' THEN
    SELECT id INTO v_existing_id
    FROM public.finance_expenses
    WHERE COALESCE(vendor, '') = COALESCE(NEW.vendor, '')
      AND external_reference = NEW.external_reference
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'Transaction number "%" already exists for vendor "%". Existing record ID: %. Edit the existing entry instead.',
        NEW.external_reference, COALESCE(NEW.vendor, 'unknown'), v_existing_id
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- Soft duplicate guard for entries without transaction number
  SELECT id INTO v_existing_id
  FROM public.finance_expenses
  WHERE expense_date = NEW.expense_date
    AND amount = NEW.amount
    AND COALESCE(vendor, '') = COALESCE(NEW.vendor, '')
    AND category = NEW.category
    AND (external_reference IS NULL OR external_reference = '')
    AND created_at > now() - interval '60 seconds'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Possible duplicate expense (matching record created within last 60 seconds, ID: %). Wait or add a transaction number to differentiate.', v_existing_id
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Manual merge helpers (admin can collapse two records into one)
CREATE OR REPLACE FUNCTION public.merge_finance_income(p_keep_id uuid, p_merge_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keep finance_income%ROWTYPE;
  v_merge finance_income%ROWTYPE;
BEGIN
  IF NOT (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_keep FROM finance_income WHERE id = p_keep_id;
  SELECT * INTO v_merge FROM finance_income WHERE id = p_merge_id;

  IF v_keep.id IS NULL OR v_merge.id IS NULL THEN
    RAISE EXCEPTION 'One or both records not found';
  END IF;

  -- Combine: sum amounts, concat notes
  UPDATE finance_income
  SET amount = v_keep.amount + v_merge.amount,
      tax_collected = COALESCE(v_keep.tax_collected, 0) + COALESCE(v_merge.tax_collected, 0),
      notes = TRIM(BOTH E'\n' FROM COALESCE(v_keep.notes, '') || E'\n[merged from ' || p_merge_id::text || ']: ' || COALESCE(v_merge.notes, '')),
      external_reference = COALESCE(v_keep.external_reference, v_merge.external_reference),
      updated_at = now()
  WHERE id = p_keep_id;

  -- Remove related auto-account-txn for merged record, then delete it
  DELETE FROM finance_account_transactions
  WHERE reference_type = 'income' AND reference_id = p_merge_id::text;

  DELETE FROM finance_income WHERE id = p_merge_id;

  RETURN p_keep_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.merge_finance_expense(p_keep_id uuid, p_merge_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keep finance_expenses%ROWTYPE;
  v_merge finance_expenses%ROWTYPE;
BEGIN
  IF NOT (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_keep FROM finance_expenses WHERE id = p_keep_id;
  SELECT * INTO v_merge FROM finance_expenses WHERE id = p_merge_id;

  IF v_keep.id IS NULL OR v_merge.id IS NULL THEN
    RAISE EXCEPTION 'One or both records not found';
  END IF;

  UPDATE finance_expenses
  SET amount = v_keep.amount + v_merge.amount,
      tax_amount = COALESCE(v_keep.tax_amount, 0) + COALESCE(v_merge.tax_amount, 0),
      notes = TRIM(BOTH E'\n' FROM COALESCE(v_keep.notes, '') || E'\n[merged from ' || p_merge_id::text || ']: ' || COALESCE(v_merge.notes, '')),
      external_reference = COALESCE(v_keep.external_reference, v_merge.external_reference),
      updated_at = now()
  WHERE id = p_keep_id;

  DELETE FROM finance_expense_splits WHERE expense_id = p_merge_id;
  DELETE FROM finance_account_transactions
  WHERE reference_type = 'expense' AND reference_id = p_merge_id::text;
  DELETE FROM finance_expenses WHERE id = p_merge_id;

  RETURN p_keep_id;
END;
$$;

-- 4. Backfill: copy provider_transaction_id from synced_transactions into finance_income.external_reference
UPDATE public.finance_income fi
SET external_reference = st.provider_transaction_id
FROM public.synced_transactions st
WHERE fi.reference_type IN ('synced_transaction', 'paypal', 'stripe')
  AND fi.reference_id = st.id::text
  AND fi.external_reference IS NULL;

-- 5. Update import_machine_revenue_to_income to also populate external_reference with the machine txn ID
CREATE OR REPLACE FUNCTION public.import_machine_revenue_to_income(p_from_date date, p_to_date date, p_account_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(imported_count integer, total_amount numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
  v_total numeric := 0;
BEGIN
  IF NOT (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH inserted AS (
    INSERT INTO public.finance_income (
      income_date, source, category, description, amount,
      reference_type, reference_id, external_reference,
      machine_id, location_id,
      deposited_to_account_id, payment_method, created_by
    )
    SELECT
      mt.created_at::date,
      'Machine: ' || COALESCE(vm.name, vm.machine_code, 'Unknown'),
      'machine_revenue',
      COALESCE(mt.item_name, 'Machine sale'),
      mt.amount,
      'machine_transaction',
      mt.id::text,
      mt.id::text,
      mt.machine_id,
      vm.location_id,
      p_account_id,
      'machine',
      auth.uid()
    FROM public.machine_transactions mt
    JOIN public.vendx_machines vm ON vm.id = mt.machine_id
    WHERE mt.created_at::date BETWEEN p_from_date AND p_to_date
      AND mt.amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.finance_income fi
        WHERE fi.reference_type = 'machine_transaction' AND fi.reference_id = mt.id::text
      )
    RETURNING amount
  )
  SELECT COUNT(*)::int, COALESCE(SUM(amount), 0) INTO v_count, v_total FROM inserted;

  RETURN QUERY SELECT v_count, v_total;
END;
$$;