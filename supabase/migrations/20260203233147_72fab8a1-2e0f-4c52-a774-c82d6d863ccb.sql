-- Add retail_status column to store_products
ALTER TABLE public.store_products 
ADD COLUMN retail_status text DEFAULT 'online_only' 
CHECK (retail_status IN ('online_only', 'in_store_only', 'in_store_and_online'));