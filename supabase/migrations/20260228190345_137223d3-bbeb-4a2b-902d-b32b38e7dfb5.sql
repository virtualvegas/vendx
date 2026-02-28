
-- Add video support fields to media_tracks
ALTER TABLE public.media_tracks ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'audio' CHECK (media_type IN ('audio', 'video'));
ALTER TABLE public.media_tracks ADD COLUMN IF NOT EXISTS video_file_url TEXT;
ALTER TABLE public.media_tracks ADD COLUMN IF NOT EXISTS video_embed_url TEXT;
ALTER TABLE public.media_tracks ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Add cover image storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('media-covers', 'media-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view media covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media-covers');

CREATE POLICY "Admins can upload media covers"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media-covers' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can update media covers"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'media-covers' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete media covers"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media-covers' AND public.is_super_admin(auth.uid()));
