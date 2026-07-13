CREATE OR REPLACE FUNCTION public.post_income_to_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.deposited_to_account_id IS NOT NULL AND NEW.amount > 0 THEN
    INSERT INTO public.finance_account_transactions (
      account_id, amount, direction, category, description,
      reference_type, reference_id, created_by, transaction_date
    ) VALUES (
      NEW.deposited_to_account_id, ABS(NEW.amount), 'in',
      NEW.category, COALESCE(NEW.source || ' — ' || COALESCE(NEW.description, ''), 'Income'),
      'income', NEW.id, NEW.created_by, NEW.income_date::timestamptz
    );
  END IF;
  RETURN NEW;
END;
$function$;