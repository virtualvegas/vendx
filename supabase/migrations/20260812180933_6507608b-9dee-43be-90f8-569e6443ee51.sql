CREATE OR REPLACE FUNCTION public.close_ext_service_ticket()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed','invoiced','cancelled') THEN
    IF NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    END IF;
  ELSE
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_ext_service_ticket ON public.vendx_external_service_tickets;
CREATE TRIGGER trg_close_ext_service_ticket
BEFORE INSERT OR UPDATE OF status ON public.vendx_external_service_tickets
FOR EACH ROW EXECUTE FUNCTION public.close_ext_service_ticket();

UPDATE public.vendx_external_service_tickets
SET resolved_at = COALESCE(resolved_at, updated_at, now())
WHERE status IN ('completed','invoiced','cancelled') AND resolved_at IS NULL;

UPDATE public.vendx_external_service_tickets
SET resolved_at = NULL
WHERE status NOT IN ('completed','invoiced','cancelled') AND resolved_at IS NOT NULL;