
CREATE POLICY "Business card photos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'business-cards');

CREATE POLICY "Users can upload their own business card photo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'business-cards' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own business card photo"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'business-cards' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own business card photo"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'business-cards' AND (storage.foldername(name))[1] = auth.uid()::text);
