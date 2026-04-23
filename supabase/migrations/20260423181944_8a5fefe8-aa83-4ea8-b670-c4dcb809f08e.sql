-- 1) Warehouses table
CREATE TABLE IF NOT EXISTS public.vendx_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  phone TEXT,
  email TEXT,
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  capacity_units INTEGER,
  handles_machine_storage BOOLEAN NOT NULL DEFAULT TRUE,
  handles_inventory BOOLEAN NOT NULL DEFAULT TRUE,
  handles_shipping BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendx_warehouses_status ON public.vendx_warehouses(status);
CREATE INDEX IF NOT EXISTS idx_vendx_warehouses_manager ON public.vendx_warehouses(manager_id);

ALTER TABLE public.vendx_warehouses ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_vendx_warehouses_updated_at ON public.vendx_warehouses;
CREATE TRIGGER update_vendx_warehouses_updated_at
BEFORE UPDATE ON public.vendx_warehouses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Add warehouse_id columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.vendx_warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.vendx_machines ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.vendx_warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.vendx_warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_warehouse_id ON public.profiles(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_vendx_machines_warehouse_id ON public.vendx_machines(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_warehouse_id ON public.inventory_items(warehouse_id);

-- 3) Helper: get current user's warehouse
CREATE OR REPLACE FUNCTION public.get_my_warehouse_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT warehouse_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 4) RLS policies for vendx_warehouses
DROP POLICY IF EXISTS "Super admin manages warehouses" ON public.vendx_warehouses;
CREATE POLICY "Super admin manages warehouses"
ON public.vendx_warehouses FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Warehouse staff can view all warehouses" ON public.vendx_warehouses;
CREATE POLICY "Warehouse staff can view all warehouses"
ON public.vendx_warehouses FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'warehouse_logistics')
  OR public.has_role(auth.uid(), 'global_operations_manager')
);