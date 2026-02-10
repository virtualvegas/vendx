
-- Add locker_code column to machine_inventory for pre-setting codes before checkout
ALTER TABLE public.machine_inventory ADD COLUMN locker_code text DEFAULT NULL;

COMMENT ON COLUMN public.machine_inventory.locker_code IS 'Pre-set 3-digit locker code for EcoSnack machines. If set, checkout uses this instead of generating a random code.';
