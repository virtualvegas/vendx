
ALTER TABLE public.vendx_partner_webhook_deliveries
  ADD COLUMN IF NOT EXISTS partner_subscription_id UUID NULL
    REFERENCES public.vendx_partner_subscriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendx_partner_webhook_deliveries_sub
  ON public.vendx_partner_webhook_deliveries(partner_subscription_id);
