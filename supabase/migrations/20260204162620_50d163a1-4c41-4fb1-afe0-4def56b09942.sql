-- Add status column to wallet_transactions for tracking pending partial payments
ALTER TABLE public.wallet_transactions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';

-- Add wallet_credit_applied column to store_orders for tracking
ALTER TABLE public.store_orders 
ADD COLUMN IF NOT EXISTS wallet_credit_applied NUMERIC DEFAULT 0;

-- Create index for faster pending transaction lookups
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status 
ON public.wallet_transactions(status) 
WHERE status = 'pending';