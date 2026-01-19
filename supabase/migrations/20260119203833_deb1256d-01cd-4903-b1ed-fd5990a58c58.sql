-- Add images array to stands table
ALTER TABLE public.stands ADD COLUMN images text[] DEFAULT '{}';

-- Create stand_menu_items table
CREATE TABLE public.stand_menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stand_id UUID NOT NULL REFERENCES public.stands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  category TEXT,
  display_order INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stand_menu_items ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view stand menu items"
  ON public.stand_menu_items FOR SELECT
  USING (true);

-- Admin write access
CREATE POLICY "Super admins can manage stand menu items"
  ON public.stand_menu_items FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_stand_menu_items_updated_at
  BEFORE UPDATE ON public.stand_menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();