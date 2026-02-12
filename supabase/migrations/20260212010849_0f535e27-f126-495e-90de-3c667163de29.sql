
-- Music & Film releases table
CREATE TABLE public.media_releases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL CHECK (media_type IN ('music', 'film')),
  short_description TEXT,
  full_description TEXT,
  cover_image_url TEXT,
  trailer_url TEXT,
  release_date DATE,
  release_status TEXT NOT NULL DEFAULT 'coming_soon',
  genre TEXT[],
  artist_director TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  -- Music platforms
  spotify_url TEXT,
  apple_music_url TEXT,
  youtube_music_url TEXT,
  soundcloud_url TEXT,
  tidal_url TEXT,
  amazon_music_url TEXT,
  deezer_url TEXT,
  bandcamp_url TEXT,
  
  -- Film/Video platforms
  netflix_url TEXT,
  prime_video_url TEXT,
  disney_plus_url TEXT,
  hulu_url TEXT,
  youtube_url TEXT,
  apple_tv_url TEXT,
  peacock_url TEXT,
  paramount_plus_url TEXT,
  tubi_url TEXT,
  
  -- Purchase platforms
  itunes_url TEXT,
  google_play_url TEXT,
  vudu_url TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.media_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Media releases are publicly readable"
  ON public.media_releases FOR SELECT USING (true);

CREATE POLICY "Super admins can manage media releases"
  ON public.media_releases FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_media_releases_updated_at
  BEFORE UPDATE ON public.media_releases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
