
-- When vendx_machines.machine_code is updated, cascade to ecosnack_locker_purchases
CREATE OR REPLACE FUNCTION public.cascade_machine_code_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.machine_code IS DISTINCT FROM NEW.machine_code THEN
    UPDATE ecosnack_locker_purchases
    SET machine_code = NEW.machine_code
    WHERE machine_code = OLD.machine_code;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cascade_machine_code
BEFORE UPDATE ON public.vendx_machines
FOR EACH ROW
EXECUTE FUNCTION public.cascade_machine_code_update();
