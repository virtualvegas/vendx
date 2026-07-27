ALTER TABLE public.vendx_external_service_invoices ADD COLUMN IF NOT EXISTS paypal_invoice_url TEXT;
ALTER TABLE public.finance_ar_invoices ADD COLUMN IF NOT EXISTS paypal_invoice_url TEXT;