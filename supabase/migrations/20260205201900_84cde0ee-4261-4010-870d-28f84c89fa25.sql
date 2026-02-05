-- Create user_tickets table for storing ticket balances
CREATE TABLE public.user_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned BIGINT NOT NULL DEFAULT 0,
  lifetime_redeemed BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ticket_transactions table for audit trail
CREATE TABLE public.ticket_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  machine_id UUID REFERENCES public.vendx_machines(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.machine_sessions(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'admin_grant', 'admin_revoke', 'transfer_in', 'transfer_out', 'expiry')),
  amount BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  game_name TEXT,
  score INTEGER,
  multiplier NUMERIC(4,2) DEFAULT 1.0,
  idempotency_key TEXT UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create machine_ticket_config for admin-configurable payouts
CREATE TABLE public.machine_ticket_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.vendx_machines(id) ON DELETE CASCADE UNIQUE,
  base_payout INTEGER NOT NULL DEFAULT 1 CHECK (base_payout >= 0),
  max_payout INTEGER NOT NULL DEFAULT 1000 CHECK (max_payout >= base_payout),
  payout_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0 CHECK (payout_multiplier >= 0),
  jackpot_enabled BOOLEAN NOT NULL DEFAULT false,
  jackpot_amount INTEGER DEFAULT 500,
  jackpot_odds NUMERIC(6,4) DEFAULT 0.001,
  cooldown_seconds INTEGER DEFAULT 0,
  daily_limit_per_user INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_user_tickets_user_id ON public.user_tickets(user_id);
CREATE INDEX idx_ticket_transactions_user_id ON public.ticket_transactions(user_id);
CREATE INDEX idx_ticket_transactions_machine_id ON public.ticket_transactions(machine_id);
CREATE INDEX idx_ticket_transactions_session_id ON public.ticket_transactions(session_id);
CREATE INDEX idx_ticket_transactions_created_at ON public.ticket_transactions(created_at DESC);
CREATE INDEX idx_ticket_transactions_idempotency ON public.ticket_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_machine_ticket_config_machine_id ON public.machine_ticket_config(machine_id);

-- Enable RLS
ALTER TABLE public.user_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_ticket_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_tickets
CREATE POLICY "Users can view their own ticket balance"
ON public.user_tickets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage ticket balances"
ON public.user_tickets FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies for ticket_transactions
CREATE POLICY "Users can view their own ticket transactions"
ON public.ticket_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert ticket transactions"
ON public.ticket_transactions FOR INSERT
WITH CHECK (true);

-- RLS Policies for machine_ticket_config (admin only via has_role)
CREATE POLICY "Admins can manage machine ticket config"
ON public.machine_ticket_config FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Anyone can view active ticket configs"
ON public.machine_ticket_config FOR SELECT
USING (is_active = true);

-- Function to safely award tickets with idempotency
CREATE OR REPLACE FUNCTION public.award_tickets(
  p_user_id UUID,
  p_machine_id UUID,
  p_session_id UUID,
  p_amount BIGINT,
  p_game_name TEXT DEFAULT NULL,
  p_score INTEGER DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(success BOOLEAN, new_balance BIGINT, transaction_id UUID, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_tickets user_tickets%ROWTYPE;
  v_config machine_ticket_config%ROWTYPE;
  v_machine vendx_machines%ROWTYPE;
  v_new_balance BIGINT;
  v_transaction_id UUID;
  v_final_amount BIGINT;
  v_is_jackpot BOOLEAN := false;
  v_daily_earned BIGINT;
BEGIN
  -- Check idempotency first
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transaction_id FROM ticket_transactions WHERE idempotency_key = p_idempotency_key;
    IF v_transaction_id IS NOT NULL THEN
      SELECT ut.balance INTO v_new_balance FROM user_tickets ut WHERE ut.user_id = p_user_id;
      RETURN QUERY SELECT true, COALESCE(v_new_balance, 0::BIGINT), v_transaction_id, 'Already processed'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Validate machine exists and is active
  SELECT * INTO v_machine FROM vendx_machines WHERE id = p_machine_id AND status = 'active';
  IF v_machine.id IS NULL THEN
    RETURN QUERY SELECT false, 0::BIGINT, NULL::UUID, 'Invalid or inactive machine'::TEXT;
    RETURN;
  END IF;

  -- Get machine ticket config
  SELECT * INTO v_config FROM machine_ticket_config WHERE machine_id = p_machine_id AND is_active = true;
  
  -- Apply multiplier and caps from config
  v_final_amount := p_amount;
  IF v_config.id IS NOT NULL THEN
    v_final_amount := LEAST(
      GREATEST(v_config.base_payout, (p_amount * v_config.payout_multiplier)::BIGINT),
      v_config.max_payout
    );
    
    -- Check daily limit
    IF v_config.daily_limit_per_user IS NOT NULL THEN
      SELECT COALESCE(SUM(amount), 0) INTO v_daily_earned
      FROM ticket_transactions
      WHERE user_id = p_user_id
        AND machine_id = p_machine_id
        AND transaction_type = 'earn'
        AND created_at >= CURRENT_DATE;
      
      IF v_daily_earned + v_final_amount > v_config.daily_limit_per_user THEN
        v_final_amount := GREATEST(0, v_config.daily_limit_per_user - v_daily_earned);
        IF v_final_amount = 0 THEN
          RETURN QUERY SELECT false, 0::BIGINT, NULL::UUID, 'Daily limit reached'::TEXT;
          RETURN;
        END IF;
      END IF;
    END IF;
    
    -- Check for jackpot
    IF v_config.jackpot_enabled AND random() < v_config.jackpot_odds THEN
      v_final_amount := v_final_amount + COALESCE(v_config.jackpot_amount, 0);
      v_is_jackpot := true;
    END IF;
  END IF;

  -- Ensure amount is positive
  IF v_final_amount <= 0 THEN
    RETURN QUERY SELECT false, 0::BIGINT, NULL::UUID, 'Invalid amount'::TEXT;
    RETURN;
  END IF;

  -- Get or create user ticket balance
  SELECT * INTO v_user_tickets FROM user_tickets WHERE user_id = p_user_id FOR UPDATE;
  
  IF v_user_tickets.id IS NULL THEN
    INSERT INTO user_tickets (user_id, balance, lifetime_earned)
    VALUES (p_user_id, v_final_amount, v_final_amount)
    RETURNING * INTO v_user_tickets;
    v_new_balance := v_final_amount;
  ELSE
    v_new_balance := v_user_tickets.balance + v_final_amount;
    UPDATE user_tickets
    SET balance = v_new_balance,
        lifetime_earned = lifetime_earned + v_final_amount,
        updated_at = now()
    WHERE id = v_user_tickets.id;
  END IF;

  -- Record transaction
  INSERT INTO ticket_transactions (
    user_id, machine_id, session_id, location_id,
    transaction_type, amount, balance_after,
    game_name, score, multiplier, idempotency_key, metadata
  )
  VALUES (
    p_user_id, p_machine_id, p_session_id, v_machine.location_id,
    'earn', v_final_amount, v_new_balance,
    p_game_name, p_score, COALESCE(v_config.payout_multiplier, 1.0),
    p_idempotency_key,
    jsonb_build_object('is_jackpot', v_is_jackpot, 'original_amount', p_amount) || COALESCE(p_metadata, '{}')
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id, 
    CASE WHEN v_is_jackpot THEN 'JACKPOT!' ELSE 'Tickets awarded' END;
END;
$$;

-- Function to redeem tickets
CREATE OR REPLACE FUNCTION public.redeem_tickets(
  p_user_id UUID,
  p_amount BIGINT,
  p_reason TEXT DEFAULT 'Prize redemption',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(success BOOLEAN, new_balance BIGINT, transaction_id UUID, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_tickets user_tickets%ROWTYPE;
  v_new_balance BIGINT;
  v_transaction_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 0::BIGINT, NULL::UUID, 'Invalid amount'::TEXT;
    RETURN;
  END IF;

  -- Get user ticket balance with lock
  SELECT * INTO v_user_tickets FROM user_tickets WHERE user_id = p_user_id FOR UPDATE;
  
  IF v_user_tickets.id IS NULL OR v_user_tickets.balance < p_amount THEN
    RETURN QUERY SELECT false, COALESCE(v_user_tickets.balance, 0::BIGINT), NULL::UUID, 'Insufficient tickets'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_user_tickets.balance - p_amount;
  
  UPDATE user_tickets
  SET balance = v_new_balance,
      lifetime_redeemed = lifetime_redeemed + p_amount,
      updated_at = now()
  WHERE id = v_user_tickets.id;

  INSERT INTO ticket_transactions (
    user_id, transaction_type, amount, balance_after, metadata
  )
  VALUES (
    p_user_id, 'redeem', -p_amount, v_new_balance,
    jsonb_build_object('reason', p_reason) || COALESCE(p_metadata, '{}')
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id, 'Tickets redeemed'::TEXT;
END;
$$;

-- Trigger to update timestamps
CREATE TRIGGER update_user_tickets_updated_at
BEFORE UPDATE ON public.user_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_machine_ticket_config_updated_at
BEFORE UPDATE ON public.machine_ticket_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();