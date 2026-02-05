-- Add wallet type support for guest and child wallets
ALTER TABLE public.wallets 
ADD COLUMN IF NOT EXISTS wallet_type text NOT NULL DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS parent_wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS daily_limit numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS spending_limit_per_transaction numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_guest boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS guest_expires_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS child_name text DEFAULT NULL;

-- Add constraint for wallet types
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_wallet_type_check;
ALTER TABLE public.wallets ADD CONSTRAINT wallets_wallet_type_check 
CHECK (wallet_type IN ('standard', 'guest', 'child'));

-- Create index for parent wallet lookups
CREATE INDEX IF NOT EXISTS idx_wallets_parent_id ON public.wallets(parent_wallet_id);

-- Create arcade play sessions table for tracking active plays
CREATE TABLE IF NOT EXISTS public.arcade_play_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.vendx_machines(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  plays_purchased integer NOT NULL DEFAULT 1,
  plays_used integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  payment_method text NOT NULL DEFAULT 'wallet',
  pricing_type text DEFAULT 'single',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 minutes'),
  used_at timestamp with time zone DEFAULT NULL,
  CONSTRAINT arcade_play_sessions_status_check CHECK (status IN ('active', 'used', 'expired', 'refunded'))
);

-- Enable RLS
ALTER TABLE public.arcade_play_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own play sessions
CREATE POLICY "Users can view own play sessions" 
ON public.arcade_play_sessions FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Service role can manage all sessions
CREATE POLICY "Service can manage play sessions" 
ON public.arcade_play_sessions FOR ALL 
USING (true);

-- Index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_arcade_play_sessions_machine ON public.arcade_play_sessions(machine_id, status);
CREATE INDEX IF NOT EXISTS idx_arcade_play_sessions_user ON public.arcade_play_sessions(user_id, status);

-- Function to check and enforce child wallet limits
CREATE OR REPLACE FUNCTION public.check_wallet_spending_limits(
  p_wallet_id uuid,
  p_amount numeric
)
RETURNS TABLE(allowed boolean, reason text, remaining_daily numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_daily_spent numeric;
  v_remaining numeric;
BEGIN
  SELECT * INTO v_wallet FROM wallets WHERE id = p_wallet_id;
  
  IF v_wallet.id IS NULL THEN
    RETURN QUERY SELECT false, 'Wallet not found'::text, 0::numeric;
    RETURN;
  END IF;
  
  -- Check balance
  IF v_wallet.balance < p_amount THEN
    RETURN QUERY SELECT false, 'Insufficient balance'::text, v_wallet.balance;
    RETURN;
  END IF;
  
  -- Check per-transaction limit
  IF v_wallet.spending_limit_per_transaction IS NOT NULL AND p_amount > v_wallet.spending_limit_per_transaction THEN
    RETURN QUERY SELECT false, 'Exceeds per-transaction limit'::text, v_wallet.spending_limit_per_transaction;
    RETURN;
  END IF;
  
  -- Check daily limit
  IF v_wallet.daily_limit IS NOT NULL THEN
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_daily_spent
    FROM wallet_transactions
    WHERE wallet_id = p_wallet_id
      AND amount < 0
      AND created_at >= CURRENT_DATE;
    
    v_remaining := v_wallet.daily_limit - v_daily_spent;
    
    IF p_amount > v_remaining THEN
      RETURN QUERY SELECT false, 'Exceeds daily limit'::text, v_remaining;
      RETURN;
    END IF;
  ELSE
    v_remaining := v_wallet.balance;
  END IF;
  
  -- Check if guest wallet expired
  IF v_wallet.is_guest AND v_wallet.guest_expires_at IS NOT NULL AND v_wallet.guest_expires_at < now() THEN
    RETURN QUERY SELECT false, 'Guest wallet expired'::text, 0::numeric;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, 'OK'::text, v_remaining;
END;
$$;

-- Enable realtime for arcade play sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.arcade_play_sessions;