
-- Auto-post external service invoices to finance_income when marked paid
CREATE OR REPLACE FUNCTION public.sync_ext_service_invoice_to_income()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name text;
BEGIN
  -- Only act when invoice becomes paid (or amount_paid transitions from 0 to >0 while paid)
  IF NEW.status = 'paid' AND COALESCE(NEW.amount_paid, 0) > 0 THEN
    -- Skip if we already posted this invoice
    IF EXISTS (
      SELECT 1 FROM public.finance_income
      WHERE reference_type = 'ext_service_invoice' AND reference_id = NEW.id::text
    ) THEN
      -- Keep amount in sync if paid amount changed
      UPDATE public.finance_income
        SET amount = NEW.amount_paid,
            updated_at = now()
      WHERE reference_type = 'ext_service_invoice' AND reference_id = NEW.id::text;
      RETURN NEW;
    END IF;

    SELECT COALESCE(company_name, contact_name, 'External Client')
      INTO v_client_name
    FROM public.vendx_external_clients WHERE id = NEW.client_id;

    INSERT INTO public.finance_income (
      income_date, source, category, subcategory, description, amount,
      tax_collected, reference_type, reference_id, external_reference,
      payment_method, created_by
    ) VALUES (
      COALESCE(NEW.paid_at::date, CURRENT_DATE),
      'External Service: ' || COALESCE(v_client_name, 'Client'),
      'service_revenue',
      'external_service',
      'Invoice ' || COALESCE(NEW.invoice_number, NEW.id::text),
      NEW.amount_paid,
      COALESCE(NEW.tax_amount, 0),
      'ext_service_invoice',
      NEW.id::text,
      NEW.invoice_number,
      'invoice',
      NEW.created_by
    );
  ELSIF NEW.status <> 'paid' AND OLD.status = 'paid' THEN
    -- Reversed: remove the income entry
    DELETE FROM public.finance_account_transactions
      WHERE reference_type = 'income'
        AND reference_id IN (SELECT id::text FROM public.finance_income
                              WHERE reference_type = 'ext_service_invoice'
                                AND reference_id = NEW.id::text);
    DELETE FROM public.finance_income
      WHERE reference_type = 'ext_service_invoice' AND reference_id = NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_ext_invoice_income ON public.vendx_external_service_invoices;
CREATE TRIGGER trg_sync_ext_invoice_income
AFTER INSERT OR UPDATE OF status, amount_paid, paid_at
ON public.vendx_external_service_invoices
FOR EACH ROW
EXECUTE FUNCTION public.sync_ext_service_invoice_to_income();

-- Backfill existing paid invoices
INSERT INTO public.finance_income (
  income_date, source, category, subcategory, description, amount, tax_collected,
  reference_type, reference_id, external_reference, payment_method, created_by
)
SELECT
  COALESCE(i.paid_at::date, i.issue_date, CURRENT_DATE),
  'External Service: ' || COALESCE(c.company_name, c.contact_name, 'Client'),
  'service_revenue',
  'external_service',
  'Invoice ' || COALESCE(i.invoice_number, i.id::text),
  i.amount_paid,
  COALESCE(i.tax_amount, 0),
  'ext_service_invoice',
  i.id::text,
  i.invoice_number,
  'invoice',
  i.created_by
FROM public.vendx_external_service_invoices i
LEFT JOIN public.vendx_external_clients c ON c.id = i.client_id
WHERE i.status = 'paid'
  AND i.amount_paid > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.finance_income fi
    WHERE fi.reference_type = 'ext_service_invoice' AND fi.reference_id = i.id::text
  );
