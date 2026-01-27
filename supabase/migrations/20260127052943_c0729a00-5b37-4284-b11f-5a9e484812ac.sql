
-- Add RLS policy for business owners to view machines at their assigned locations
CREATE POLICY "Business owners can view machines at their locations"
ON public.vendx_machines
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.location_assignments la
    WHERE la.location_id = vendx_machines.location_id
      AND la.business_owner_id = auth.uid()
      AND la.is_active = true
  )
);
