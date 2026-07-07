ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS ownership text NOT NULL DEFAULT 'vendx_owned';

CREATE INDEX IF NOT EXISTS locations_ownership_idx ON public.locations(ownership);
CREATE INDEX IF NOT EXISTS locations_business_type_idx ON public.locations(business_type);