ALTER TABLE public.vendx_custom_arcade_requests
  ADD COLUMN IF NOT EXISTS customization JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS artwork_paths JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.vendx_custom_arcade_requests.customization IS 'Structured cabinet appearance, controls, hardware, and build options.';
COMMENT ON COLUMN public.vendx_custom_arcade_requests.artwork_paths IS 'Private storage object paths keyed by cabinet artwork surface.';

DROP POLICY IF EXISTS "Custom arcade artwork uploads" ON storage.objects;
CREATE POLICY "Custom arcade artwork uploads"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'custom-arcade-artwork'
  AND split_part(name, '/', 1) = 'requests'
  AND lower(storage.extension(name)) IN ('png', 'jpg', 'jpeg', 'webp')
);

DROP POLICY IF EXISTS "Custom arcade artwork staff reads" ON storage.objects;
CREATE POLICY "Custom arcade artwork staff reads"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'custom-arcade-artwork'
  AND public.is_ext_service_staff(auth.uid())
);

DROP POLICY IF EXISTS "Custom arcade artwork staff deletes" ON storage.objects;
CREATE POLICY "Custom arcade artwork staff deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'custom-arcade-artwork'
  AND public.is_ext_service_staff(auth.uid())
);

CREATE OR REPLACE FUNCTION public.set_news_category_subscriptions(
  p_email TEXT,
  p_category_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscriber_id UUID;
  v_category_id UUID;
BEGIN
  IF p_email IS NULL OR length(trim(lower(p_email))) > 255 OR trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
    RAISE EXCEPTION 'A valid subscriber email is required';
  END IF;

  SELECT id INTO v_subscriber_id
  FROM public.vendx_email_subscribers
  WHERE lower(email) = lower(trim(p_email))
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_subscriber_id IS NULL THEN
    RAISE EXCEPTION 'Subscriber not found';
  END IF;

  IF coalesce(array_length(p_category_ids, 1), 0) > 50 THEN
    RAISE EXCEPTION 'Too many categories';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_category_ids) AS requested(id)
    LEFT JOIN public.news_categories c ON c.id = requested.id
    WHERE c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid category';
  END IF;

  DELETE FROM public.news_category_subscriptions
  WHERE subscriber_id = v_subscriber_id;

  IF coalesce(array_length(p_category_ids, 1), 0) = 0 THEN
    INSERT INTO public.news_category_subscriptions (subscriber_id, category_id)
    VALUES (v_subscriber_id, NULL);
  ELSE
    FOREACH v_category_id IN ARRAY p_category_ids LOOP
      INSERT INTO public.news_category_subscriptions (subscriber_id, category_id)
      VALUES (v_subscriber_id, v_category_id);
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_news_category_subscriptions(TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_news_category_subscriptions(TEXT, UUID[]) TO anon, authenticated;

DROP POLICY IF EXISTS "Delete subs" ON public.news_category_subscriptions;
DROP POLICY IF EXISTS "Insert subs" ON public.news_category_subscriptions;
DROP POLICY IF EXISTS "Read subs" ON public.news_category_subscriptions;

REVOKE ALL ON public.news_category_subscriptions FROM anon, authenticated;
GRANT ALL ON public.news_category_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_category_subscriptions TO authenticated;

CREATE POLICY "Staff manage news category subscriptions"
ON public.news_category_subscriptions
FOR ALL
TO authenticated
USING (public.can_moderate_news(auth.uid()))
WITH CHECK (public.can_moderate_news(auth.uid()));