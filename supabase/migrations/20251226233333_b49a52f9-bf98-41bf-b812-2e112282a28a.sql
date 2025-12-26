-- Add cost_of_goods to machine_inventory (COGS distinct from retail unit_price)
ALTER TABLE public.machine_inventory 
ADD COLUMN cost_of_goods numeric DEFAULT 0;

-- Add category to machine_inventory for categorization
ALTER TABLE public.machine_inventory 
ADD COLUMN category text DEFAULT 'General';

-- Create machine_kiosk_categories table for per-machine editable categories with prices
CREATE TABLE public.machine_kiosk_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id uuid NOT NULL REFERENCES public.vendx_machines(id) ON DELETE CASCADE,
  category_name text NOT NULL,
  display_order integer DEFAULT 0,
  base_price numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(machine_id, category_name)
);

-- Enable RLS
ALTER TABLE public.machine_kiosk_categories ENABLE ROW LEVEL SECURITY;

-- Admins can manage all kiosk categories
CREATE POLICY "Admins can manage kiosk categories"
ON public.machine_kiosk_categories
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'tech_support_lead'::app_role)
);

-- Anyone can view active categories (for kiosk display)
CREATE POLICY "Anyone can view active kiosk categories"
ON public.machine_kiosk_categories
FOR SELECT
USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_machine_kiosk_categories_updated_at
BEFORE UPDATE ON public.machine_kiosk_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();