CREATE OR REPLACE FUNCTION public.import_machine_revenue_to_income(p_from_date date, p_to_date date, p_account_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(imported_count integer, total_amount numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_total numeric := 0;
  v_eco_count integer := 0;
  v_eco_total numeric := 0;
BEGIN
  IF NOT (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- 1. Standard machine transactions
  WITH inserted AS (
    INSERT INTO public.finance_income (
      income_date, source, category, description, amount,
      reference_type, reference_id, external_reference,
      machine_id, location_id,
      deposited_to_account_id, payment_method, created_by
    )
    SELECT
      mt.created_at::date,
      'Machine: ' || COALESCE(vm.name, vm.machine_code, 'Unknown') || ' (' || COALESCE(vm.machine_type, 'machine') || ')',
      'machine_revenue',
      COALESCE(mt.item_name, 'Machine sale'),
      mt.amount,
      'machine_transaction',
      mt.id::text,
      mt.id::text,
      mt.machine_id,
      vm.location_id,
      p_account_id,
      'machine',
      auth.uid()
    FROM public.machine_transactions mt
    JOIN public.vendx_machines vm ON vm.id = mt.machine_id
    WHERE mt.created_at::date BETWEEN p_from_date AND p_to_date
      AND mt.amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.finance_income fi
        WHERE fi.reference_type = 'machine_transaction' AND fi.reference_id = mt.id::text
      )
    RETURNING amount
  )
  SELECT COUNT(*)::int, COALESCE(SUM(amount), 0) INTO v_count, v_total FROM inserted;

  -- 2. EcoVend / EcoSnack locker purchases
  WITH eco_inserted AS (
    INSERT INTO public.finance_income (
      income_date, source, category, description, amount,
      reference_type, reference_id, external_reference,
      machine_id, location_id,
      deposited_to_account_id, payment_method, created_by
    )
    SELECT
      elp.created_at::date,
      'EcoVend: ' || COALESCE(vm.name, elp.machine_code, 'Unknown'),
      'machine_revenue',
      COALESCE(elp.item_name, 'EcoVend purchase') || ' (Locker ' || elp.locker_number || ')',
      elp.amount,
      'ecosnack_locker_purchase',
      elp.id::text,
      COALESCE(elp.stripe_session_id, elp.id::text),
      elp.machine_id,
      vm.location_id,
      p_account_id,
      COALESCE(elp.payment_method, 'card'),
      auth.uid()
    FROM public.ecosnack_locker_purchases elp
    LEFT JOIN public.vendx_machines vm ON vm.id = elp.machine_id
    WHERE elp.created_at::date BETWEEN p_from_date AND p_to_date
      AND elp.amount > 0
      AND elp.payment_status IN ('paid', 'completed', 'succeeded')
      AND NOT EXISTS (
        SELECT 1 FROM public.finance_income fi
        WHERE fi.reference_type = 'ecosnack_locker_purchase' AND fi.reference_id = elp.id::text
      )
    RETURNING amount
  )
  SELECT COUNT(*)::int, COALESCE(SUM(amount), 0) INTO v_eco_count, v_eco_total FROM eco_inserted;

  RETURN QUERY SELECT (v_count + v_eco_count), (v_total + v_eco_total);
END;
$function$;