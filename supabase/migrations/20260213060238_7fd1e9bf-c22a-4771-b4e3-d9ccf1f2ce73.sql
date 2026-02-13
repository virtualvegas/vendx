
ALTER TABLE public.media_releases 
ADD COLUMN music_release_type text DEFAULT 'single',
ADD COLUMN tracklist jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.media_releases.music_release_type IS 'single, album, or ep';
COMMENT ON COLUMN public.media_releases.tracklist IS 'Array of {number, title, duration, featured_artist}';
