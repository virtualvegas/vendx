CREATE OR REPLACE FUNCTION public.sync_external_income_expense()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stream public.external_income_streams%ROWTYPE;
  v_vendor text;
  v_ext_ref text;
  v_expense_id uuid;
  v_account_id uuid;
BEGIN
  IF COALESCE(NEW.expense_amount, 0) <= 0 THEN
    IF NEW.expense_id IS NOT NULL THEN
      DELETE FROM public.finance_account_transactions
        WHERE reference_type = 'expense' AND reference_id = NEW.expense_id;
      DELETE FROM public.finance_expenses WHERE id = NEW.expense_id;
      NEW.expense_id := NULL;
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO v_stream FROM public.external_income_streams WHERE id = NEW.stream_id;

  v_vendor := NULLIF(TRIM(COALESCE(
    NEW.raw_payload->>'vendor_name',
    NEW.raw_payload->>'venue_name',
    NEW.raw_payload->'metadata'->>'vendor_name',
    NEW.raw_payload->'metadata'->>'venue_name',
    NEW.customer_name,
    v_stream.name
  )), '');
  IF v_vendor IS NULL THEN v_vendor := COALESCE(v_stream.name, 'External'); END IF;

  v_ext_ref := 'ext-' || NEW.id::text;
  v_account_id := COALESCE(v_stream.default_expense_account_id, v_stream.default_account_id);

  IF NEW.expense_id IS NOT NULL THEN
    UPDATE public.finance_expenses
    SET amount = NEW.expense_amount,
        expense_date = NEW.entry_date,
        vendor = v_vendor,
        category = COALESCE(v_stream.default_expense_category, 'cogs'),
        subcategory = NEW.subcategory,
        description = COALESCE('Payout for ' || NEW.source, 'External payout'),
        payment_method = COALESCE(NEW.payment_method, v_stream.default_payment_method),
        paid_from_account_id = v_account_id,
        external_reference = v_ext_ref,
        notes = 'Auto-generated from external income stream "' || v_stream.name || '" entry ' || NEW.external_reference,
        updated_at = now()
    WHERE id = NEW.expense_id;
  ELSE
    INSERT INTO public.finance_expenses (
      expense_date, vendor, category, subcategory, description, amount,
      payment_method, paid_from_account_id, status, external_reference, notes
    ) VALUES (
      NEW.entry_date, v_vendor,
      COALESCE(v_stream.default_expense_category, 'cogs'),
      NEW.subcategory,
      COALESCE('Payout for ' || NEW.source, 'External payout'),
      NEW.expense_amount,
      COALESCE(NEW.payment_method, v_stream.default_payment_method),
      v_account_id,
      'recorded',
      v_ext_ref,
      'Auto-generated from external income stream "' || v_stream.name || '" entry ' || NEW.external_reference
    ) RETURNING id INTO v_expense_id;
    NEW.expense_id := v_expense_id;
  END IF;

  IF v_account_id IS NOT NULL THEN
    DELETE FROM public.finance_account_transactions
      WHERE reference_type = 'expense' AND reference_id = NEW.expense_id;

    INSERT INTO public.finance_account_transactions (
      account_id, amount, direction, category, description,
      reference_type, reference_id, transaction_date
    ) VALUES (
      v_account_id,
      -ABS(NEW.expense_amount),
      'out',
      COALESCE(v_stream.default_expense_category, 'cogs'),
      'Auto payout: ' || v_vendor || ' — ' || COALESCE(NEW.source, 'External'),
      'expense',
      NEW.expense_id,
      COALESCE(NEW.entry_date, CURRENT_DATE)::timestamptz
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_external_income_expense()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.expense_id IS NOT NULL THEN
    DELETE FROM public.finance_account_transactions
      WHERE reference_type = 'expense' AND reference_id = OLD.expense_id;
    DELETE FROM public.finance_expenses WHERE id = OLD.expense_id;
  END IF;
  RETURN OLD;
END;
$function$;

-- Backfill missing 'out' account transactions for existing auto-generated payout expenses
INSERT INTO public.finance_account_transactions (
  account_id, amount, direction, category, description,
  reference_type, reference_id, transaction_date
)
SELECT
  fe.paid_from_account_id,
  -ABS(fe.amount),
  'out',
  fe.category,
  'Auto payout: ' || COALESCE(fe.vendor, 'External') || ' — ' || COALESCE(fe.description, ''),
  'expense',
  fe.id,
  fe.expense_date::timestamptz
FROM public.finance_expenses fe
JOIN public.external_income_entries eie ON eie.expense_id = fe.id
WHERE fe.paid_from_account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.finance_account_transactions fat
    WHERE fat.reference_type = 'expense' AND fat.reference_id = fe.id
  );