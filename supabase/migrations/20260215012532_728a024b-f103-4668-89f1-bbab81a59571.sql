-- Allow public read access to ecosnack machines by machine_code
CREATE POLICY "Public can view ecosnack machines by code"
ON public.vendx_machines
FOR SELECT
USING (machine_type = 'ecosnack' AND status = 'active');

-- Allow public read access to machine inventory for ecosnack machines
CREATE POLICY "Public can view ecosnack machine inventory"
ON public.machine_inventory
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM vendx_machines vm
    WHERE vm.id = machine_inventory.machine_id
    AND vm.machine_type = 'ecosnack'
    AND vm.status = 'active'
  )
);
