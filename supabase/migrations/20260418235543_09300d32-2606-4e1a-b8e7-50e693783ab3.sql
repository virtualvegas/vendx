-- 1. Synced transactions: hard dedup on provider + provider_transaction_id
-- (Already used by upsert in sync function but enforce at DB level)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'synced_transactions_provider_txn_unique'
  ) THEN
    -- Remove any existing duplicates first (keep oldest)
    DELETE FROM public.synced_transactions a
    USING public.synced_transactions b
    WHERE a.id > b.id
      AND a.provider = b.provider
      AND a.provider_transaction_id = b.provider_transaction_id;

    ALTER TABLE public.synced_transactions
      ADD CONSTRAINT synced_transactions_provider_txn_unique
      UNIQUE (provider, provider_transaction_id);
  END IF;
END $$;

-- 2. Finance income: dedup on reference (machine transactions, external imports)
CREATE UNIQUE INDEX IF NOT EXISTS finance_income_reference_unique
  ON public.finance_income (reference_type, reference_id)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

-- 3. Expenses: external reference dedup (invoice/receipt numbers)
ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS external_reference text;

CREATE UNIQUE INDEX IF NOT EXISTS finance_expenses_external_ref_unique
  ON public.finance_expenses (vendor, external_reference)
  WHERE external_reference IS NOT NULL AND external_reference != '';

-- 4. Account transactions: prevent duplicate auto-posts from same source
CREATE UNIQUE INDEX IF NOT EXISTS finance_account_txn_reference_unique
  ON public.finance_account_transactions (reference_type, reference_id, direction, account_id)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

-- 5. Soft duplicate guard for manual entries (60-second window)
CREATE OR REPLACE FUNCTION public.prevent_duplicate_manual_income()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  -- Only check manual entries (no reference_type means user-entered)
  IF NEW.reference_type IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing_id
  FROM public.finance_income
  WHERE income_date = NEW.income_date
    AND amount = NEW.amount
    AND COALESCE(source, '') = COALESCE(NEW.source, '')
    AND category = NEW.category
    AND reference_type IS NULL
    AND created_at > now() - interval '60 seconds'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate income entry detected (matching record created within last 60 seconds). If intentional, wait a moment and retry.'
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_income_trigger ON public.finance_income;
CREATE TRIGGER prevent_duplicate_income_trigger
  BEFORE INSERT ON public.finance_income
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_manual_income();

CREATE OR REPLACE FUNCTION public.prevent_duplicate_manual_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id
  FROM public.finance_expenses
  WHERE expense_date = NEW.expense_date
    AND amount = NEW.amount
    AND COALESCE(vendor, '') = COALESCE(NEW.vendor, '')
    AND category = NEW.category
    AND created_at > now() - interval '60 seconds'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate expense entry detected (matching record created within last 60 seconds). If intentional, wait a moment and retry.'
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_expense_trigger ON public.finance_expenses;
CREATE TRIGGER prevent_duplicate_expense_trigger
  BEFORE INSERT ON public.finance_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_manual_expense();

-- 6. Cleanup helper: dedupe existing income records with same machine transaction reference
DELETE FROM public.finance_income a
USING public.finance_income b
WHERE a.id > b.id
  AND a.reference_type = b.reference_type
  AND a.reference_id = b.reference_id
  AND a.reference_type IS NOT NULL
  AND a.reference_id IS NOT NULL;

-- 7. Cleanup helper: dedupe existing account transactions from same source
DELETE FROM public.finance_account_transactions a
USING public.finance_account_transactions b
WHERE a.id > b.id
  AND a.reference_type = b.reference_type
  AND a.reference_id = b.reference_id
  AND a.direction = b.direction
  AND a.account_id = b.account_id
  AND a.reference_type IS NOT NULL
  AND a.reference_id IS NOT NULL;