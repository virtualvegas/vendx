-- Create machine_inventory table to track inventory per machine
CREATE TABLE public.machine_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES public.vendx_machines(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  slot_number TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  max_capacity INTEGER NOT NULL DEFAULT 10,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  last_restocked TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(machine_id, slot_number)
);

-- Add indexes for performance
CREATE INDEX idx_machine_inventory_machine ON public.machine_inventory(machine_id);
CREATE INDEX idx_machine_inventory_sku ON public.machine_inventory(sku);

-- Enable RLS
ALTER TABLE public.machine_inventory ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage machine inventory"
ON public.machine_inventory FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'warehouse_logistics'::app_role) OR has_role(auth.uid(), 'tech_support_lead'::app_role));

CREATE POLICY "Operators can view assigned machine inventory"
ON public.machine_inventory FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM route_stops rs
    JOIN service_routes sr ON rs.route_id = sr.id
    WHERE rs.machine_id = machine_inventory.machine_id
    AND sr.assigned_to = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_machine_inventory_updated_at
BEFORE UPDATE ON public.machine_inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add name column to locations for better identification
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS name TEXT;

-- Create location_types enum-like text constraint and add location_type
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'office';

-- Add contact info to locations
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Add notes to machines for operational context
ALTER TABLE public.vendx_machines ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add installation_date for tracking
ALTER TABLE public.vendx_machines ADD COLUMN IF NOT EXISTS installed_at TIMESTAMP WITH TIME ZONE;

-- Create restock_logs for tracking restocking operations
CREATE TABLE public.restock_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES public.vendx_machines(id) ON DELETE CASCADE,
  performed_by UUID REFERENCES auth.users(id),
  items_restocked JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_restock_logs_machine ON public.restock_logs(machine_id);
CREATE INDEX idx_restock_logs_date ON public.restock_logs(created_at);

ALTER TABLE public.restock_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage restock logs"
ON public.restock_logs FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'warehouse_logistics'::app_role));

CREATE POLICY "Operators can create restock logs"
ON public.restock_logs FOR INSERT
WITH CHECK (auth.uid() = performed_by);

CREATE POLICY "Operators can view own restock logs"
ON public.restock_logs FOR SELECT
USING (auth.uid() = performed_by OR has_role(auth.uid(), 'super_admin'::app_role));