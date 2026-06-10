ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS division_ids uuid[] DEFAULT '{}'::uuid[];

CREATE OR REPLACE FUNCTION public.get_business_card(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _profile record;
  _roles text[];
  _divisions jsonb;
BEGIN
  SELECT p.id, p.full_name, p.email, p.phone, p.avatar_url, p.job_title,
         p.department, p.bio, p.linkedin_url, p.website_url, p.card_slug,
         p.card_accent_color, p.card_public, p.division_ids
  INTO _profile
  FROM public.profiles p
  WHERE (p.card_slug = _slug OR p.id::text = _slug)
  LIMIT 1;

  IF _profile.id IS NULL OR _profile.card_public IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  SELECT array_agg(role::text) INTO _roles
  FROM public.user_roles WHERE user_id = _profile.id;

  IF _roles IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(_roles) r WHERE r <> 'customer'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'slug', d.slug) ORDER BY d.name), '[]'::jsonb)
  INTO _divisions
  FROM public.divisions d
  WHERE d.id = ANY(COALESCE(_profile.division_ids, '{}'::uuid[]));

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
    'roles', _roles,
    'division_ids', COALESCE(_profile.division_ids, '{}'::uuid[]),
    'divisions', _divisions,
    'company_name', 'VendX Global Corporation'
  );
END;
$function$;