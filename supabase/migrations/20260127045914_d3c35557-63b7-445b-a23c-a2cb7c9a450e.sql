-- Add Epic Games Store URL column to video_games table
ALTER TABLE public.video_games 
ADD COLUMN IF NOT EXISTS epic_games_store_url TEXT;