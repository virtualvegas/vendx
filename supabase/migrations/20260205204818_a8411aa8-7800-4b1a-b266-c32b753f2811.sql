-- Add shipping fee fields to ticket_prizes
ALTER TABLE public.ticket_prizes 
ADD COLUMN shipping_fee_type TEXT DEFAULT 'free' CHECK (shipping_fee_type IN ('free', 'fixed', 'tickets')),
ADD COLUMN shipping_fee_amount NUMERIC DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.ticket_prizes.shipping_fee_type IS 'free=no charge, fixed=dollar amount, tickets=ticket cost';
COMMENT ON COLUMN public.ticket_prizes.shipping_fee_amount IS 'Amount in dollars or tickets based on shipping_fee_type';