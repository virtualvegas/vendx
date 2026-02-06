-- Add Shopify tracking columns to store_orders
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS shopify_order_id TEXT;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS shopify_order_number TEXT;

-- Index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_store_orders_shopify_id ON store_orders(shopify_order_id);