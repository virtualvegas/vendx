
-- 1. Add franchise_owner role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'franchise_owner';

-- 2. Franchises table (one row per franchisee)
CREATE TABLE public.vendx_franchises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  business_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | suspended | cancelled
  machine_ownership_model TEXT NOT NULL DEFAULT 'franchisee', -- franchisee | company
  setup_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 8000,
  setup_fee_paid BOOLEAN NOT NULL DEFAULT false,
  setup_fee_paid_at TIMESTAMPTZ,
  setup_fee_stripe_session_id TEXT,
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 10,
  agreement_signed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_franchises TO authenticated;
GRANT ALL ON public.vendx_franchises TO service_role;
ALTER TABLE public.vendx_franchises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Franchisees view own franchise" ON public.vendx_franchises
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_accounting'));

CREATE POLICY "Franchisees update own franchise" ON public.vendx_franchises
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage franchises" ON public.vendx_franchises
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can create own franchise application" ON public.vendx_franchises
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_vendx_franchises_updated
BEFORE UPDATE ON public.vendx_franchises
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Territories (regions and/or specific locations)
CREATE TABLE public.vendx_franchise_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES public.vendx_franchises(id) ON DELETE CASCADE,
  region_id UUID REFERENCES public.regions(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (region_id IS NOT NULL OR location_id IS NOT NULL)
);
CREATE INDEX ON public.vendx_franchise_territories(franchise_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_franchise_territories TO authenticated;
GRANT ALL ON public.vendx_franchise_territories TO service_role;
ALTER TABLE public.vendx_franchise_territories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Franchisees view own territories" ON public.vendx_franchise_territories
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vendx_franchises f WHERE f.id = franchise_id AND f.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);
CREATE POLICY "Admins manage territories" ON public.vendx_franchise_territories
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 4. Machine-to-franchise assignments (route)
CREATE TABLE public.vendx_franchise_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES public.vendx_franchises(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.vendx_machines(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(machine_id)
);
CREATE INDEX ON public.vendx_franchise_machines(franchise_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_franchise_machines TO authenticated;
GRANT ALL ON public.vendx_franchise_machines TO service_role;
ALTER TABLE public.vendx_franchise_machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Franchisees view own machines" ON public.vendx_franchise_machines
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vendx_franchises f WHERE f.id = franchise_id AND f.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);
CREATE POLICY "Admins manage franchise machines" ON public.vendx_franchise_machines
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 5. Orders (machines or restock products)
CREATE TABLE public.vendx_franchise_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES public.vendx_franchises(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE,
  order_type TEXT NOT NULL, -- machine | product
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | shipped | delivered | cancelled
  shipping_address JSONB,
  notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.vendx_franchise_orders(franchise_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_franchise_orders TO authenticated;
GRANT ALL ON public.vendx_franchise_orders TO service_role;
ALTER TABLE public.vendx_franchise_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Franchisees view own orders" ON public.vendx_franchise_orders
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vendx_franchises f WHERE f.id = franchise_id AND f.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'warehouse_logistics')
);
CREATE POLICY "Franchisees create own orders" ON public.vendx_franchise_orders
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.vendx_franchises f WHERE f.id = franchise_id AND f.user_id = auth.uid())
);
CREATE POLICY "Admins manage franchise orders" ON public.vendx_franchise_orders
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_vendx_franchise_orders_updated
BEFORE UPDATE ON public.vendx_franchise_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_franchise_order_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'FR-' || TO_CHAR(now(),'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM()*10000)::TEXT,4,'0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_franchise_order_number
BEFORE INSERT ON public.vendx_franchise_orders
FOR EACH ROW EXECUTE FUNCTION public.generate_franchise_order_number();

-- 6. Payouts / commission periods (10% company cut)
CREATE TABLE public.vendx_franchise_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES public.vendx_franchises(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_sales NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 10,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_payout NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | disputed
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.vendx_franchise_payouts(franchise_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_franchise_payouts TO authenticated;
GRANT ALL ON public.vendx_franchise_payouts TO service_role;
ALTER TABLE public.vendx_franchise_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Franchisees view own payouts" ON public.vendx_franchise_payouts
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vendx_franchises f WHERE f.id = franchise_id AND f.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'finance_accounting')
);
CREATE POLICY "Admins manage franchise payouts" ON public.vendx_franchise_payouts
FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_accounting')
) WITH CHECK (
  public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_accounting')
);

CREATE TRIGGER trg_vendx_franchise_payouts_updated
BEFORE UPDATE ON public.vendx_franchise_payouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Helper: get franchise for current user
CREATE OR REPLACE FUNCTION public.get_my_franchise_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.vendx_franchises WHERE user_id = auth.uid() LIMIT 1;
$$;
