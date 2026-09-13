-- quest_player_progress: client inserts must be zeroed defaults only
DROP POLICY IF EXISTS "Users can insert own progress" ON public.quest_player_progress;
CREATE POLICY "Users can initialize own progress"
ON public.quest_player_progress FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND COALESCE(total_xp, 0) = 0
  AND COALESCE(current_level, 1) <= 1
  AND COALESCE(quests_completed, 0) = 0
  AND COALESCE(nodes_discovered, 0) = 0
  AND COALESCE(total_credits_earned, 0) = 0
  AND COALESCE(total_points_earned, 0) = 0
);

-- rewards_points: no client-side inserts (rows created by triggers/service role only)
DROP POLICY IF EXISTS "System can insert points" ON public.rewards_points;

-- wallet_transactions: clients may only log debits; credits go through a guarded RPC
DROP POLICY IF EXISTS "Users can insert own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users can insert own wallet debits"
ON public.wallet_transactions FOR INSERT TO authenticated
WITH CHECK (
  amount < 0
  AND EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_id AND w.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.wallet_log_credit(p_wallet_id uuid, p_amount numeric, p_type text, p_description text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_type NOT IN ('transfer_in','reclaim_in','quest_reward','chain_bonus','reward_credit') THEN
    RAISE EXCEPTION 'Invalid credit type';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM wallets w WHERE w.id = p_wallet_id AND w.user_id = auth.uid())
     AND NOT EXISTS (SELECT 1 FROM wallets cw JOIN wallets pw ON pw.id = cw.parent_wallet_id WHERE cw.id = p_wallet_id AND pw.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Wallet not found or not authorized';
  END IF;
  INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, description)
  VALUES (p_wallet_id, p_amount, p_type, p_description);
END;
$$;
GRANT EXECUTE ON FUNCTION public.wallet_log_credit(uuid, numeric, text, text) TO authenticated;