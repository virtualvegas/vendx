
-- Add category column to synced_transactions for admin organization
ALTER TABLE public.synced_transactions ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'uncategorized';

-- Update provider check to allow vendx_pay
ALTER TABLE public.synced_transactions DROP CONSTRAINT IF EXISTS synced_transactions_provider_check;
ALTER TABLE public.synced_transactions ADD CONSTRAINT synced_transactions_provider_check 
  CHECK (provider = ANY (ARRAY['stripe'::text, 'paypal'::text, 'vendx_pay'::text]));

-- Allow super_admin and finance to update synced transactions (for category/type edits)
DROP POLICY IF EXISTS "Finance can manage synced transactions" ON public.synced_transactions;
CREATE POLICY "Finance can manage synced transactions" ON public.synced_transactions
  FOR ALL USING (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_accounting')
  );
