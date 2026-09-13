-- 1. Quest completion rewards must be computed server-side
DROP POLICY IF EXISTS "Users can create own completions" ON public.quest_completions;
CREATE POLICY "Users can start own completions"
ON public.quest_completions FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND COALESCE(xp_earned, 0) = 0
  AND COALESCE(credits_earned, 0) = 0
  AND COALESCE(points_earned, 0) = 0
  AND status = 'in_progress'::quest_completion_status
);

CREATE OR REPLACE FUNCTION public.quest_finalize_completion(p_completion_id uuid)
RETURNS TABLE(xp_earned integer, credits_earned numeric, points_earned integer, new_level integer, leveled_up boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_comp public.quest_completions%ROWTYPE;
  v_quest public.quests%ROWTYPE;
  v_prog public.quest_player_progress%ROWTYPE;
  v_xp int; v_credits numeric; v_points int;
  v_new_xp int; v_new_level int; v_prev_level int; v_streak int; v_days int;
  v_today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_comp FROM public.quest_completions WHERE id = p_completion_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Completion not found'; END IF;
  IF v_comp.status <> 'in_progress'::quest_completion_status THEN
    RAISE EXCEPTION 'Quest already finalized';
  END IF;

  SELECT * INTO v_quest FROM public.quests WHERE id = v_comp.quest_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quest not found'; END IF;

  v_xp := COALESCE(v_quest.xp_reward, 0);
  v_credits := COALESCE(v_quest.credits_reward, 0);
  v_points := COALESCE(v_quest.points_reward, 0);

  UPDATE public.quest_completions
     SET status = 'completed'::quest_completion_status,
         completed_at = now(),
         xp_earned = v_xp,
         credits_earned = v_credits,
         points_earned = v_points
   WHERE id = p_completion_id;

  SELECT * INTO v_prog FROM public.quest_player_progress WHERE user_id = v_uid;
  IF NOT FOUND THEN
    INSERT INTO public.quest_player_progress (user_id) VALUES (v_uid);
    SELECT * INTO v_prog FROM public.quest_player_progress WHERE user_id = v_uid;
  END IF;

  v_prev_level := COALESCE(v_prog.current_level, 1);
  v_new_xp := COALESCE(v_prog.total_xp, 0) + v_xp;
  v_new_level := GREATEST(1, FLOOR(SQRT(v_new_xp::numeric / 100))::int + 1);

  v_streak := COALESCE(v_prog.current_streak, 0);
  IF v_prog.last_quest_date IS NULL THEN
    v_streak := 1;
  ELSE
    v_days := v_today - v_prog.last_quest_date;
    IF v_days = 1 THEN v_streak := v_streak + 1;
    ELSIF v_days > 1 THEN v_streak := 1;
    ELSIF v_streak = 0 THEN v_streak := 1;
    END IF;
  END IF;

  UPDATE public.quest_player_progress
     SET total_xp = v_new_xp,
         current_level = v_new_level,
         quests_completed = COALESCE(quests_completed, 0) + 1,
         current_streak = v_streak,
         longest_streak = GREATEST(COALESCE(longest_streak, 0), v_streak),
         last_quest_date = v_today,
         total_credits_earned = COALESCE(total_credits_earned, 0) + v_credits,
         total_points_earned = COALESCE(total_points_earned, 0) + v_points,
         updated_at = now()
   WHERE user_id = v_uid;

  IF v_comp.node_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.quest_node_discoveries WHERE user_id = v_uid AND node_id = v_comp.node_id) THEN
      UPDATE public.quest_node_discoveries
         SET last_visited_at = now(), visit_count = COALESCE(visit_count, 0) + 1
       WHERE user_id = v_uid AND node_id = v_comp.node_id;
    ELSE
      INSERT INTO public.quest_node_discoveries (user_id, node_id, last_visited_at, visit_count)
      VALUES (v_uid, v_comp.node_id, now(), 1);
      UPDATE public.quest_player_progress
         SET nodes_discovered = COALESCE(nodes_discovered, 0) + 1
       WHERE user_id = v_uid;
    END IF;
  END IF;

  UPDATE public.quests SET current_completions = COALESCE(current_completions, 0) + 1 WHERE id = v_quest.id;

  RETURN QUERY SELECT v_xp, v_credits, v_points, v_new_level, (v_new_level > v_prev_level);
END;
$$;

REVOKE ALL ON FUNCTION public.quest_finalize_completion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quest_finalize_completion(uuid) TO authenticated;

-- 2. Chain bonus claims: no direct inserts
DROP POLICY IF EXISTS "Users can insert their own chain claims" ON public.quest_chain_claims;
REVOKE INSERT, UPDATE, DELETE ON public.quest_chain_claims FROM authenticated;

CREATE OR REPLACE FUNCTION public.quest_claim_chain_bonus(p_chain_id uuid)
RETURNS TABLE(awarded boolean, chain_name text, bonus_xp integer, bonus_credits numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_chain public.quest_chains%ROWTYPE;
  v_total int; v_done int;
  v_xp int; v_credits numeric;
  v_new_xp int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_chain FROM public.quest_chains WHERE id = p_chain_id AND is_active = true;
  IF NOT FOUND THEN RETURN QUERY SELECT false, NULL::text, 0, 0::numeric; RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.quest_chain_claims WHERE user_id = v_uid AND chain_id = p_chain_id) THEN
    RETURN QUERY SELECT false, v_chain.name, 0, 0::numeric; RETURN;
  END IF;

  SELECT count(*) INTO v_total FROM public.quest_chain_steps WHERE chain_id = p_chain_id;
  SELECT count(DISTINCT s.quest_id) INTO v_done
    FROM public.quest_chain_steps s
    JOIN public.quest_completions c
      ON c.quest_id = s.quest_id
     AND c.user_id = v_uid
     AND c.status IN ('completed'::quest_completion_status, 'claimed'::quest_completion_status)
   WHERE s.chain_id = p_chain_id;

  IF v_total = 0 OR v_done < v_total THEN
    RETURN QUERY SELECT false, v_chain.name, 0, 0::numeric; RETURN;
  END IF;

  v_xp := COALESCE(v_chain.bonus_xp, 0);
  v_credits := COALESCE(v_chain.bonus_credits, 0);

  INSERT INTO public.quest_chain_claims (user_id, chain_id, bonus_xp_awarded, bonus_credits_awarded)
  VALUES (v_uid, p_chain_id, v_xp, v_credits);

  IF v_xp > 0 THEN
    UPDATE public.quest_player_progress
       SET total_xp = COALESCE(total_xp, 0) + v_xp,
           current_level = GREATEST(1, FLOOR(SQRT((COALESCE(total_xp, 0) + v_xp)::numeric / 100))::int + 1),
           updated_at = now()
     WHERE user_id = v_uid;
  END IF;

  IF v_credits > 0 THEN
    UPDATE public.wallets
       SET balance = COALESCE(balance, 0) + v_credits
     WHERE id = (
       SELECT id FROM public.wallets
        WHERE user_id = v_uid AND wallet_type IN ('standard','guest') AND parent_wallet_id IS NULL
        LIMIT 1
     );

    INSERT INTO public.wallet_transactions (wallet_id, amount, transaction_type, description)
    SELECT id, v_credits, 'chain_bonus', 'Chain bonus: ' || v_chain.name
      FROM public.wallets
     WHERE user_id = v_uid AND wallet_type IN ('standard','guest') AND parent_wallet_id IS NULL
     LIMIT 1;
  END IF;

  RETURN QUERY SELECT true, v_chain.name, v_xp, v_credits;
END;
$$;

REVOKE ALL ON FUNCTION public.quest_claim_chain_bonus(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quest_claim_chain_bonus(uuid) TO authenticated;

-- 3. Daily challenge claims: server computes XP
DROP POLICY IF EXISTS "Users can insert their own daily claims" ON public.quest_daily_claims;
DROP POLICY IF EXISTS "Users can update their own daily claims" ON public.quest_daily_claims;
REVOKE INSERT, UPDATE, DELETE ON public.quest_daily_claims FROM authenticated;

CREATE OR REPLACE FUNCTION public.quest_claim_daily_challenges()
RETURNS TABLE(challenges_completed text[], total_bonus_xp integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_claimed text[] := '{}';
  v_new text[] := '{}';
  v_quests int; v_nodes int; v_streak int;
  v_xp int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT COALESCE(challenges_claimed, '{}') INTO v_claimed
    FROM public.quest_daily_claims WHERE user_id = v_uid AND claim_date = v_today;

  SELECT count(*), count(DISTINCT node_id)
    INTO v_quests, v_nodes
    FROM public.quest_completions
   WHERE user_id = v_uid
     AND completed_at >= v_today::timestamptz
     AND status IN ('completed'::quest_completion_status, 'claimed'::quest_completion_status);

  SELECT COALESCE(current_streak, 0) INTO v_streak
    FROM public.quest_player_progress WHERE user_id = v_uid;

  IF v_quests >= 1 AND NOT ('daily-quest-1' = ANY(COALESCE(v_claimed,'{}'))) THEN
    v_new := v_new || 'daily-quest-1'; v_xp := v_xp + 50;
  END IF;
  IF v_quests >= 3 AND NOT ('daily-quest-3' = ANY(COALESCE(v_claimed,'{}'))) THEN
    v_new := v_new || 'daily-quest-3'; v_xp := v_xp + 150;
  END IF;
  IF v_nodes >= 2 AND NOT ('daily-explore-2' = ANY(COALESCE(v_claimed,'{}'))) THEN
    v_new := v_new || 'daily-explore-2'; v_xp := v_xp + 100;
  END IF;
  IF COALESCE(v_streak,0) > 0 AND NOT ('daily-streak' = ANY(COALESCE(v_claimed,'{}'))) THEN
    v_new := v_new || 'daily-streak'; v_xp := v_xp + 50;
  END IF;

  IF array_length(v_new, 1) IS NULL THEN
    RETURN QUERY SELECT '{}'::text[], 0; RETURN;
  END IF;

  INSERT INTO public.quest_daily_claims (user_id, claim_date, challenges_claimed, total_xp_awarded)
  VALUES (v_uid, v_today, COALESCE(v_claimed,'{}') || v_new, v_xp)
  ON CONFLICT (user_id, claim_date) DO UPDATE
    SET challenges_claimed = COALESCE(public.quest_daily_claims.challenges_claimed,'{}') || v_new,
        total_xp_awarded = COALESCE(public.quest_daily_claims.total_xp_awarded, 0) + v_xp;

  UPDATE public.quest_player_progress
     SET total_xp = COALESCE(total_xp, 0) + v_xp,
         current_level = GREATEST(1, FLOOR(SQRT((COALESCE(total_xp, 0) + v_xp)::numeric / 100))::int + 1),
         updated_at = now()
   WHERE user_id = v_uid;

  RETURN QUERY SELECT v_new, v_xp;
END;
$$;

REVOKE ALL ON FUNCTION public.quest_claim_daily_challenges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quest_claim_daily_challenges() TO authenticated;