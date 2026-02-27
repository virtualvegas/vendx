ALTER TABLE public.vendx_machines ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'offline';
