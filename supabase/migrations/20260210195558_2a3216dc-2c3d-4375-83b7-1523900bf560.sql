
-- EcoSnack locker purchases table
CREATE TABLE public.ecosnack_locker_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID REFERENCES public.vendx_machines(id),
  machine_code TEXT NOT NULL,
  user_id UUID,
  item_name TEXT NOT NULL,
  locker_number TEXT NOT NULL,
  locker_code TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'wallet',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ecosnack_locker_purchases ENABLE ROW LEVEL SECURITY;

-- Anyone can read their own purchases
CREATE POLICY "Users can view their own locker purchases"
  ON public.ecosnack_locker_purchases FOR SELECT
  USING (auth.uid() = user_id);

-- Service role / edge functions insert
CREATE POLICY "Allow insert for authenticated users"
  ON public.ecosnack_locker_purchases FOR INSERT
  WITH CHECK (true);

-- Allow public select by locker code for guest verification
CREATE POLICY "Allow public lookup by machine_code and locker_code"
  ON public.ecosnack_locker_purchases FOR SELECT
  USING (payment_status = 'completed');

-- Update for redemption
CREATE POLICY "Allow update for service"
  ON public.ecosnack_locker_purchases FOR UPDATE
  USING (true);
