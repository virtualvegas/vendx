ALTER TABLE public.vendx_pos_revenue_config
  ADD COLUMN IF NOT EXISTS cogs_payment_method text DEFAULT 'internal';
UPDATE public.vendx_pos_revenue_config SET cogs_payment_method = COALESCE(cogs_payment_method, 'internal');