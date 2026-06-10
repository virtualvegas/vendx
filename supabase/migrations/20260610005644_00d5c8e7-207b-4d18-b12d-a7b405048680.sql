CREATE TABLE public.vendx_email_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  audience TEXT NOT NULL DEFAULT 'customer',
  source TEXT,
  consent BOOLEAN NOT NULL DEFAULT true,
  unsubscribed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.vendx_email_subscribers TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.vendx_email_subscribers TO authenticated;
GRANT ALL ON public.vendx_email_subscribers TO service_role;

ALTER TABLE public.vendx_email_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe"
ON public.vendx_email_subscribers
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view subscribers"
ON public.vendx_email_subscribers
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'marketing_sales')
);

CREATE POLICY "Admins can update subscribers"
ON public.vendx_email_subscribers
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'marketing_sales')
);

CREATE POLICY "Admins can delete subscribers"
ON public.vendx_email_subscribers
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'marketing_sales')
);

CREATE TRIGGER update_vendx_email_subscribers_updated_at
BEFORE UPDATE ON public.vendx_email_subscribers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vendx_email_subscribers_audience ON public.vendx_email_subscribers(audience);
CREATE INDEX idx_vendx_email_subscribers_created_at ON public.vendx_email_subscribers(created_at DESC);