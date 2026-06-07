
-- POS stores: map each external POS store to a location/stand with optional config overrides
CREATE TABLE IF NOT EXISTS public.vendx_pos_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'loyverse',
  pos_store_id text NOT NULL,
  display_name text NOT NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  stand_id uuid REFERENCES public.stands(id) ON DELETE SET NULL,
  deposit_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  expense_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  revenue_subcategory text,
  expense_subcategory text,
  payment_method text,
  cogs_payment_method text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, pos_store_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_pos_stores TO authenticated;
GRANT ALL ON public.vendx_pos_stores TO service_role;

ALTER TABLE public.vendx_pos_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance admins manage pos stores"
ON public.vendx_pos_stores
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance_accounting'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance_accounting'::app_role));

CREATE TRIGGER trg_vendx_pos_stores_updated
BEFORE UPDATE ON public.vendx_pos_stores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Attribution columns on receipts
ALTER TABLE public.vendx_pos_receipts
  ADD COLUMN IF NOT EXISTS pos_store_id text,
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stand_id uuid REFERENCES public.stands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pos_receipts_store ON public.vendx_pos_receipts(source, pos_store_id);
CREATE INDEX IF NOT EXISTS idx_pos_receipts_location ON public.vendx_pos_receipts(location_id);
CREATE INDEX IF NOT EXISTS idx_pos_receipts_stand ON public.vendx_pos_receipts(stand_id);

-- Allow daily finance entries to be attributed per stand as well as per location
ALTER TABLE public.finance_income
  ADD COLUMN IF NOT EXISTS stand_id uuid REFERENCES public.stands(id) ON DELETE SET NULL;

-- Backfill pos_store_id on existing receipts from store_name (loyverse-sync writes store_id into store_name)
UPDATE public.vendx_pos_receipts
SET pos_store_id = store_name
WHERE pos_store_id IS NULL AND store_name IS NOT NULL;
