
-- Merchants table
CREATE TABLE public.vendx_merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL UNIQUE,
  api_key_prefix TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  allowed_return_domains TEXT[] NOT NULL DEFAULT '{}',
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  fee_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  contact_email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage merchants" ON public.vendx_merchants
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

CREATE TRIGGER vendx_merchants_updated_at
  BEFORE UPDATE ON public.vendx_merchants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payment sessions
CREATE TABLE public.vendx_merchant_payment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.vendx_merchants(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  order_reference TEXT,
  description TEXT,
  customer_email TEXT,
  return_url TEXT NOT NULL,
  cancel_url TEXT,
  webhook_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled','expired','failed')),
  user_id UUID,
  wallet_transaction_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_merchant_sessions_token ON public.vendx_merchant_payment_sessions(session_token);
CREATE INDEX idx_merchant_sessions_merchant ON public.vendx_merchant_payment_sessions(merchant_id, created_at DESC);
CREATE INDEX idx_merchant_sessions_user ON public.vendx_merchant_payment_sessions(user_id);
CREATE INDEX idx_merchant_sessions_status ON public.vendx_merchant_payment_sessions(status, expires_at);

ALTER TABLE public.vendx_merchant_payment_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own sessions" ON public.vendx_merchant_payment_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

CREATE POLICY "Admins manage sessions" ON public.vendx_merchant_payment_sessions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

CREATE TRIGGER vendx_merchant_sessions_updated_at
  BEFORE UPDATE ON public.vendx_merchant_payment_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Webhook deliveries
CREATE TABLE public.vendx_merchant_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.vendx_merchant_payment_sessions(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL DEFAULT 1,
  status_code INTEGER,
  response_body TEXT,
  error TEXT,
  delivered_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  succeeded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_session ON public.vendx_merchant_webhook_deliveries(session_id);
CREATE INDEX idx_webhook_deliveries_retry ON public.vendx_merchant_webhook_deliveries(next_retry_at) WHERE succeeded = false AND next_retry_at IS NOT NULL;

ALTER TABLE public.vendx_merchant_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view deliveries" ON public.vendx_merchant_webhook_deliveries
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

-- Function to create a merchant with generated key + secret (admin only)
CREATE OR REPLACE FUNCTION public.create_vendx_merchant(
  p_name TEXT,
  p_slug TEXT,
  p_allowed_return_domains TEXT[] DEFAULT '{}',
  p_logo_url TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL
) RETURNS TABLE(merchant_id UUID, api_key TEXT, webhook_secret TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_key TEXT;
  v_secret TEXT;
  v_id UUID;
BEGIN
  IF NOT (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_key := 'vxm_live_' || encode(extensions.gen_random_bytes(24), 'hex');
  v_secret := 'whsec_' || encode(extensions.gen_random_bytes(24), 'hex');

  INSERT INTO public.vendx_merchants (
    name, slug, api_key_hash, api_key_prefix, webhook_secret,
    allowed_return_domains, logo_url, contact_email
  ) VALUES (
    p_name, p_slug, public.hash_api_key(v_key), substring(v_key from 1 for 16),
    v_secret, COALESCE(p_allowed_return_domains,'{}'), p_logo_url, p_contact_email
  ) RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_key, v_secret;
END;
$$;

-- Rotate API key
CREATE OR REPLACE FUNCTION public.rotate_vendx_merchant_api_key(p_merchant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_key TEXT;
BEGIN
  IF NOT (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  v_key := 'vxm_live_' || encode(extensions.gen_random_bytes(24), 'hex');
  UPDATE public.vendx_merchants
    SET api_key_hash = public.hash_api_key(v_key),
        api_key_prefix = substring(v_key from 1 for 16),
        updated_at = now()
    WHERE id = p_merchant_id;
  RETURN v_key;
END;
$$;

-- Rotate webhook secret
CREATE OR REPLACE FUNCTION public.rotate_vendx_merchant_webhook_secret(p_merchant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_secret TEXT;
BEGIN
  IF NOT (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  v_secret := 'whsec_' || encode(extensions.gen_random_bytes(24), 'hex');
  UPDATE public.vendx_merchants
    SET webhook_secret = v_secret, updated_at = now()
    WHERE id = p_merchant_id;
  RETURN v_secret;
END;
$$;

-- Atomic debit-and-mark-paid (called by edge function as service role context)
CREATE OR REPLACE FUNCTION public.merchant_pay_with_wallet(
  p_session_token TEXT,
  p_user_id UUID
) RETURNS TABLE(success BOOLEAN, message TEXT, session_id UUID, return_url TEXT, new_balance NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session vendx_merchant_payment_sessions%ROWTYPE;
  v_merchant vendx_merchants%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_tx_id UUID;
  v_new_balance NUMERIC;
BEGIN
  SELECT * INTO v_session FROM vendx_merchant_payment_sessions
    WHERE session_token = p_session_token FOR UPDATE;
  IF v_session.id IS NULL THEN
    RETURN QUERY SELECT false, 'Session not found'::text, NULL::uuid, NULL::text, 0::numeric; RETURN;
  END IF;
  IF v_session.status <> 'pending' THEN
    RETURN QUERY SELECT false, ('Session is '||v_session.status)::text, v_session.id, v_session.return_url, 0::numeric; RETURN;
  END IF;
  IF v_session.expires_at < now() THEN
    UPDATE vendx_merchant_payment_sessions SET status='expired' WHERE id = v_session.id;
    RETURN QUERY SELECT false, 'Session expired'::text, v_session.id, v_session.return_url, 0::numeric; RETURN;
  END IF;

  SELECT * INTO v_merchant FROM vendx_merchants WHERE id = v_session.merchant_id;
  IF NOT v_merchant.is_active THEN
    RETURN QUERY SELECT false, 'Merchant inactive'::text, v_session.id, v_session.return_url, 0::numeric; RETURN;
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet.id IS NULL THEN
    RETURN QUERY SELECT false, 'Wallet not found'::text, v_session.id, v_session.return_url, 0::numeric; RETURN;
  END IF;
  IF v_wallet.balance < v_session.amount THEN
    RETURN QUERY SELECT false, 'Insufficient balance'::text, v_session.id, v_session.return_url, v_wallet.balance; RETURN;
  END IF;

  v_new_balance := v_wallet.balance - v_session.amount;
  UPDATE wallets SET balance = v_new_balance, updated_at = now() WHERE id = v_wallet.id;

  INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, description, metadata)
  VALUES (v_wallet.id, -v_session.amount, 'merchant_payment',
          'Payment to ' || v_merchant.name || COALESCE(' — '||v_session.order_reference, ''),
          jsonb_build_object('merchant_id', v_merchant.id, 'merchant_slug', v_merchant.slug,
                             'session_token', v_session.session_token,
                             'order_reference', v_session.order_reference))
  RETURNING id INTO v_tx_id;

  UPDATE vendx_merchant_payment_sessions
    SET status = 'paid', user_id = p_user_id, wallet_transaction_id = v_tx_id, paid_at = now()
    WHERE id = v_session.id;

  RETURN QUERY SELECT true, 'Payment successful'::text, v_session.id, v_session.return_url, v_new_balance;
END;
$$;
