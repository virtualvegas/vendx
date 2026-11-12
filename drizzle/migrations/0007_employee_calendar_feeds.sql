CREATE TABLE public.vendx_calendar_feeds (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  feed_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

GRANT SELECT ON public.vendx_calendar_feeds TO authenticated;
GRANT ALL ON public.vendx_calendar_feeds TO service_role;

ALTER TABLE public.vendx_calendar_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own calendar feed"
ON public.vendx_calendar_feeds
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_my_calendar_feed()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _token text;
BEGIN
  IF _uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('super_admin', 'global_operations_manager', 'event_manager', 'tech_support_lead', 'finance_accounting', 'regional_manager', 'employee_operator', 'support', 'warehouse_logistics')
  ) THEN
    RAISE EXCEPTION 'Employee account required';
  END IF;

  INSERT INTO public.vendx_calendar_feeds (user_id)
  VALUES (_uid)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT feed_token INTO _token
  FROM public.vendx_calendar_feeds
  WHERE user_id = _uid;

  RETURN _token;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_my_calendar_feed()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _token text;
BEGIN
  IF _uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('super_admin', 'global_operations_manager', 'event_manager', 'tech_support_lead', 'finance_accounting', 'regional_manager', 'employee_operator', 'support', 'warehouse_logistics')
  ) THEN
    RAISE EXCEPTION 'Employee account required';
  END IF;

  INSERT INTO public.vendx_calendar_feeds (user_id)
  VALUES (_uid)
  ON CONFLICT (user_id) DO UPDATE
    SET feed_token = encode(gen_random_bytes(24), 'hex'),
        updated_at = now()
  RETURNING feed_token INTO _token;

  RETURN _token;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_calendar_feed() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rotate_my_calendar_feed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_calendar_feed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_my_calendar_feed() TO authenticated;