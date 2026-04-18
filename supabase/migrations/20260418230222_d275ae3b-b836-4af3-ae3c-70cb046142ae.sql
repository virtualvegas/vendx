
-- Re-create with explicit search_path (already had it, but linter flagged - ensure)
CREATE OR REPLACE FUNCTION public.post_income_to_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.deposited_to_account_id IS NOT NULL AND NEW.amount > 0 THEN
    INSERT INTO public.finance_account_transactions (
      account_id, amount, direction, category, description,
      reference_type, reference_id, created_by, transaction_date
    ) VALUES (
      NEW.deposited_to_account_id, ABS(NEW.amount), 'in',
      NEW.category, COALESCE(NEW.source || ' — ' || COALESCE(NEW.description, ''), 'Income'),
      'income', NEW.id::text, NEW.created_by, NEW.income_date::timestamptz
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_machine_revenue_to_income(
  p_from_date date,
  p_to_date date,
  p_account_id uuid DEFAULT NULL
)
RETURNS TABLE(imported_count integer, total_amount numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_count integer := 0;
  v_total numeric := 0;
BEGIN
  IF NOT (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH inserted AS (
    INSERT INTO public.finance_income (
      income_date, source, category, description, amount,
      reference_type, reference_id, machine_id, location_id,
      deposited_to_account_id, payment_method, created_by
    )
    SELECT
      mt.created_at::date,
      'Machine: ' || COALESCE(vm.name, vm.machine_code, 'Unknown'),
      'machine_revenue',
      COALESCE(mt.item_name, 'Machine sale'),
      mt.amount,
      'machine_transaction',
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

  RETURN QUERY SELECT v_count, v_total;
END;
$$;
