ALTER TABLE public.vendx_external_clients ALTER COLUMN company_name DROP NOT NULL;
ALTER TABLE public.vendx_external_clients ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'commercial';