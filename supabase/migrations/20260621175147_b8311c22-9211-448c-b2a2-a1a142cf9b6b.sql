
CREATE OR REPLACE FUNCTION public.import_machine_revenue_to_income(
  p_from_date date,
  p_to_date date,
  p_account_id uuid DEFAULT NULL
)
RETURNS TABLE(imported_count integer, total_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_total numeric := 0;
  v_n integer; v_t numeric;
BEGIN
  IF NOT (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- 1. Machine transactions
  WITH inserted AS (
    INSERT INTO public.finance_income (
      income_date, source, category, description, amount,
      reference_type, reference_id, external_reference,
      machine_id, location_id, deposited_to_account_id, payment_method, created_by
    )
    SELECT mt.created_at::date,
      'Machine: ' || COALESCE(vm.name, vm.machine_code, 'Unknown'),
      'machine_revenue', COALESCE(mt.item_name, 'Machine sale'), mt.amount,
      'machine_transaction', mt.id::text, mt.id::text,
      mt.machine_id, vm.location_id, p_account_id, 'machine', auth.uid()
    FROM public.machine_transactions mt
    JOIN public.vendx_machines vm ON vm.id = mt.machine_id
    WHERE mt.created_at::date BETWEEN p_from_date AND p_to_date
      AND mt.amount > 0
      AND NOT EXISTS (SELECT 1 FROM public.finance_income fi
        WHERE fi.reference_type='machine_transaction' AND fi.reference_id=mt.id::text)
    RETURNING amount
  ) SELECT COUNT(*)::int, COALESCE(SUM(amount),0) INTO v_n, v_t FROM inserted;
  v_count := v_count + v_n; v_total := v_total + v_t;

  -- 2. EcoSnack locker purchases
  WITH eco AS (
    INSERT INTO public.finance_income (
      income_date, source, category, description, amount,
      reference_type, reference_id, external_reference,
      machine_id, location_id, deposited_to_account_id, payment_method, created_by
    )
    SELECT elp.created_at::date,
      'EcoVend: ' || COALESCE(vm.name, elp.machine_code, 'Unknown'),
      'machine_revenue',
      COALESCE(elp.item_name,'EcoVend purchase') || ' (Locker ' || elp.locker_number || ')',
      elp.amount, 'ecosnack_locker_purchase', elp.id::text,
      COALESCE(elp.stripe_session_id, elp.id::text),
      elp.machine_id, vm.location_id, p_account_id,
      COALESCE(elp.payment_method,'card'), auth.uid()
    FROM public.ecosnack_locker_purchases elp
    LEFT JOIN public.vendx_machines vm ON vm.id = elp.machine_id
    WHERE elp.created_at::date BETWEEN p_from_date AND p_to_date
      AND elp.amount > 0
      AND elp.payment_status IN ('paid','completed','succeeded')
      AND NOT EXISTS (SELECT 1 FROM public.finance_income fi
        WHERE fi.reference_type='ecosnack_locker_purchase' AND fi.reference_id=elp.id::text)
    RETURNING amount
  ) SELECT COUNT(*)::int, COALESCE(SUM(amount),0) INTO v_n, v_t FROM eco;
  v_count := v_count + v_n; v_total := v_total + v_t;

  -- 3. POS receipts (Loyverse / retail stands)
  WITH pos AS (
    INSERT INTO public.finance_income (
      income_date, source, category, description, amount,
      reference_type, reference_id, external_reference,
      location_id, stand_id, deposited_to_account_id, payment_method, created_by
    )
    SELECT pr.receipt_date::date,
      'POS: ' || COALESCE(pr.store_name, pr.source, 'Retail'),
      'store_sales',
      'Receipt ' || COALESCE(pr.receipt_number, pr.id::text),
      pr.total_amount, 'pos_receipt', pr.id::text,
      COALESCE(pr.external_id, pr.receipt_number, pr.id::text),
      pr.location_id, pr.stand_id, p_account_id,
      COALESCE(pr.payment_method,'card'), auth.uid()
    FROM public.vendx_pos_receipts pr
    WHERE pr.receipt_date::date BETWEEN p_from_date AND p_to_date
      AND COALESCE(pr.total_amount,0) > 0
      AND NOT EXISTS (SELECT 1 FROM public.finance_income fi
        WHERE fi.reference_type='pos_receipt' AND fi.reference_id=pr.id::text)
    RETURNING amount
  ) SELECT COUNT(*)::int, COALESCE(SUM(amount),0) INTO v_n, v_t FROM pos;
  v_count := v_count + v_n; v_total := v_total + v_t;

  -- 4. Arcade play sessions (only card/cash, not wallet — wallet loads handled separately)
  WITH arc AS (
    INSERT INTO public.finance_income (
      income_date, source, category, description, amount,
      reference_type, reference_id, external_reference,
      machine_id, location_id, deposited_to_account_id, payment_method, created_by
    )
    SELECT aps.created_at::date,
      'Arcade: ' || COALESCE(vm.name, vm.machine_code, 'Machine'),
      'machine_revenue',
      aps.plays_purchased || ' plays (' || COALESCE(aps.pricing_type,'single') || ')',
      aps.amount, 'arcade_play_session', aps.id::text, aps.id::text,
      aps.machine_id, vm.location_id, p_account_id,
      COALESCE(aps.payment_method,'card'), auth.uid()
    FROM public.arcade_play_sessions aps
    LEFT JOIN public.vendx_machines vm ON vm.id = aps.machine_id
    WHERE aps.created_at::date BETWEEN p_from_date AND p_to_date
      AND aps.amount > 0
      AND COALESCE(aps.payment_method,'') NOT IN ('wallet','vendx_pay')
      AND NOT EXISTS (SELECT 1 FROM public.finance_income fi
        WHERE fi.reference_type='arcade_play_session' AND fi.reference_id=aps.id::text)
    RETURNING amount
  ) SELECT COUNT(*)::int, COALESCE(SUM(amount),0) INTO v_n, v_t FROM arc;
  v_count := v_count + v_n; v_total := v_total + v_t;

  -- 5. Paid store orders
  WITH so AS (
    INSERT INTO public.finance_income (
      income_date, source, category, description, amount,
      reference_type, reference_id, external_reference,
      deposited_to_account_id, payment_method, created_by
    )
    SELECT o.created_at::date,
      'Store Order: ' || COALESCE(o.customer_name, o.customer_email, 'Customer'),
      'store_sales',
      'Order ' || COALESCE(o.order_number, o.id::text),
      o.total, 'store_order', o.id::text,
      COALESCE(o.order_number, o.stripe_payment_intent_id, o.paypal_order_id, o.id::text),
      p_account_id, COALESCE(o.payment_method,'card'), auth.uid()
    FROM public.store_orders o
    WHERE o.created_at::date BETWEEN p_from_date AND p_to_date
      AND COALESCE(o.total,0) > 0
      AND o.status IN ('paid','completed','fulfilled','shipped','delivered')
      AND NOT EXISTS (SELECT 1 FROM public.finance_income fi
        WHERE fi.reference_type='store_order' AND fi.reference_id=o.id::text)
    RETURNING amount
  ) SELECT COUNT(*)::int, COALESCE(SUM(amount),0) INTO v_n, v_t FROM so;
  v_count := v_count + v_n; v_total := v_total + v_t;

  -- 6. Beat purchases
  WITH bp AS (
    INSERT INTO public.finance_income (
      income_date, source, category, description, amount,
      reference_type, reference_id, external_reference,
      deposited_to_account_id, payment_method, created_by
    )
    SELECT b.created_at::date,
      'Beat: ' || COALESCE(bt.title, 'Track'),
      'store_sales',
      'Beat purchase by ' || COALESCE(b.buyer_email,'customer'),
      b.amount, 'beat_purchase', b.id::text, b.id::text,
      p_account_id, 'card', auth.uid()
    FROM public.beat_purchases b
    LEFT JOIN public.beat_tracks bt ON bt.id = b.beat_id
    WHERE b.created_at::date BETWEEN p_from_date AND p_to_date
      AND COALESCE(b.amount,0) > 0
      AND b.payment_status IN ('paid','completed','succeeded')
      AND NOT EXISTS (SELECT 1 FROM public.finance_income fi
        WHERE fi.reference_type='beat_purchase' AND fi.reference_id=b.id::text)
    RETURNING amount
  ) SELECT COUNT(*)::int, COALESCE(SUM(amount),0) INTO v_n, v_t FROM bp;
  v_count := v_count + v_n; v_total := v_total + v_t;

  RETURN QUERY SELECT v_count, v_total;
END;
$$;
