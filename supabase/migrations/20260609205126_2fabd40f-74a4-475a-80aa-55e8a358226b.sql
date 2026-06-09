
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS card_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS card_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS card_accent_color text DEFAULT '#3B82F6';

-- Public RPC to fetch a business card (avoids exposing entire profiles table to anon)
CREATE OR REPLACE FUNCTION public.get_business_card(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile record;
  _roles text[];
BEGIN
  SELECT p.id, p.full_name, p.email, p.phone, p.avatar_url, p.job_title,
         p.department, p.bio, p.linkedin_url, p.website_url, p.card_slug,
         p.card_accent_color, p.card_public
  INTO _profile
  FROM public.profiles p
  WHERE (p.card_slug = _slug OR p.id::text = _slug)
  LIMIT 1;

  IF _profile.id IS NULL OR _profile.card_public IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  SELECT array_agg(role::text) INTO _roles
  FROM public.user_roles WHERE user_id = _profile.id;

  -- Only allow cards for staff/admin-type users, not regular customers
  IF _roles IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(_roles) r
    WHERE r <> 'customer'
  ) THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', _profile.id,
    'full_name', _profile.full_name,
    'email', _profile.email,
    'phone', _profile.phone,
    'avatar_url', _profile.avatar_url,
    'job_title', _profile.job_title,
    'department', _profile.department,
    'bio', _profile.bio,
    'linkedin_url', _profile.linkedin_url,
    'website_url', _profile.website_url,
    'card_slug', _profile.card_slug,
    'card_accent_color', _profile.card_accent_color,
    'roles', _roles
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_card(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_business_cards()
RETURNS TABLE(
  id uuid, full_name text, job_title text, department text,
  avatar_url text, card_slug text, card_accent_color text, roles text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.job_title, p.department,
         p.avatar_url, p.card_slug, p.card_accent_color,
         (SELECT array_agg(ur.role::text) FROM public.user_roles ur WHERE ur.user_id = p.id) AS roles
  FROM public.profiles p
  WHERE p.card_public = true
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.role::text <> 'customer'
    )
  ORDER BY p.full_name NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.list_business_cards() TO anon, authenticated;
