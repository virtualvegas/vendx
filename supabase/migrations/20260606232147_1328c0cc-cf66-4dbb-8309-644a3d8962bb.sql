
CREATE TABLE public.vendx_pos_revenue_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  deposit_account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  expense_account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  revenue_category TEXT NOT NULL DEFAULT 'pos_revenue',
  revenue_subcategory TEXT,
  expense_category TEXT NOT NULL DEFAULT 'cogs',
  expense_subcategory TEXT,
  payment_method TEXT DEFAULT 'pos',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_pos_revenue_config TO authenticated;
GRANT ALL ON public.vendx_pos_revenue_config TO service_role;

ALTER TABLE public.vendx_pos_revenue_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance admins read pos revenue config"
  ON public.vendx_pos_revenue_config FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

CREATE POLICY "Finance admins write pos revenue config"
  ON public.vendx_pos_revenue_config FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

CREATE TRIGGER trg_pos_revenue_config_updated
  BEFORE UPDATE ON public.vendx_pos_revenue_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.vendx_pos_revenue_config (source, display_name)
VALUES ('loyverse', 'Loyverse POS')
ON CONFLICT (source) DO NOTHING;
