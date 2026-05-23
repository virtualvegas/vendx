
-- Rewards config (per-source earn rates + tier multipliers)
CREATE TABLE public.vendx_rewards_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL UNIQUE,
  display_name text NOT NULL,
  points_per_dollar numeric NOT NULL DEFAULT 1,
  bronze_multiplier numeric NOT NULL DEFAULT 1.0,
  silver_multiplier numeric NOT NULL DEFAULT 1.2,
  gold_multiplier numeric NOT NULL DEFAULT 1.5,
  platinum_multiplier numeric NOT NULL DEFAULT 2.0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_rewards_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active rewards config"
  ON public.vendx_rewards_config FOR SELECT TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales'));

CREATE POLICY "Admins manage rewards config"
  ON public.vendx_rewards_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales'))
  WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales'));

CREATE TRIGGER trg_rewards_config_updated_at
  BEFORE UPDATE ON public.vendx_rewards_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.vendx_rewards_config (source, display_name, points_per_dollar, notes) VALUES
  ('pos', 'In-Store POS (Loyverse)', 1, 'Points earned at physical point-of-sale via Loyverse'),
  ('store', 'Online Store', 1, 'VendX online store purchases'),
  ('machine', 'Vending Machine', 1, 'Vending machine purchases'),
  ('arcade', 'Arcade Play', 2, 'Per arcade play'),
  ('snack_box', 'Snack-in-the-Box', 1, 'Subscription box purchases');

-- POS receipts
CREATE TABLE public.vendx_pos_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  external_id text NOT NULL UNIQUE,
  receipt_number text,
  source text NOT NULL DEFAULT 'loyverse',
  store_name text,
  pos_customer_id text,
  pos_customer_email text,
  pos_customer_phone text,
  pos_customer_name text,
  matched_by text,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_total numeric NOT NULL DEFAULT 0,
  discount_total numeric NOT NULL DEFAULT 0,
  tip_total numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  payment_method text,
  points_earned integer NOT NULL DEFAULT 0,
  receipt_date timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pos_receipts_user ON public.vendx_pos_receipts(user_id, receipt_date DESC);
CREATE INDEX idx_pos_receipts_date ON public.vendx_pos_receipts(receipt_date DESC);

ALTER TABLE public.vendx_pos_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own POS receipts"
  ON public.vendx_pos_receipts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all POS receipts"
  ON public.vendx_pos_receipts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales') OR has_role(auth.uid(), 'finance_accounting'));

CREATE POLICY "Admins manage POS receipts"
  ON public.vendx_pos_receipts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'))
  WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));

-- POS receipt line items
CREATE TABLE public.vendx_pos_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.vendx_pos_receipts(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  sku text,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pos_receipt_items_receipt ON public.vendx_pos_receipt_items(receipt_id);

ALTER TABLE public.vendx_pos_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own POS items"
  ON public.vendx_pos_receipt_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendx_pos_receipts r WHERE r.id = receipt_id AND r.user_id = auth.uid()));

CREATE POLICY "Admins view all POS items"
  ON public.vendx_pos_receipt_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales') OR has_role(auth.uid(), 'finance_accounting'));

CREATE POLICY "Admins manage POS items"
  ON public.vendx_pos_receipt_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'))
  WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));

-- RPC: award POS points (used by edge function with service role)
CREATE OR REPLACE FUNCTION public.award_pos_points(
  p_user_id uuid,
  p_source text,
  p_amount numeric,
  p_receipt_id uuid,
  p_description text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;
