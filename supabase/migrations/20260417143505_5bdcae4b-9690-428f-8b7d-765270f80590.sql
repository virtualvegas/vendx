
-- ============================================================
-- FINANCE ACCOUNTS (bank, cash vault, tax savings, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('cash_vault','bank_checking','bank_savings','tax_savings','credit_card','other')),
  description TEXT,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  institution TEXT,
  account_number_last4 TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles manage accounts"
ON public.finance_accounts
FOR ALL
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'))
WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'));

CREATE TRIGGER trg_finance_accounts_updated
BEFORE UPDATE ON public.finance_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ACCOUNT TRANSACTIONS (every credit/debit)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_account_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.finance_accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL,           -- positive = credit/in, negative = debit/out
  direction TEXT NOT NULL CHECK (direction IN ('in','out','transfer')),
  category TEXT,                            -- e.g. revenue, expense, transfer, tax_setaside, inventory
  description TEXT,
  reference_type TEXT,                      -- expense, subscription, transfer, manual, sync, reinvestment
  reference_id UUID,
  related_account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL, -- for transfers
  created_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fat_account ON public.finance_account_transactions(account_id, transaction_date DESC);

ALTER TABLE public.finance_account_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles manage account txns"
ON public.finance_account_transactions
FOR ALL
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'))
WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'));

-- ============================================================
-- EXPENSES (advanced, with receipt + status)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor TEXT,
  category TEXT NOT NULL,                          -- inventory, rent, fuel, software, utilities, repair, other
  subcategory TEXT,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL,
  tax_amount NUMERIC(14,2) DEFAULT 0,
  is_tax_deductible BOOLEAN NOT NULL DEFAULT true,
  is_inventory_reinvestment BOOLEAN NOT NULL DEFAULT false,
  payment_method TEXT,                              -- cash, bank, credit_card, check
  paid_from_account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  receipt_url TEXT,
  receipt_filename TEXT,
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('draft','recorded','reconciled','disputed','void')),
  notes TEXT,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fexp_date ON public.finance_expenses(expense_date DESC);
CREATE INDEX idx_fexp_category ON public.finance_expenses(category);

ALTER TABLE public.finance_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles manage expenses"
ON public.finance_expenses
FOR ALL
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'))
WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'));

CREATE TRIGGER trg_finance_expenses_updated
BEFORE UPDATE ON public.finance_expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- EXPENSE SPLITS (allocate one expense across machines/locations)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.finance_expenses(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES public.vendx_machines(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  category TEXT,                                    -- override category for this split
  allocation_type TEXT NOT NULL DEFAULT 'amount' CHECK (allocation_type IN ('amount','percent')),
  allocation_value NUMERIC(14,4) NOT NULL,          -- $ or % depending on type
  allocated_amount NUMERIC(14,2) NOT NULL,          -- computed $ amount
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fes_expense ON public.finance_expense_splits(expense_id);

ALTER TABLE public.finance_expense_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles manage expense splits"
ON public.finance_expense_splits
FOR ALL
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'))
WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'));

-- ============================================================
-- BUSINESS SUBSCRIPTIONS (software, services, recurring bills)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  service_name TEXT,
  category TEXT,                                    -- software, hosting, insurance, utility, lease
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('weekly','monthly','quarterly','yearly','custom')),
  custom_interval_days INTEGER,
  billing_day INTEGER,                              -- day of month (for monthly) or month (1-12) for yearly
  next_due_date DATE NOT NULL,
  last_paid_date DATE,
  auto_pay BOOLEAN NOT NULL DEFAULT false,
  paid_from_account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  is_tax_deductible BOOLEAN NOT NULL DEFAULT true,
  reminder_days_before INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  cancellation_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fsub_due ON public.finance_subscriptions(next_due_date) WHERE status = 'active';

ALTER TABLE public.finance_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles manage subscriptions"
ON public.finance_subscriptions
FOR ALL
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'))
WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'));

CREATE TRIGGER trg_finance_subscriptions_updated
BEFORE UPDATE ON public.finance_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- SUBSCRIPTION PAYMENT HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.finance_subscriptions(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL,
  paid_from_account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES public.finance_expenses(id) ON DELETE SET NULL,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fsp_sub ON public.finance_subscription_payments(subscription_id, payment_date DESC);

ALTER TABLE public.finance_subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles manage sub payments"
ON public.finance_subscription_payments
FOR ALL
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'))
WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'));

-- ============================================================
-- TAX SETTINGS (per-period setaside %, sales tax rate)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_tax_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setaside_percent NUMERIC(5,2) NOT NULL DEFAULT 25.00,    -- % of revenue to set aside for income tax
  sales_tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  fiscal_year_start_month INTEGER NOT NULL DEFAULT 1,
  tax_savings_account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  notes TEXT,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_tax_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles manage tax settings"
ON public.finance_tax_settings
FOR ALL
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'))
WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'));

CREATE TRIGGER trg_finance_tax_settings_updated
BEFORE UPDATE ON public.finance_tax_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- INVENTORY REINVESTMENT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_inventory_reinvestments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reinvestment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL,
  source_account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES public.finance_expenses(id) ON DELETE SET NULL,
  description TEXT,
  units_purchased INTEGER,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_inventory_reinvestments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles manage reinvestments"
ON public.finance_inventory_reinvestments
FOR ALL
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'))
WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'));

-- ============================================================
-- STORAGE BUCKET for receipts (PRIVATE)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('finance-receipts', 'finance-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Only finance roles can read/write receipts
CREATE POLICY "Finance roles can view receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'finance-receipts' AND
  (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'))
);

CREATE POLICY "Finance roles can upload receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'finance-receipts' AND
  (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'))
);

CREATE POLICY "Finance roles can update receipts"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'finance-receipts' AND
  (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'))
);

CREATE POLICY "Finance roles can delete receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'finance-receipts' AND
  (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'))
);

-- ============================================================
-- HELPER: auto-update account balance from txns
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_finance_txn_to_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.finance_accounts
    SET current_balance = current_balance + NEW.amount, updated_at = now()
    WHERE id = NEW.account_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.finance_accounts
    SET current_balance = current_balance - OLD.amount, updated_at = now()
    WHERE id = OLD.account_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_apply_finance_txn
AFTER INSERT OR DELETE ON public.finance_account_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_finance_txn_to_account();
