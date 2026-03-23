
CREATE TABLE public.wallet_auto_reload (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  reload_type TEXT NOT NULL DEFAULT 'threshold' CHECK (reload_type IN ('threshold', 'scheduled')),
  reload_amount NUMERIC NOT NULL DEFAULT 25,
  threshold_amount NUMERIC DEFAULT 5,
  schedule_interval TEXT DEFAULT 'weekly' CHECK (schedule_interval IN ('daily', 'weekly', 'biweekly', 'monthly')),
  preferred_payment_method TEXT NOT NULL DEFAULT 'stripe' CHECK (preferred_payment_method IN ('stripe', 'paypal')),
  last_reload_at TIMESTAMPTZ,
  next_scheduled_reload TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, wallet_id)
);

ALTER TABLE public.wallet_auto_reload ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own auto-reload settings"
  ON public.wallet_auto_reload FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own auto-reload settings"
  ON public.wallet_auto_reload FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own auto-reload settings"
  ON public.wallet_auto_reload FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own auto-reload settings"
  ON public.wallet_auto_reload FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
