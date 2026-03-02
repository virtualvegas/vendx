
-- Create storage bucket for artist images
INSERT INTO storage.buckets (id, name, public) VALUES ('artist-images', 'artist-images', true);

-- Allow public read access
CREATE POLICY "Artist images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'artist-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload artist images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'artist-images');

-- Allow authenticated users to update
CREATE POLICY "Authenticated users can update artist images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'artist-images');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete artist images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'artist-images');
