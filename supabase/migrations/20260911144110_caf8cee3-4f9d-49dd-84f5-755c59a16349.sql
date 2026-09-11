
-- 1) Canonicalize POS source to paypal_zettle
UPDATE public.vendx_pos_receipts SET source = 'paypal_zettle' WHERE source = 'loyverse';
UPDATE public.vendx_pos_stores SET source = 'paypal_zettle' WHERE source = 'loyverse';
UPDATE public.vendx_pos_revenue_config SET source = 'paypal_zettle' WHERE source = 'loyverse';

-- 2) Phone normalizer
CREATE OR REPLACE FUNCTION public.normalize_phone_digits(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p IS NULL THEN NULL
    WHEN length(regexp_replace(p, '\D', '', 'g')) >= 7
      THEN right(regexp_replace(p, '\D', '', 'g'), 10)
    ELSE NULL
  END;
$$;

-- 3) Make point awarding idempotent per receipt
CREATE OR REPLACE FUNCTION public.award_pos_points(p_user_id uuid, p_source text, p_amount numeric, p_receipt_id uuid, p_description text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg vendx_rewards_config%ROWTYPE;
  v_tier text;
  v_mult numeric := 1;
  v_points integer := 0;
  v_rp rewards_points%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN 0;
  END IF;

  -- Idempotency: never award twice for the same receipt
  IF p_receipt_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM point_transactions
    WHERE reference_id = p_receipt_id
      AND transaction_type = p_source || '_earn'
  ) THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_cfg FROM vendx_rewards_config WHERE source = p_source AND is_active = true;
  IF v_cfg.id IS NULL THEN RETURN 0; END IF;

  SELECT * INTO v_rp FROM rewards_points WHERE user_id = p_user_id FOR UPDATE;
  IF v_rp.id IS NULL THEN
    INSERT INTO rewards_points (user_id, balance, lifetime_points, tier)
    VALUES (p_user_id, 0, 0, 'bronze') RETURNING * INTO v_rp;
  END IF;

  v_tier := COALESCE(v_rp.tier, 'bronze');
  v_mult := CASE v_tier
    WHEN 'platinum' THEN v_cfg.platinum_multiplier
    WHEN 'gold' THEN v_cfg.gold_multiplier
    WHEN 'silver' THEN v_cfg.silver_multiplier
    ELSE v_cfg.bronze_multiplier
  END;

  v_points := FLOOR(p_amount * v_cfg.points_per_dollar * v_mult)::integer;
  IF v_points <= 0 THEN RETURN 0; END IF;

  UPDATE rewards_points
  SET balance = balance + v_points,
      lifetime_points = lifetime_points + v_points,
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO point_transactions (user_id, points, transaction_type, description, reference_id)
  VALUES (p_user_id, v_points, p_source || '_earn',
          COALESCE(p_description, v_cfg.display_name || ' purchase'),
          p_receipt_id);

  RETURN v_points;
END;
$function$;

-- 4) Match a single receipt to a customer (auto by email/phone) + award points + apply register mapping
CREATE OR REPLACE FUNCTION public.match_and_award_pos_receipt(p_receipt_id uuid, p_user_id uuid DEFAULT NULL, p_matched_by text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r vendx_pos_receipts%ROWTYPE;
  v_user uuid := p_user_id;
  v_by text := p_matched_by;
  v_points integer := 0;
  v_store vendx_pos_stores%ROWTYPE;
BEGIN
  SELECT * INTO r FROM vendx_pos_receipts WHERE id = p_receipt_id;
  IF r.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'receipt not found');
  END IF;

  -- Manual linking requires an authenticated privileged actor
  IF p_user_id IS NOT NULL AND auth.uid() IS NOT NULL
     AND NOT (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'global_operations_manager')
              OR has_role(auth.uid(), 'finance_accounting') OR has_role(auth.uid(), 'marketing_sales')
              OR has_role(auth.uid(), 'support')) THEN
    RAISE EXCEPTION 'Not authorized to link POS receipts';
  END IF;

  IF v_user IS NULL THEN
    v_user := r.user_id;
    v_by := r.matched_by;
  ELSE
    v_by := COALESCE(v_by, 'manual');
  END IF;

  -- Auto-match by email then phone
  IF v_user IS NULL AND r.pos_customer_email IS NOT NULL THEN
    SELECT id INTO v_user FROM profiles
    WHERE lower(email) = lower(r.pos_customer_email) LIMIT 1;
    IF v_user IS NOT NULL THEN v_by := 'email'; END IF;
  END IF;

  IF v_user IS NULL AND normalize_phone_digits(r.pos_customer_phone) IS NOT NULL THEN
    SELECT id INTO v_user FROM profiles
    WHERE normalize_phone_digits(phone) = normalize_phone_digits(r.pos_customer_phone) LIMIT 1;
    IF v_user IS NOT NULL THEN v_by := 'phone'; END IF;
  END IF;

  -- Register mapping (source agnostic: match on register/store id)
  IF r.pos_store_id IS NOT NULL AND (r.location_id IS NULL AND r.stand_id IS NULL) THEN
    SELECT * INTO v_store FROM vendx_pos_stores
    WHERE pos_store_id = r.pos_store_id AND is_active = true
    ORDER BY (source = r.source) DESC LIMIT 1;
  END IF;

  UPDATE vendx_pos_receipts
  SET user_id = COALESCE(v_user, user_id),
      matched_by = COALESCE(v_by, matched_by),
      location_id = COALESCE(v_store.location_id, location_id),
      stand_id = COALESCE(v_store.stand_id, stand_id)
  WHERE id = r.id;

  IF v_user IS NOT NULL AND COALESCE(r.total_amount, 0) > 0 THEN
    v_points := award_pos_points(v_user, 'pos', r.total_amount, r.id,
      'POS receipt ' || COALESCE(r.receipt_number, r.external_id));
    IF v_points > 0 THEN
      UPDATE vendx_pos_receipts SET points_earned = COALESCE(points_earned, 0) + v_points WHERE id = r.id;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'matched', v_user IS NOT NULL, 'matched_by', v_by, 'points', v_points);
END;
$$;

-- 5) Bulk re-match of unmatched receipts
CREATE OR REPLACE FUNCTION public.rematch_pos_receipts(p_limit integer DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  v_res jsonb;
  v_matched integer := 0;
  v_points integer := 0;
  v_scanned integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (
      has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'global_operations_manager')
      OR has_role(auth.uid(), 'finance_accounting') OR has_role(auth.uid(), 'marketing_sales')
      OR has_role(auth.uid(), 'support')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR rec IN
    SELECT id FROM vendx_pos_receipts
    WHERE user_id IS NULL
      AND (pos_customer_email IS NOT NULL OR pos_customer_phone IS NOT NULL)
    ORDER BY receipt_date DESC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_scanned := v_scanned + 1;
    v_res := match_and_award_pos_receipt(rec.id);
    IF (v_res->>'matched')::boolean THEN
      v_matched := v_matched + 1;
      v_points := v_points + COALESCE((v_res->>'points')::integer, 0);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('scanned', v_scanned, 'matched', v_matched, 'points', v_points);
END;
$$;

REVOKE ALL ON FUNCTION public.match_and_award_pos_receipt(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rematch_pos_receipts(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_and_award_pos_receipt(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rematch_pos_receipts(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_phone_digits(text) TO authenticated, service_role;
