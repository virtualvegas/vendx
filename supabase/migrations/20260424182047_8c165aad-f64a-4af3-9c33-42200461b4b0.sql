-- 1. New columns on entries
ALTER TABLE public.external_income_entries
  ADD COLUMN IF NOT EXISTS expense_amount numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fees_total numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expense_id uuid REFERENCES public.finance_expenses(id) ON DELETE SET NULL;

-- 2. Optional default expense category + account on the stream
ALTER TABLE public.external_income_streams
  ADD COLUMN IF NOT EXISTS default_expense_category text DEFAULT 'cogs',
  ADD COLUMN IF NOT EXISTS default_expense_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL;

-- 3. Replace the ingest RPC to accept expense_amount + platform_fees_total
CREATE OR REPLACE FUNCTION public.ingest_external_income(
  p_api_key text,
  p_external_reference text,
  p_entry_date date,
  p_source text,
  p_amount numeric,
  p_description text DEFAULT NULL,
  p_tax_collected numeric DEFAULT 0,
  p_currency text DEFAULT 'USD',
  p_category text DEFAULT NULL,
  p_subcategory text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_customer_email text DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_raw_payload jsonb DEFAULT '{}'::jsonb,
  p_expense_amount numeric DEFAULT 0,
  p_platform_fees_total numeric DEFAULT 0
)
RETURNS TABLE(success boolean, entry_id uuid, message text, duplicate boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream public.external_income_streams%ROWTYPE;
  v_entry_id uuid;
  v_existing_id uuid;
BEGIN
  IF p_api_key IS NULL OR p_external_reference IS NULL OR p_amount IS NULL OR p_source IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Missing required fields'::text, false; RETURN;
  END IF;
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Amount must be positive'::text, false; RETURN;
  END IF;

  SELECT * INTO v_stream FROM public.external_income_streams
  WHERE api_key_hash = public.hash_api_key(p_api_key) AND is_active = true LIMIT 1;

  IF v_stream.id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Invalid or inactive API key'::text, false; RETURN;
  END IF;

  SELECT id INTO v_existing_id FROM public.external_income_entries
  WHERE stream_id = v_stream.id AND external_reference = p_external_reference;
  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT true, v_existing_id, 'Duplicate ignored'::text, true; RETURN;
  END IF;

  INSERT INTO public.external_income_entries (
    stream_id, external_reference, entry_date, source, description, amount, tax_collected,
    currency, category, subcategory, payment_method, customer_email, customer_name, is_taxable,
    raw_payload, status, expense_amount, platform_fees_total
  ) VALUES (
    v_stream.id, p_external_reference, COALESCE(p_entry_date, CURRENT_DATE), p_source, p_description,
    p_amount, COALESCE(p_tax_collected, 0), COALESCE(p_currency, 'USD'),
    COALESCE(p_category, v_stream.default_category), COALESCE(p_subcategory, v_stream.default_subcategory),
    COALESCE(p_payment_method, v_stream.default_payment_method),
    p_customer_email, p_customer_name, v_stream.is_taxable, p_raw_payload, 'received',
    GREATEST(COALESCE(p_expense_amount, 0), 0),
    GREATEST(COALESCE(p_platform_fees_total, 0), 0)
  ) RETURNING id INTO v_entry_id;

  UPDATE public.external_income_streams
  SET total_entries = total_entries + 1, total_amount = total_amount + p_amount,
      last_received_at = now(), updated_at = now()
  WHERE id = v_stream.id;

  RETURN QUERY SELECT true, v_entry_id, 'Income recorded'::text, false;
END;
$$;

-- 4. Trigger: auto-create / sync a matching expense when expense_amount > 0
CREATE OR REPLACE FUNCTION public.sync_external_income_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream public.external_income_streams%ROWTYPE;
  v_vendor text;
  v_ext_ref text;
  v_expense_id uuid;
BEGIN
  IF COALESCE(NEW.expense_amount, 0) <= 0 THEN
    -- If expense was previously created and now zeroed out, remove it
    IF NEW.expense_id IS NOT NULL THEN
      DELETE FROM public.finance_expenses WHERE id = NEW.expense_id;
      NEW.expense_id := NULL;
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO v_stream FROM public.external_income_streams WHERE id = NEW.stream_id;

  -- Try to derive a useful vendor name from raw_payload metadata
  v_vendor := NULLIF(TRIM(COALESCE(
    NEW.raw_payload->>'vendor_name',
    NEW.raw_payload->>'venue_name',
    NEW.raw_payload->'metadata'->>'vendor_name',
    NEW.raw_payload->'metadata'->>'venue_name',
    NEW.customer_name,
    v_stream.name
  )), '');
  IF v_vendor IS NULL THEN v_vendor := COALESCE(v_stream.name, 'External'); END IF;

  -- Stable, idempotent external_reference for the expense — guarantees uniqueness via unique index
  v_ext_ref := 'ext-' || NEW.id::text;

  IF NEW.expense_id IS NOT NULL THEN
    UPDATE public.finance_expenses
    SET amount = NEW.expense_amount,
        expense_date = NEW.entry_date,
        vendor = v_vendor,
        category = COALESCE(v_stream.default_expense_category, 'cogs'),
        subcategory = NEW.subcategory,
        description = COALESCE('Payout for ' || NEW.source, 'External payout'),
        payment_method = COALESCE(NEW.payment_method, v_stream.default_payment_method),
        paid_from_account_id = COALESCE(v_stream.default_expense_account_id, v_stream.default_account_id),
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
      COALESCE(v_stream.default_expense_account_id, v_stream.default_account_id),
      'recorded',
      v_ext_ref,
      'Auto-generated from external income stream "' || v_stream.name || '" entry ' || NEW.external_reference
    ) RETURNING id INTO v_expense_id;
    NEW.expense_id := v_expense_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_external_income_expense ON public.external_income_entries;
CREATE TRIGGER trg_sync_external_income_expense
BEFORE INSERT OR UPDATE OF expense_amount, entry_date, source, payment_method, subcategory
ON public.external_income_entries
FOR EACH ROW
EXECUTE FUNCTION public.sync_external_income_expense();

-- 5. Cleanup expense when the entry is deleted
CREATE OR REPLACE FUNCTION public.cleanup_external_income_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.expense_id IS NOT NULL THEN
    DELETE FROM public.finance_expenses WHERE id = OLD.expense_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_external_income_expense ON public.external_income_entries;
CREATE TRIGGER trg_cleanup_external_income_expense
BEFORE DELETE ON public.external_income_entries
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_external_income_expense();