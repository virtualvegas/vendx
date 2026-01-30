-- Add roblox_url column to video_games table
ALTER TABLE public.video_games ADD COLUMN IF NOT EXISTS roblox_url TEXT;