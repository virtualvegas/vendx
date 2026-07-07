
CREATE TABLE public.vendx_franchise_catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL CHECK (item_type IN ('machine','product','part','accessory')),
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER,
  image_url TEXT,
  min_order_quantity INTEGER DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vendx_franchise_catalog_items TO authenticated;
GRANT ALL ON public.vendx_franchise_catalog_items TO service_role;
ALTER TABLE public.vendx_franchise_catalog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active catalog visible" ON public.vendx_franchise_catalog_items
  FOR SELECT TO authenticated USING (is_active OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'global_operations_manager'));
CREATE POLICY "Admins manage catalog" ON public.vendx_franchise_catalog_items
  FOR ALL TO authenticated USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'global_operations_manager'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'global_operations_manager'));
CREATE TRIGGER trg_fci_updated BEFORE UPDATE ON public.vendx_franchise_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vendx_franchise_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES public.vendx_franchises(id) ON DELETE CASCADE,
  catalog_item_id UUID NOT NULL REFERENCES public.vendx_franchise_catalog_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (franchise_id, catalog_item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_franchise_cart_items TO authenticated;
GRANT ALL ON public.vendx_franchise_cart_items TO service_role;
ALTER TABLE public.vendx_franchise_cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Franchisee manages cart" ON public.vendx_franchise_cart_items
  FOR ALL TO authenticated
  USING (franchise_id = public.get_my_franchise_id() OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (franchise_id = public.get_my_franchise_id() OR has_role(auth.uid(),'super_admin'));

ALTER TABLE public.vendx_franchise_orders
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_address JSONB,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS carrier TEXT;

CREATE TABLE public.vendx_franchise_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES public.vendx_franchises(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('franchise_agreement','w9','operating_manual','other')),
  title TEXT NOT NULL,
  content_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','declined','expired')),
  signature_name TEXT,
  signature_ip TEXT,
  signed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.vendx_franchise_documents TO authenticated;
GRANT ALL ON public.vendx_franchise_documents TO service_role;
ALTER TABLE public.vendx_franchise_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Franchisee sees own docs" ON public.vendx_franchise_documents FOR SELECT TO authenticated
  USING (franchise_id = public.get_my_franchise_id() OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'global_operations_manager'));
CREATE POLICY "Franchisee signs own docs" ON public.vendx_franchise_documents FOR UPDATE TO authenticated
  USING (franchise_id = public.get_my_franchise_id())
  WITH CHECK (franchise_id = public.get_my_franchise_id());
CREATE POLICY "Admins manage docs" ON public.vendx_franchise_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'global_operations_manager'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'global_operations_manager'));
CREATE TRIGGER trg_fdocs_updated BEFORE UPDATE ON public.vendx_franchise_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vendx_franchise_setup_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES public.vendx_franchises(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','failed')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.vendx_franchise_setup_payments TO authenticated;
GRANT ALL ON public.vendx_franchise_setup_payments TO service_role;
ALTER TABLE public.vendx_franchise_setup_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Franchisee sees own setup pmt" ON public.vendx_franchise_setup_payments FOR SELECT TO authenticated
  USING (franchise_id = public.get_my_franchise_id() OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));
CREATE POLICY "Admins manage setup pmts" ON public.vendx_franchise_setup_payments FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

CREATE TABLE public.vendx_franchise_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES public.vendx_franchises(id) ON DELETE CASCADE,
  ticket_number TEXT UNIQUE,
  subject TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting','resolved','closed')),
  assigned_to UUID REFERENCES auth.users(id),
  sla_due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.vendx_franchise_support_tickets TO authenticated;
GRANT ALL ON public.vendx_franchise_support_tickets TO service_role;
ALTER TABLE public.vendx_franchise_support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Franchisee views own tickets" ON public.vendx_franchise_support_tickets FOR SELECT TO authenticated
  USING (franchise_id = public.get_my_franchise_id() OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'global_operations_manager') OR has_role(auth.uid(),'support') OR has_role(auth.uid(),'tech_support_lead'));
CREATE POLICY "Franchisee creates own tickets" ON public.vendx_franchise_support_tickets FOR INSERT TO authenticated
  WITH CHECK (franchise_id = public.get_my_franchise_id());
CREATE POLICY "Staff updates tickets" ON public.vendx_franchise_support_tickets FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'global_operations_manager') OR has_role(auth.uid(),'support') OR has_role(auth.uid(),'tech_support_lead') OR franchise_id = public.get_my_franchise_id())
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'global_operations_manager') OR has_role(auth.uid(),'support') OR has_role(auth.uid(),'tech_support_lead') OR franchise_id = public.get_my_franchise_id());
CREATE TRIGGER trg_ftickets_updated BEFORE UPDATE ON public.vendx_franchise_support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_franchise_ticket_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := 'FRT-' || TO_CHAR(now(),'YYYYMMDD') || '-' || LPAD(FLOOR(random()*10000)::TEXT,4,'0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_fticket_num BEFORE INSERT ON public.vendx_franchise_support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.generate_franchise_ticket_number();

CREATE TABLE public.vendx_franchise_support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.vendx_franchise_support_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('franchisee','staff','system')),
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.vendx_franchise_support_messages TO authenticated;
GRANT ALL ON public.vendx_franchise_support_messages TO service_role;
ALTER TABLE public.vendx_franchise_support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Message visible on ticket you can see" ON public.vendx_franchise_support_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendx_franchise_support_tickets t WHERE t.id = ticket_id
    AND (t.franchise_id = public.get_my_franchise_id() OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'global_operations_manager') OR has_role(auth.uid(),'support') OR has_role(auth.uid(),'tech_support_lead'))));
CREATE POLICY "Reply on ticket you can see" ON public.vendx_franchise_support_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendx_franchise_support_tickets t WHERE t.id = ticket_id
    AND (t.franchise_id = public.get_my_franchise_id() OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'global_operations_manager') OR has_role(auth.uid(),'support') OR has_role(auth.uid(),'tech_support_lead'))));

CREATE OR REPLACE FUNCTION public.calculate_franchise_period_revenue(
  p_franchise_id UUID, p_start DATE, p_end DATE
) RETURNS TABLE(
  machine_sales NUMERIC, arcade_sales NUMERIC, pos_sales NUMERIC,
  total_gross NUMERIC, commission_amount NUMERIC, net_payout NUMERIC,
  txn_count INTEGER
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$
DECLARE
  v_pct NUMERIC;
  v_machine_ids UUID[];
  v_machine NUMERIC := 0; v_arcade NUMERIC := 0; v_pos NUMERIC := 0;
  v_gross NUMERIC; v_comm NUMERIC; v_net NUMERIC; v_count INTEGER := 0;
BEGIN
  SELECT commission_pct INTO v_pct FROM public.vendx_franchises WHERE id = p_franchise_id;
  IF v_pct IS NULL THEN v_pct := 10; END IF;

  SELECT array_agg(machine_id) INTO v_machine_ids
  FROM public.vendx_franchise_machines WHERE franchise_id = p_franchise_id;

  IF v_machine_ids IS NOT NULL AND array_length(v_machine_ids,1) > 0 THEN
    SELECT COALESCE(SUM(amount),0), COUNT(*) INTO v_machine, v_count
    FROM public.machine_transactions
    WHERE machine_id = ANY(v_machine_ids) AND amount > 0
      AND created_at::date BETWEEN p_start AND p_end;

    SELECT COALESCE(SUM(amount),0) INTO v_arcade
    FROM public.arcade_play_sessions
    WHERE machine_id = ANY(v_machine_ids) AND amount > 0
      AND created_at::date BETWEEN p_start AND p_end;

    SELECT COALESCE(SUM(total_amount),0) INTO v_pos
    FROM public.vendx_pos_receipts pr
    WHERE pr.receipt_date::date BETWEEN p_start AND p_end
      AND pr.location_id IN (
        SELECT DISTINCT location_id FROM public.vendx_machines
        WHERE id = ANY(v_machine_ids) AND location_id IS NOT NULL
      );
  END IF;

  v_gross := v_machine + v_arcade + v_pos;
  v_comm := ROUND(v_gross * v_pct / 100, 2);
  v_net := v_gross - v_comm;
  RETURN QUERY SELECT v_machine, v_arcade, v_pos, v_gross, v_comm, v_net, v_count;
END; $$;

CREATE TABLE public.finance_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_month DATE NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  budget_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (budget_month, category, subcategory, account_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_budgets TO authenticated;
GRANT ALL ON public.finance_budgets TO service_role;
ALTER TABLE public.finance_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance manages budgets" ON public.finance_budgets FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));
CREATE TRIGGER trg_budgets_updated BEFORE UPDATE ON public.finance_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.finance_ap_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT,
  vendor TEXT NOT NULL,
  vendor_email TEXT,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','partial','paid','overdue','void')),
  paid_from_account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  external_reference TEXT,
  notes TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_ap_bills TO authenticated;
GRANT ALL ON public.finance_ap_bills TO service_role;
ALTER TABLE public.finance_ap_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance manages bills" ON public.finance_ap_bills FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));
CREATE TRIGGER trg_ap_bills_updated BEFORE UPDATE ON public.finance_ap_bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.finance_ap_bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_ap_bills(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL,
  paid_from_account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.finance_ap_bill_payments TO authenticated;
GRANT ALL ON public.finance_ap_bill_payments TO service_role;
ALTER TABLE public.finance_ap_bill_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance manages bill pmts" ON public.finance_ap_bill_payments FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

CREATE OR REPLACE FUNCTION public.update_ap_bill_on_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_bill finance_ap_bills%ROWTYPE; v_total NUMERIC;
BEGIN
  SELECT * INTO v_bill FROM finance_ap_bills WHERE id = COALESCE(NEW.bill_id, OLD.bill_id);
  SELECT COALESCE(SUM(amount),0) INTO v_total FROM finance_ap_bill_payments WHERE bill_id = v_bill.id;
  UPDATE finance_ap_bills
  SET amount_paid = v_total,
      status = CASE
        WHEN v_total >= amount THEN 'paid'
        WHEN v_total > 0 THEN 'partial'
        WHEN due_date < CURRENT_DATE THEN 'overdue'
        ELSE 'open' END,
      updated_at = now()
  WHERE id = v_bill.id;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_ap_pmt_bill_sync
AFTER INSERT OR DELETE ON public.finance_ap_bill_payments
FOR EACH ROW EXECUTE FUNCTION public.update_ap_bill_on_payment();

CREATE TABLE public.finance_ar_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_address JSONB,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partial','paid','overdue','void')),
  deposit_to_account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  notes TEXT,
  terms TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_ar_invoices TO authenticated;
GRANT ALL ON public.finance_ar_invoices TO service_role;
ALTER TABLE public.finance_ar_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance manages AR" ON public.finance_ar_invoices FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));
CREATE TRIGGER trg_ar_updated BEFORE UPDATE ON public.finance_ar_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_ar_invoice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || TO_CHAR(now(),'YYYYMMDD') || '-' || LPAD(FLOOR(random()*10000)::TEXT,4,'0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_ar_num BEFORE INSERT ON public.finance_ar_invoices
  FOR EACH ROW EXECUTE FUNCTION public.generate_ar_invoice_number();

CREATE TABLE public.finance_ar_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.finance_ar_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6,3) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_ar_invoice_items TO authenticated;
GRANT ALL ON public.finance_ar_invoice_items TO service_role;
ALTER TABLE public.finance_ar_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance manages AR items" ON public.finance_ar_invoice_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

CREATE TABLE public.finance_ar_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.finance_ar_invoices(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL,
  deposit_to_account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  payment_method TEXT,
  reference TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.finance_ar_invoice_payments TO authenticated;
GRANT ALL ON public.finance_ar_invoice_payments TO service_role;
ALTER TABLE public.finance_ar_invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance manages AR pmts" ON public.finance_ar_invoice_payments FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

CREATE OR REPLACE FUNCTION public.update_ar_invoice_on_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_inv finance_ar_invoices%ROWTYPE; v_total NUMERIC;
BEGIN
  SELECT * INTO v_inv FROM finance_ar_invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount),0) INTO v_total FROM finance_ar_invoice_payments WHERE invoice_id = v_inv.id;
  UPDATE finance_ar_invoices
  SET amount_paid = v_total,
      status = CASE
        WHEN v_total >= total THEN 'paid'
        WHEN v_total > 0 THEN 'partial'
        WHEN due_date < CURRENT_DATE THEN 'overdue'
        WHEN status = 'draft' THEN 'draft'
        ELSE 'sent' END,
      updated_at = now()
  WHERE id = v_inv.id;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_ar_pmt_sync AFTER INSERT OR DELETE ON public.finance_ar_invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.update_ar_invoice_on_payment();

CREATE OR REPLACE FUNCTION public.recalc_ar_invoice_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_id UUID; v_sub NUMERIC; v_tax NUMERIC;
BEGIN
  v_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(line_total),0), COALESCE(SUM(line_total * COALESCE(tax_rate,0) / 100),0)
    INTO v_sub, v_tax FROM finance_ar_invoice_items WHERE invoice_id = v_id;
  UPDATE finance_ar_invoices
    SET subtotal = v_sub, tax_amount = v_tax, total = v_sub + v_tax, updated_at = now()
    WHERE id = v_id;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_ar_items_recalc AFTER INSERT OR UPDATE OR DELETE ON public.finance_ar_invoice_items
FOR EACH ROW EXECUTE FUNCTION public.recalc_ar_invoice_totals();

CREATE TABLE public.finance_recurring_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly','quarterly','yearly')),
  next_due_date DATE NOT NULL,
  paid_from_account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  auto_create_bill BOOLEAN NOT NULL DEFAULT true,
  reminder_days_before INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_recurring_bills TO authenticated;
GRANT ALL ON public.finance_recurring_bills TO service_role;
ALTER TABLE public.finance_recurring_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance manages recurring" ON public.finance_recurring_bills FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));
CREATE TRIGGER trg_recurring_updated BEFORE UPDATE ON public.finance_recurring_bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.finance_bank_statement_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  filename TEXT,
  period_start DATE,
  period_end DATE,
  total_entries INTEGER DEFAULT 0,
  matched_entries INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','archived')),
  imported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_bank_statement_imports TO authenticated;
GRANT ALL ON public.finance_bank_statement_imports TO service_role;
ALTER TABLE public.finance_bank_statement_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance manages imports" ON public.finance_bank_statement_imports FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));
CREATE TRIGGER trg_imports_updated BEFORE UPDATE ON public.finance_bank_statement_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.finance_bank_statement_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES public.finance_bank_statement_imports(id) ON DELETE CASCADE,
  txn_date DATE NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2),
  reference TEXT,
  match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('unmatched','matched','ignored','manual')),
  matched_income_id UUID REFERENCES public.finance_income(id) ON DELETE SET NULL,
  matched_expense_id UUID REFERENCES public.finance_expenses(id) ON DELETE SET NULL,
  matched_bill_payment_id UUID REFERENCES public.finance_ap_bill_payments(id) ON DELETE SET NULL,
  matched_invoice_payment_id UUID REFERENCES public.finance_ar_invoice_payments(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_bank_statement_entries TO authenticated;
GRANT ALL ON public.finance_bank_statement_entries TO service_role;
ALTER TABLE public.finance_bank_statement_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance manages entries" ON public.finance_bank_statement_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

CREATE TABLE public.finance_tax_jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  state_or_region TEXT,
  city TEXT,
  filing_frequency TEXT DEFAULT 'quarterly' CHECK (filing_frequency IN ('monthly','quarterly','yearly')),
  registration_number TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_tax_jurisdictions TO authenticated;
GRANT ALL ON public.finance_tax_jurisdictions TO service_role;
ALTER TABLE public.finance_tax_jurisdictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance manages jurisdictions" ON public.finance_tax_jurisdictions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));
CREATE TRIGGER trg_jur_updated BEFORE UPDATE ON public.finance_tax_jurisdictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.finance_tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id UUID NOT NULL REFERENCES public.finance_tax_jurisdictions(id) ON DELETE CASCADE,
  tax_type TEXT NOT NULL DEFAULT 'sales' CHECK (tax_type IN ('sales','use','excise','vat','other')),
  rate_pct NUMERIC(6,3) NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_tax_rates TO authenticated;
GRANT ALL ON public.finance_tax_rates TO service_role;
ALTER TABLE public.finance_tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance manages rates" ON public.finance_tax_rates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

CREATE TABLE public.finance_1099_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_year INTEGER NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_tin TEXT,
  recipient_address JSONB,
  recipient_email TEXT,
  form_type TEXT NOT NULL DEFAULT '1099-NEC' CHECK (form_type IN ('1099-NEC','1099-MISC','1099-K')),
  total_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','filed','sent','void')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tax_year, recipient_name, form_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_1099_recipients TO authenticated;
GRANT ALL ON public.finance_1099_recipients TO service_role;
ALTER TABLE public.finance_1099_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance manages 1099" ON public.finance_1099_recipients FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));
CREATE TRIGGER trg_1099_updated BEFORE UPDATE ON public.finance_1099_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.finance_currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  is_base BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.finance_currencies TO authenticated;
GRANT ALL ON public.finance_currencies TO service_role;
ALTER TABLE public.finance_currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views currencies" ON public.finance_currencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance manages currencies" ON public.finance_currencies FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

INSERT INTO public.finance_currencies (code,name,symbol,is_base) VALUES
  ('USD','US Dollar','$',true),
  ('EUR','Euro','€',false),
  ('GBP','British Pound','£',false),
  ('CAD','Canadian Dollar','C$',false),
  ('MXN','Mexican Peso','Mex$',false),
  ('JPY','Japanese Yen','¥',false)
ON CONFLICT DO NOTHING;

CREATE TABLE public.finance_fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL REFERENCES public.finance_currencies(code),
  to_currency TEXT NOT NULL REFERENCES public.finance_currencies(code),
  rate NUMERIC(18,8) NOT NULL,
  rate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_currency, to_currency, rate_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_fx_rates TO authenticated;
GRANT ALL ON public.finance_fx_rates TO service_role;
ALTER TABLE public.finance_fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance manages fx" ON public.finance_fx_rates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

CREATE OR REPLACE FUNCTION public.get_pnl_report(p_from DATE, p_to DATE)
RETURNS TABLE(category TEXT, subcategory TEXT, kind TEXT, total NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  SELECT category, subcategory, 'income'::text, COALESCE(SUM(amount),0)
  FROM public.finance_income
  WHERE income_date BETWEEN p_from AND p_to
    AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  GROUP BY category, subcategory
  UNION ALL
  SELECT category, subcategory, 'expense'::text, COALESCE(SUM(amount),0)
  FROM public.finance_expenses
  WHERE expense_date BETWEEN p_from AND p_to
    AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  GROUP BY category, subcategory;
$$;

CREATE OR REPLACE FUNCTION public.get_cash_flow_report(p_from DATE, p_to DATE)
RETURNS TABLE(month DATE, inflow NUMERIC, outflow NUMERIC, net NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  WITH months AS (
    SELECT generate_series(date_trunc('month', p_from), date_trunc('month', p_to), '1 month')::date AS mo
  ), inflows AS (
    SELECT date_trunc('month', income_date)::date AS mo, SUM(amount) AS total
    FROM public.finance_income WHERE income_date BETWEEN p_from AND p_to
      AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
    GROUP BY 1
  ), outflows AS (
    SELECT date_trunc('month', expense_date)::date AS mo, SUM(amount) AS total
    FROM public.finance_expenses WHERE expense_date BETWEEN p_from AND p_to
      AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
    GROUP BY 1
  )
  SELECT months.mo, COALESCE(i.total,0), COALESCE(o.total,0),
         COALESCE(i.total,0) - COALESCE(o.total,0)
  FROM months
  LEFT JOIN inflows i ON i.mo = months.mo
  LEFT JOIN outflows o ON o.mo = months.mo
  ORDER BY months.mo;
$$;

CREATE OR REPLACE FUNCTION public.get_balance_sheet_report(p_as_of DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(section TEXT, label TEXT, amount NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  SELECT 'assets'::text, COALESCE(name,'Uncategorized'), COALESCE(current_balance,0)
  FROM public.finance_accounts
  WHERE (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  UNION ALL
  SELECT 'liabilities'::text, 'Accounts Payable', COALESCE(SUM(amount - amount_paid),0)
  FROM public.finance_ap_bills
  WHERE status IN ('open','partial','overdue') AND bill_date <= p_as_of
    AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  UNION ALL
  SELECT 'receivables'::text, 'Accounts Receivable', COALESCE(SUM(total - amount_paid),0)
  FROM public.finance_ar_invoices
  WHERE status IN ('sent','partial','overdue') AND invoice_date <= p_as_of
    AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));
$$;

CREATE OR REPLACE FUNCTION public.get_budget_variance(p_month DATE)
RETURNS TABLE(category TEXT, subcategory TEXT, budgeted NUMERIC, actual NUMERIC, variance NUMERIC, variance_pct NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  WITH b AS (
    SELECT category, subcategory, SUM(budget_amount) AS budgeted
    FROM public.finance_budgets
    WHERE budget_month = date_trunc('month', p_month)::date
      AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
    GROUP BY category, subcategory
  ), a AS (
    SELECT category, subcategory, SUM(amount) AS actual
    FROM public.finance_expenses
    WHERE expense_date >= date_trunc('month', p_month)::date
      AND expense_date < (date_trunc('month', p_month) + interval '1 month')::date
    GROUP BY category, subcategory
  )
  SELECT COALESCE(b.category, a.category),
         COALESCE(b.subcategory, a.subcategory),
         COALESCE(b.budgeted,0),
         COALESCE(a.actual,0),
         COALESCE(b.budgeted,0) - COALESCE(a.actual,0),
         CASE WHEN COALESCE(b.budgeted,0) = 0 THEN NULL
              ELSE ROUND(((COALESCE(a.actual,0) - COALESCE(b.budgeted,0)) / b.budgeted * 100)::numeric, 2) END
  FROM b FULL OUTER JOIN a ON b.category = a.category AND COALESCE(b.subcategory,'') = COALESCE(a.subcategory,'');
$$;
