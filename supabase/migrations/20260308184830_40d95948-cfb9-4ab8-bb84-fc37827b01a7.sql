ALTER TABLE public.store_products ADD COLUMN IF NOT EXISTS shopify_handle text DEFAULT NULL;
ALTER TABLE public.store_products ADD COLUMN IF NOT EXISTS shopify_variant_id text DEFAULT NULL;