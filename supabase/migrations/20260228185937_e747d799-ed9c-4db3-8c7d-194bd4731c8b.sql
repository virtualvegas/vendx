
-- Create media_tracks table for individual playable tracks linked to releases
CREATE TABLE public.media_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  release_id UUID REFERENCES public.media_releases(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES public.media_artists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  track_number INTEGER DEFAULT 1,
  duration_seconds INTEGER,
  audio_file_url TEXT,
  preview_url TEXT,
  external_stream_url TEXT,
  lyrics TEXT,
  is_playable BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  play_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.media_tracks ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view active tracks"
  ON public.media_tracks FOR SELECT
  USING (is_active = true);

-- Admin write access
CREATE POLICY "Super admins can manage tracks"
  ON public.media_tracks FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- Create audio storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('artist-audio', 'artist-audio', true);

-- Storage policies for audio files
CREATE POLICY "Anyone can view artist audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'artist-audio');

CREATE POLICY "Admins can upload artist audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'artist-audio' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can update artist audio"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'artist-audio' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete artist audio"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'artist-audio' AND public.is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_media_tracks_updated_at
  BEFORE UPDATE ON public.media_tracks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
