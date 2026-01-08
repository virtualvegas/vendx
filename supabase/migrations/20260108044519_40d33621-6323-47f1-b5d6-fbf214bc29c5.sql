-- Add new platform URL columns to video_games table
ALTER TABLE public.video_games 
ADD COLUMN IF NOT EXISTS amazon_app_store_url TEXT,
ADD COLUMN IF NOT EXISTS xbox_store_url TEXT,
ADD COLUMN IF NOT EXISTS playstation_store_url TEXT,
ADD COLUMN IF NOT EXISTS nintendo_eshop_url TEXT,
ADD COLUMN IF NOT EXISTS browser_play_url TEXT;