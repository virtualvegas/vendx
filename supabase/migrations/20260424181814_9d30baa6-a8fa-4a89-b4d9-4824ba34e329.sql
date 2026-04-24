CREATE OR REPLACE FUNCTION public.post_external_income_to_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_stream_name text;
  v_category text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'received' OR NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT default_account_id, name, default_category
    INTO v_account_id, v_stream_name, v_category
  FROM public.external_income_streams
  WHERE id = NEW.stream_id;

  IF v_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.finance_account_transactions
    WHERE reference_type = 'external_income_entry' AND reference_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.finance_account_transactions (
    account_id, amount, direction, category, description,
    reference_type, reference_id, transaction_date
  ) VALUES (
    v_account_id,
    ABS(NEW.amount),
    'in',
    COALESCE(NEW.category, v_category, 'other'),
    'Ext: ' || COALESCE(v_stream_name, 'External') || ' — ' || COALESCE(NEW.source, '') ||
      CASE WHEN NEW.description IS NOT NULL AND NEW.description <> '' THEN ' — ' || NEW.description ELSE '' END,
    'external_income_entry',
    NEW.id,
    COALESCE(NEW.entry_date, CURRENT_DATE)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_external_income_to_account ON public.external_income_entries;
CREATE TRIGGER trg_post_external_income_to_account
AFTER INSERT ON public.external_income_entries
FOR EACH ROW
EXECUTE FUNCTION public.post_external_income_to_account();

CREATE OR REPLACE FUNCTION public.reverse_external_income_account_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.finance_account_transactions
  WHERE reference_type = 'external_income_entry' AND reference_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_reverse_external_income_account_post ON public.external_income_entries;
CREATE TRIGGER trg_reverse_external_income_account_post
BEFORE DELETE ON public.external_income_entries
FOR EACH ROW
EXECUTE FUNCTION public.reverse_external_income_account_post();

INSERT INTO public.finance_account_transactions (
  account_id, amount, direction, category, description,
  reference_type, reference_id, transaction_date
)
SELECT
  s.default_account_id,
  ABS(e.amount),
  'in',
  COALESCE(e.category, s.default_category, 'other'),
  'Ext: ' || COALESCE(s.name, 'External') || ' — ' || COALESCE(e.source, '') ||
    CASE WHEN e.description IS NOT NULL AND e.description <> '' THEN ' — ' || e.description ELSE '' END,
  'external_income_entry',
  e.id,
  COALESCE(e.entry_date, CURRENT_DATE)
FROM public.external_income_entries e
JOIN public.external_income_streams s ON s.id = e.stream_id
WHERE e.status = 'received'
  AND e.amount > 0
  AND s.default_account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.finance_account_transactions t
    WHERE t.reference_type = 'external_income_entry' AND t.reference_id = e.id
  );