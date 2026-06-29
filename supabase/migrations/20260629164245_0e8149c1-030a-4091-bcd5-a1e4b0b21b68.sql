
CREATE TABLE IF NOT EXISTS public.vendx_partner_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.vendx_catalog_partners(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  external_subscription_id TEXT NOT NULL,
  vendx_subscription_id UUID NULL REFERENCES public.store_subscriptions(id) ON DELETE SET NULL,
  product_ref TEXT NULL,
  external_product_id TEXT NULL,
  customer_email TEXT NULL,
  customer_name TEXT NULL,
  price NUMERIC(12,2) NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  interval TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NULL,
  current_period_end TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  last_payment_at TIMESTAMPTZ NULL,
  failed_payment_count INTEGER NOT NULL DEFAULT 0,
  last_event TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id, external_subscription_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_partner_subscriptions TO authenticated;
GRANT ALL ON public.vendx_partner_subscriptions TO service_role;

ALTER TABLE public.vendx_partner_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage partner subscriptions"
  ON public.vendx_partner_subscriptions
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'finance_accounting'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'finance_accounting'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_vendx_partner_subscriptions_partner ON public.vendx_partner_subscriptions(partner_id);
CREATE INDEX IF NOT EXISTS idx_vendx_partner_subscriptions_status ON public.vendx_partner_subscriptions(status);

CREATE OR REPLACE FUNCTION public.tg_vendx_partner_subscriptions_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_vendx_partner_subscriptions_touch ON public.vendx_partner_subscriptions;
CREATE TRIGGER trg_vendx_partner_subscriptions_touch
  BEFORE UPDATE ON public.vendx_partner_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_vendx_partner_subscriptions_touch();
