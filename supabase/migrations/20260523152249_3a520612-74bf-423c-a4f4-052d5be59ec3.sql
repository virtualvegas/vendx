CREATE TABLE IF NOT EXISTS public.vendx_integration_state (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendx_integration_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin manages integration state"
  ON public.vendx_integration_state FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));