-- Allow service routes (zones) to be assigned to a warehouse and an office simultaneously
ALTER TABLE public.service_routes
  ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.vendx_offices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.vendx_warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_service_routes_office_id ON public.service_routes(office_id);
CREATE INDEX IF NOT EXISTS idx_service_routes_warehouse_id ON public.service_routes(warehouse_id);