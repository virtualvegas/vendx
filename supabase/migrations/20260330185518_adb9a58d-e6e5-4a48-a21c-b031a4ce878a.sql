
-- Add default retail price to warehouse items (the price machines should default to)
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS default_retail_price NUMERIC DEFAULT 0;

-- Add an is_active flag so products stay listed even at qty 0
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add image_url for product reference
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS image_url TEXT;
