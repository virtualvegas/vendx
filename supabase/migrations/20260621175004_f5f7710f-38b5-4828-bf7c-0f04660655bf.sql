
CREATE OR REPLACE FUNCTION public.prevent_duplicate_manual_income()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  -- Skip auto-imported records
  IF NEW.reference_type IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Transaction number is reference-only; no uniqueness enforcement.
  -- Soft duplicate guard: only block exact duplicates submitted within 60s.
  SELECT id INTO v_existing_id
  FROM public.finance_income
  WHERE income_date = NEW.income_date
    AND amount = NEW.amount
    AND COALESCE(source, '') = COALESCE(NEW.source, '')
    AND category = NEW.category
    AND COALESCE(external_reference, '') = COALESCE(NEW.external_reference, '')
    AND reference_type IS NULL
    AND created_at > now() - interval '60 seconds'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Possible duplicate income (identical entry created within last 60 seconds, ID: %). Wait a moment before resubmitting.', v_existing_id
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;
