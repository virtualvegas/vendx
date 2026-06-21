
-- Add payment tracking to custom arcade requests
ALTER TABLE public.vendx_custom_arcade_requests
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_due_date date,
  ADD COLUMN IF NOT EXISTS finance_income_id uuid;

-- Trigger: when a custom arcade request is marked paid, create a finance_income entry
CREATE OR REPLACE FUNCTION public.sync_custom_arcade_income()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_income_id uuid;
BEGIN
  IF NEW.payment_status = 'paid'
     AND COALESCE(NEW.quoted_price, 0) > 0
     AND (OLD.payment_status IS DISTINCT FROM 'paid' OR OLD.quoted_price IS DISTINCT FROM NEW.quoted_price)
     AND NEW.finance_income_id IS NULL
  THEN
    INSERT INTO public.finance_income (
      income_date, source, category, description, amount,
      reference_type, reference_id, external_reference,
      payment_method, status
    ) VALUES (
      COALESCE(NEW.paid_at::date, CURRENT_DATE),
      'Custom Arcade: ' || COALESCE(NEW.full_name, NEW.request_number),
      'store_sales',
      'Custom arcade machine — ' || NEW.request_number,
      NEW.quoted_price,
      'custom_arcade_request',
      NEW.id,
      NEW.request_number,
      'bank',
      'recorded'
    ) RETURNING id INTO v_income_id;
    NEW.finance_income_id := v_income_id;
  END IF;

  -- If un-paid (reversed), remove the finance_income record
  IF NEW.payment_status <> 'paid' AND OLD.payment_status = 'paid' AND OLD.finance_income_id IS NOT NULL THEN
    DELETE FROM public.finance_income WHERE id = OLD.finance_income_id;
    NEW.finance_income_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_custom_arcade_income ON public.vendx_custom_arcade_requests;
CREATE TRIGGER trg_sync_custom_arcade_income
  BEFORE UPDATE ON public.vendx_custom_arcade_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_custom_arcade_income();
