
CREATE OR REPLACE FUNCTION public.merchant_pay_with_wallet(p_session_token text, p_user_id uuid)
RETURNS TABLE(success boolean, message text, session_id uuid, return_url text, new_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, description, reference_id, status)
  VALUES (v_wallet.id, -v_session.amount, 'merchant_payment',
          'Payment to ' || v_merchant.name || COALESCE(' — '||v_session.order_reference, ''),
          v_session.session_token,
          'completed')
  RETURNING id INTO v_tx_id;

  UPDATE vendx_merchant_payment_sessions
    SET status = 'paid', user_id = p_user_id, wallet_transaction_id = v_tx_id, paid_at = now()
    WHERE id = v_session.id;

  RETURN QUERY SELECT true, 'Payment successful'::text, v_session.id, v_session.return_url, v_new_balance;
END;
$function$;
