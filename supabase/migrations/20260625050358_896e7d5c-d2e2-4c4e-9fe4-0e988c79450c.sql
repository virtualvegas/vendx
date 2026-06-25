
-- Extend store_products with PayPal billing identifiers
ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS paypal_product_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_plan_id TEXT;

-- Extend store_subscriptions for multi-provider + lifecycle management
ALTER TABLE public.store_subscriptions
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_collection BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS failed_payment_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_failure_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS comp_credits_remaining NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_store_subscriptions_paypal_sub_id
  ON public.store_subscriptions(paypal_subscription_id)
  WHERE paypal_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_store_subscriptions_status
  ON public.store_subscriptions(status);

-- Append-only subscription event log
CREATE TABLE IF NOT EXISTS public.store_subscription_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.store_subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_subscription_events_sub
  ON public.store_subscription_events(subscription_id, created_at DESC);

GRANT SELECT, INSERT ON public.store_subscription_events TO authenticated;
GRANT ALL ON public.store_subscription_events TO service_role;

ALTER TABLE public.store_subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their subscription events"
  ON public.store_subscription_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.store_subscriptions s
      WHERE s.id = store_subscription_events.subscription_id
        AND s.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'finance_accounting')
    OR public.has_role(auth.uid(), 'support')
  );

CREATE POLICY "Owners and staff can record subscription events"
  ON public.store_subscription_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.store_subscriptions s
      WHERE s.id = store_subscription_events.subscription_id
        AND s.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'finance_accounting')
    OR public.has_role(auth.uid(), 'support')
  );

-- Staff visibility into all subscriptions for the admin panel
DROP POLICY IF EXISTS "Staff can view all subscriptions" ON public.store_subscriptions;
CREATE POLICY "Staff can view all subscriptions"
  ON public.store_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'finance_accounting')
    OR public.has_role(auth.uid(), 'support')
  );

DROP POLICY IF EXISTS "Staff can update subscriptions" ON public.store_subscriptions;
CREATE POLICY "Staff can update subscriptions"
  ON public.store_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'finance_accounting')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'finance_accounting')
  );
