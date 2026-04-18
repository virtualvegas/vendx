
-- Create finance_income table for deposits and revenue entries
CREATE TABLE IF NOT EXISTS public.finance_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  income_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  subcategory text,
  description text,
  amount numeric NOT NULL CHECK (amount >= 0),
  tax_collected numeric DEFAULT 0,
  is_taxable boolean NOT NULL DEFAULT true,
  payment_method text,
  deposited_to_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  receipt_url text,
  receipt_filename text,
  status text NOT NULL DEFAULT 'recorded',
  notes text,
  -- linkage to auto-imported sources
  reference_type text,
  reference_id text,
  machine_id uuid REFERENCES public.vendx_machines(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_income_date ON public.finance_income(income_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_income_category ON public.finance_income(category);
CREATE INDEX IF NOT EXISTS idx_finance_income_account ON public.finance_income(deposited_to_account_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_finance_income_ref ON public.finance_income(reference_type, reference_id) WHERE reference_id IS NOT NULL;

ALTER TABLE public.finance_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance can view income" ON public.finance_income FOR SELECT
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));
CREATE POLICY "Finance can insert income" ON public.finance_income FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));
CREATE POLICY "Finance can update income" ON public.finance_income FOR UPDATE
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));
CREATE POLICY "Finance can delete income" ON public.finance_income FOR DELETE
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));

CREATE TRIGGER trg_finance_income_updated_at
  BEFORE UPDATE ON public.finance_income
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: when income recorded against an account, post an inbound account txn
CREATE OR REPLACE FUNCTION public.post_income_to_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE TRIGGER trg_post_income_to_account
  AFTER INSERT ON public.finance_income
  FOR EACH ROW EXECUTE FUNCTION public.post_income_to_account();

-- RPC to import machine_transactions revenue as income (idempotent via reference_id)
CREATE OR REPLACE FUNCTION public.import_machine_revenue_to_income(
  p_from_date date,
  p_to_date date,
  p_account_id uuid DEFAULT NULL
)
RETURNS TABLE(imported_count integer, total_amount numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
