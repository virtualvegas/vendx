ALTER TABLE public.service_routes
  ADD COLUMN IF NOT EXISTS is_multi_day BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_days INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reassigned_by UUID;

ALTER TABLE public.route_stops
  ADD COLUMN IF NOT EXISTS day_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS inventory_priority_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_inventory_flagged BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_route_stops_day_number ON public.route_stops(route_id, day_number, stop_order);
CREATE INDEX IF NOT EXISTS idx_route_stops_inv_priority ON public.route_stops(inventory_priority_score DESC) WHERE low_inventory_flagged = true;

CREATE OR REPLACE FUNCTION public.calculate_machine_inventory_priority(p_machine_id UUID)
RETURNS TABLE(score INTEGER, low_flag BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_capacity INTEGER := 0;
  v_total_qty INTEGER := 0;
  v_low_slots INTEGER := 0;
  v_total_slots INTEGER := 0;
  v_fill_pct NUMERIC := 100;
  v_score INTEGER := 0;
BEGIN
  IF p_machine_id IS NULL THEN
    RETURN QUERY SELECT 0, false;
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(GREATEST(max_capacity, 1)), 0),
    COALESCE(SUM(quantity), 0),
    COUNT(*) FILTER (WHERE max_capacity > 0 AND quantity::numeric / max_capacity <= 0.25),
    COUNT(*)
  INTO v_total_capacity, v_total_qty, v_low_slots, v_total_slots
  FROM public.machine_inventory
  WHERE machine_id = p_machine_id;

  IF v_total_slots = 0 OR v_total_capacity = 0 THEN
    RETURN QUERY SELECT 0, false;
    RETURN;
  END IF;

  v_fill_pct := (v_total_qty::numeric / v_total_capacity::numeric) * 100;
  v_score := GREATEST(0, LEAST(100, ROUND(100 - v_fill_pct)::int));
  IF v_low_slots > 0 THEN
    v_score := LEAST(100, v_score + (v_low_slots * 100 / v_total_slots) / 2);
  END IF;

  RETURN QUERY SELECT v_score, (v_low_slots > 0 OR v_fill_pct <= 25);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_route_stop_inventory_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score INTEGER := 0;
  v_flag BOOLEAN := false;
BEGIN
  IF NEW.machine_id IS NOT NULL THEN
    SELECT score, low_flag INTO v_score, v_flag
    FROM public.calculate_machine_inventory_priority(NEW.machine_id);
    NEW.inventory_priority_score := COALESCE(v_score, 0);
    NEW.low_inventory_flagged := COALESCE(v_flag, false);
  ELSE
    NEW.inventory_priority_score := 0;
    NEW.low_inventory_flagged := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_stop_inv_priority ON public.route_stops;
CREATE TRIGGER trg_refresh_stop_inv_priority
BEFORE INSERT OR UPDATE OF machine_id ON public.route_stops
FOR EACH ROW
EXECUTE FUNCTION public.refresh_route_stop_inventory_priority();

CREATE OR REPLACE FUNCTION public.cascade_inventory_to_route_stops()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_machine UUID;
  v_score INTEGER;
  v_flag BOOLEAN;
BEGIN
  v_machine := COALESCE(NEW.machine_id, OLD.machine_id);
  IF v_machine IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT score, low_flag INTO v_score, v_flag
  FROM public.calculate_machine_inventory_priority(v_machine);

  UPDATE public.route_stops
  SET inventory_priority_score = COALESCE(v_score, 0),
      low_inventory_flagged = COALESCE(v_flag, false)
  WHERE machine_id = v_machine
    AND status IN ('pending', 'in_progress');

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_inv_to_stops ON public.machine_inventory;
CREATE TRIGGER trg_cascade_inv_to_stops
AFTER INSERT OR UPDATE OR DELETE ON public.machine_inventory
FOR EACH ROW
EXECUTE FUNCTION public.cascade_inventory_to_route_stops();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'service_routes'
      AND policyname = 'Regional managers can update their office routes'
  ) THEN
    CREATE POLICY "Regional managers can update their office routes"
    ON public.service_routes
    FOR UPDATE
    TO authenticated
    USING (
      has_role(auth.uid(), 'regional_manager') AND office_id = get_my_office_id()
    )
    WITH CHECK (
      has_role(auth.uid(), 'regional_manager') AND office_id = get_my_office_id()
    );
  END IF;
END $$;

-- Backfill: trigger by touching machine_id on each existing stop
UPDATE public.route_stops SET machine_id = machine_id WHERE machine_id IS NOT NULL;