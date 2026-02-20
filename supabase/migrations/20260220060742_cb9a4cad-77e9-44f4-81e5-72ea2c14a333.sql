
-- Add image_url column to stand_menu_items
ALTER TABLE public.stand_menu_items ADD COLUMN image_url TEXT;

-- Create storage bucket for stand images
INSERT INTO storage.buckets (id, name, public) VALUES ('stand-images', 'stand-images', true);

-- Allow authenticated users to upload stand images
CREATE POLICY "Authenticated users can upload stand images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'stand-images' AND auth.role() = 'authenticated');

-- Allow authenticated users to update stand images
CREATE POLICY "Authenticated users can update stand images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'stand-images' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete stand images
CREATE POLICY "Authenticated users can delete stand images"
ON storage.objects FOR DELETE
USING (bucket_id = 'stand-images' AND auth.role() = 'authenticated');

-- Allow public read access to stand images
CREATE POLICY "Public can view stand images"
ON storage.objects FOR SELECT
USING (bucket_id = 'stand-images');
