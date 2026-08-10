DROP POLICY IF EXISTS "Anyone can read suggestions" ON public.ecovend_suggestions;

CREATE POLICY "Own or staff can read suggestions"
ON public.ecovend_suggestions FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'global_operations_manager'::app_role)
  OR public.has_role(auth.uid(), 'employee_operator'::app_role)
  OR public.has_role(auth.uid(), 'support'::app_role)
);

CREATE OR REPLACE FUNCTION public.list_ecovend_suggestions(_machine_code text)
RETURNS TABLE (id uuid, suggestion_text text, category text, upvotes integer, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.suggestion_text, s.category, s.upvotes, s.created_at
  FROM public.ecovend_suggestions s
  WHERE s.machine_code = _machine_code
    AND coalesce(s.status, 'pending') <> 'rejected'
  ORDER BY s.upvotes DESC, s.created_at DESC
  LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.upvote_ecovend_suggestion(_suggestion_id uuid, _session_id text)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_new integer;
BEGIN
  INSERT INTO public.ecovend_suggestion_votes (suggestion_id, session_id)
  VALUES (_suggestion_id, _session_id)
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    SELECT upvotes INTO v_new FROM public.ecovend_suggestions WHERE id = _suggestion_id;
    RETURN coalesce(v_new, 0);
  END IF;

  UPDATE public.ecovend_suggestions
  SET upvotes = coalesce(upvotes, 0) + 1, updated_at = now()
  WHERE id = _suggestion_id
  RETURNING upvotes INTO v_new;

  RETURN coalesce(v_new, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.list_ecovend_suggestions(text) FROM public;
REVOKE ALL ON FUNCTION public.upvote_ecovend_suggestion(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.list_ecovend_suggestions(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upvote_ecovend_suggestion(uuid, text) TO anon, authenticated;