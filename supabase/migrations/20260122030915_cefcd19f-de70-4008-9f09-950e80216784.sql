-- Add PayPal tracking columns to store_orders
ALTER TABLE public.store_orders 
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'stripe',
ADD COLUMN IF NOT EXISTS paypal_order_id text,
ADD COLUMN IF NOT EXISTS shipping_address jsonb;

-- Add reference_id to wallet_transactions for tracking payment IDs
ALTER TABLE public.wallet_transactions 
ADD COLUMN IF NOT EXISTS reference_id text;

-- Create index for faster PayPal lookups
CREATE INDEX IF NOT EXISTS idx_store_orders_paypal_order_id ON public.store_orders(paypal_order_id) WHERE paypal_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_orders_payment_method ON public.store_orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON public.wallet_transactions(reference_id) WHERE reference_id IS NOT NULL;