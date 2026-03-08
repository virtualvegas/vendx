
-- Add product_source to distinguish internal, shopify, subscription products
ALTER TABLE public.store_funnel_products 
  ADD COLUMN IF NOT EXISTS product_source text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS external_product_id text,
  ADD COLUMN IF NOT EXISTS external_product_data jsonb DEFAULT '{}';

-- Make product_id nullable for Shopify products (no FK to store_products)
ALTER TABLE public.store_funnel_products 
  ALTER COLUMN product_id DROP NOT NULL;

-- Add step type 'subscription' to support subscription steps
COMMENT ON COLUMN public.store_funnel_products.product_source IS 'internal, shopify, or subscription';
COMMENT ON COLUMN public.store_funnel_products.external_product_id IS 'Shopify product handle or variant ID';
COMMENT ON COLUMN public.store_funnel_products.external_product_data IS 'Cached Shopify product data (name, price, image)';
