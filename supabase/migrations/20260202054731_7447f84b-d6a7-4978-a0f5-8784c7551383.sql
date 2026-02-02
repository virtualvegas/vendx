-- Create storage bucket for game images
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-images', 'game-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to game images
CREATE POLICY "Game images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'game-images');

-- Allow authenticated users with super_admin role to upload game images
CREATE POLICY "Super admins can upload game images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'game-images' 
  AND auth.role() = 'authenticated'
  AND public.has_role(auth.uid(), 'super_admin')
);

-- Allow super admins to update game images
CREATE POLICY "Super admins can update game images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'game-images' 
  AND auth.role() = 'authenticated'
  AND public.has_role(auth.uid(), 'super_admin')
);

-- Allow super admins to delete game images
CREATE POLICY "Super admins can delete game images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'game-images' 
  AND auth.role() = 'authenticated'
  AND public.has_role(auth.uid(), 'super_admin')
);