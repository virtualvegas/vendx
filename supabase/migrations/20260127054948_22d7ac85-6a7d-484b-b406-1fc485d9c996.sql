-- Add unique constraint for upsert to work properly
ALTER TABLE public.location_assignments 
ADD CONSTRAINT location_assignments_location_owner_unique 
UNIQUE (location_id, business_owner_id);

-- Also add index for faster lookups by location
CREATE INDEX IF NOT EXISTS idx_location_assignments_location 
ON public.location_assignments(location_id) 
WHERE is_active = true;

-- Add index for faster lookups by business owner
CREATE INDEX IF NOT EXISTS idx_location_assignments_owner 
ON public.location_assignments(business_owner_id) 
WHERE is_active = true;