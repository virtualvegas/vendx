
-- Create media_artists table
CREATE TABLE public.media_artists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  artist_type TEXT NOT NULL DEFAULT 'music' CHECK (artist_type IN ('music', 'film', 'both')),
  bio TEXT,
  short_bio TEXT,
  profile_image_url TEXT,
  banner_image_url TEXT,
  is_legacy BOOLEAN NOT NULL DEFAULT false,
  legacy_tribute_text TEXT,
  birth_date DATE,
  death_date DATE,
  website_url TEXT,
  instagram_url TEXT,
  twitter_url TEXT,
  youtube_url TEXT,
  spotify_url TEXT,
  apple_music_url TEXT,
  soundcloud_url TEXT,
  tiktok_url TEXT,
  contact_email TEXT,
  booking_email TEXT,
  management_company TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.media_releases ADD COLUMN artist_id UUID REFERENCES public.media_artists(id) ON DELETE SET NULL;

ALTER TABLE public.media_artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active artists"
ON public.media_artists FOR SELECT
USING (is_active = true);

CREATE POLICY "Super admins can manage artists"
ON public.media_artists FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_media_artists_updated_at
BEFORE UPDATE ON public.media_artists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
