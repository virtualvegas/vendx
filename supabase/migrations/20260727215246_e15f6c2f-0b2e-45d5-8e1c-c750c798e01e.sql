ALTER TABLE public.finance_income
  ADD COLUMN IF NOT EXISTS ar_invoice_id uuid REFERENCES public.finance_ar_invoices(id) ON DELETE SET NULL;

ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS ap_bill_id uuid REFERENCES public.finance_ap_bills(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_income_ar_invoice_id ON public.finance_income(ar_invoice_id);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_ap_bill_id ON public.finance_expenses(ap_bill_id);