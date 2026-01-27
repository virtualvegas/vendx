-- Add retail store links column to store_products table
-- This will store an array of objects like: [{"store": "amazon", "url": "https://..."}, {"store": "walmart", "url": "https://..."}]
ALTER TABLE public.store_products 
ADD COLUMN IF NOT EXISTS retail_links JSONB DEFAULT '[]'::jsonb;