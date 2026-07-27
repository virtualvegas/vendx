
-- 1. External Service invoices: post income based on amount_paid (not just fully paid)
CREATE OR REPLACE FUNCTION public.sync_ext_service_invoice_to_income()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_name text;
  v_existing_id uuid;
BEGIN
  -- Determine the "paid" amount to report as income
  IF COALESCE(NEW.amount_paid, 0) > 0 THEN
    SELECT COALESCE(company_name, contact_name, 'External Client')
      INTO v_client_name
    FROM public.vendx_external_clients WHERE id = NEW.client_id;

    SELECT id INTO v_existing_id FROM public.finance_income
      WHERE reference_type = 'ext_service_invoice' AND reference_id = NEW.id::text
      LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.finance_income
        SET amount = NEW.amount_paid,
            tax_collected = COALESCE(NEW.tax_amount, 0),
            income_date = COALESCE(NEW.paid_at::date, income_date, CURRENT_DATE),
            updated_at = now()
        WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.finance_income (
        income_date, source, category, subcategory, description, amount,
        tax_collected, reference_type, reference_id, external_reference,
        payment_method, created_by
      ) VALUES (
        COALESCE(NEW.paid_at::date, CURRENT_DATE),
        'External Service: ' || COALESCE(v_client_name, 'Client'),
        'service_revenue',
        'external_service',
        'Invoice ' || COALESCE(NEW.invoice_number, NEW.id::text) ||
          CASE WHEN NEW.status <> 'paid' THEN ' (partial)' ELSE '' END,
        NEW.amount_paid,
        COALESCE(NEW.tax_amount, 0),
        'ext_service_invoice',
        NEW.id::text,
        NEW.invoice_number,
        'invoice',
        NEW.created_by
      );
    END IF;
  ELSIF COALESCE(OLD.amount_paid, 0) > 0 AND COALESCE(NEW.amount_paid, 0) = 0 THEN
    -- Payment reversed to zero: remove income entry and any related account posting
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
$function$;

-- Backfill: create income entries for any ext invoices with partial payments that don't have one yet
INSERT INTO public.finance_income (
  income_date, source, category, subcategory, description, amount,
  tax_collected, reference_type, reference_id, external_reference, payment_method, created_by
)
SELECT COALESCE(i.paid_at::date, CURRENT_DATE),
       'External Service: ' || COALESCE(c.company_name, c.contact_name, 'Client'),
       'service_revenue','external_service',
       'Invoice ' || COALESCE(i.invoice_number, i.id::text) ||
         CASE WHEN i.status <> 'paid' THEN ' (partial)' ELSE '' END,
       i.amount_paid, COALESCE(i.tax_amount, 0),
       'ext_service_invoice', i.id::text, i.invoice_number, 'invoice', i.created_by
FROM public.vendx_external_service_invoices i
LEFT JOIN public.vendx_external_clients c ON c.id = i.client_id
WHERE COALESCE(i.amount_paid,0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.finance_income fi
    WHERE fi.reference_type='ext_service_invoice' AND fi.reference_id=i.id::text
  );

-- 2. AR Invoice payments: each payment posts an income entry
CREATE OR REPLACE FUNCTION public.post_ar_invoice_payment_to_income()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv public.finance_ar_invoices%ROWTYPE;
  v_customer text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.amount IS NULL OR NEW.amount <= 0 THEN RETURN NEW; END IF;

    SELECT * INTO v_inv FROM public.finance_ar_invoices WHERE id = NEW.invoice_id;
    v_customer := COALESCE(v_inv.customer_name, v_inv.customer_email, 'Customer');

    INSERT INTO public.finance_income (
      income_date, source, category, subcategory, description, amount,
      reference_type, reference_id, external_reference,
      deposited_to_account_id, payment_method, created_by
    ) VALUES (
      NEW.payment_date,
      'AR Invoice: ' || v_customer,
      'invoice_payment',
      'ar_invoice',
      'Payment on invoice ' || COALESCE(v_inv.invoice_number, v_inv.id::text) ||
        COALESCE(' ref ' || NEW.reference, ''),
      NEW.amount,
      'ar_invoice_payment',
      NEW.id::text,
      COALESCE(NEW.reference, v_inv.invoice_number),
      NEW.deposit_to_account_id,
      COALESCE(NEW.payment_method, 'invoice'),
      NEW.created_by
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.finance_account_transactions
      WHERE reference_type = 'income'
        AND reference_id IN (SELECT id::text FROM public.finance_income
                              WHERE reference_type='ar_invoice_payment' AND reference_id=OLD.id::text);
    DELETE FROM public.finance_income
      WHERE reference_type='ar_invoice_payment' AND reference_id=OLD.id::text;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ar_pmt_to_income ON public.finance_ar_invoice_payments;
CREATE TRIGGER trg_ar_pmt_to_income
  AFTER INSERT OR DELETE ON public.finance_ar_invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.post_ar_invoice_payment_to_income();

-- Backfill AR invoice payments -> income
INSERT INTO public.finance_income (
  income_date, source, category, subcategory, description, amount,
  reference_type, reference_id, external_reference,
  deposited_to_account_id, payment_method, created_by
)
SELECT p.payment_date,
       'AR Invoice: ' || COALESCE(i.customer_name, i.customer_email, 'Customer'),
       'invoice_payment','ar_invoice',
       'Payment on invoice ' || COALESCE(i.invoice_number, i.id::text) ||
         COALESCE(' ref ' || p.reference, ''),
       p.amount,
       'ar_invoice_payment', p.id::text,
       COALESCE(p.reference, i.invoice_number),
       p.deposit_to_account_id,
       COALESCE(p.payment_method,'invoice'),
       p.created_by
FROM public.finance_ar_invoice_payments p
JOIN public.finance_ar_invoices i ON i.id = p.invoice_id
WHERE p.amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.finance_income fi
    WHERE fi.reference_type='ar_invoice_payment' AND fi.reference_id=p.id::text
  );
