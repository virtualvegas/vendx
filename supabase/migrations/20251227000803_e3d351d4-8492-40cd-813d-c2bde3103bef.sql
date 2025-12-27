-- Add zone-based fields to service_routes (now called zones)
ALTER TABLE public.service_routes 
ADD COLUMN IF NOT EXISTS zone_area TEXT,
ADD COLUMN IF NOT EXISTS service_frequency_days INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS last_serviced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS next_service_due TIMESTAMP WITH TIME ZONE;

-- Add scheduled date and priority to route_stops
ALTER TABLE public.route_stops 
ADD COLUMN IF NOT EXISTS scheduled_date DATE,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS auto_scheduled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS source_ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE SET NULL;

-- Create index for faster queries on scheduled date
CREATE INDEX IF NOT EXISTS idx_route_stops_scheduled_date ON public.route_stops(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_route_stops_priority ON public.route_stops(priority);

-- Create function to auto-schedule stop from support ticket
CREATE OR REPLACE FUNCTION public.auto_schedule_stop_from_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_zone_id UUID;
  v_location_id UUID;
  v_machine_id UUID;
  v_machine_name TEXT;
  v_location_name TEXT;
  v_address TEXT;
  v_max_order INTEGER;
  v_scheduled_date DATE;
BEGIN
  -- Skip if machine_id is CONTACT_FORM (these are contact form inquiries, not machine issues)
  IF NEW.machine_id = 'CONTACT_FORM' THEN
    RETURN NEW;
  END IF;
  
  -- Get machine details
  SELECT vm.id, vm.name, vm.location_id, l.name, l.address || ', ' || l.city
  INTO v_machine_id, v_machine_name, v_location_id, v_location_name, v_address
  FROM vendx_machines vm
  LEFT JOIN locations l ON vm.location_id = l.id
  WHERE vm.id::text = NEW.machine_id OR vm.machine_code = NEW.machine_id;
  
  -- If no machine found, skip
  IF v_machine_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Find zone that contains this location or machine
  SELECT sr.id INTO v_zone_id
  FROM service_routes sr
  JOIN route_stops rs ON rs.route_id = sr.id
  WHERE rs.location_id = v_location_id OR rs.machine_id = v_machine_id
  AND sr.status = 'active'
  LIMIT 1;
  
  -- If no zone found, find any active zone to add to
  IF v_zone_id IS NULL THEN
    SELECT id INTO v_zone_id FROM service_routes WHERE status = 'active' LIMIT 1;
  END IF;
  
  -- If still no zone, skip auto-scheduling
  IF v_zone_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Schedule for next business day
  v_scheduled_date := CURRENT_DATE + INTERVAL '1 day';
  IF EXTRACT(DOW FROM v_scheduled_date) = 0 THEN -- Sunday
    v_scheduled_date := v_scheduled_date + INTERVAL '1 day';
  ELSIF EXTRACT(DOW FROM v_scheduled_date) = 6 THEN -- Saturday
    v_scheduled_date := v_scheduled_date + INTERVAL '2 days';
  END IF;
  
  -- Get max stop order
  SELECT COALESCE(MAX(stop_order), 0) + 1 INTO v_max_order
  FROM route_stops WHERE route_id = v_zone_id;
  
  -- Create the stop
  INSERT INTO route_stops (
    route_id, 
    stop_name, 
    address, 
    notes, 
    stop_order, 
    location_id, 
    machine_id,
    scheduled_date,
    priority,
    auto_scheduled,
    source_ticket_id,
    status
  ) VALUES (
    v_zone_id,
    COALESCE(v_machine_name, v_location_name, 'Service Call'),
    v_address,
    'Auto-scheduled from ticket: ' || NEW.ticket_number || E'\n' || NEW.description,
    v_max_order,
    v_location_id,
    v_machine_id,
    v_scheduled_date,
    CASE 
      WHEN NEW.priority = 'critical' THEN 'urgent'
      WHEN NEW.priority = 'high' THEN 'high'
      ELSE 'normal'
    END,
    TRUE,
    NEW.id,
    'pending'
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-scheduling
DROP TRIGGER IF EXISTS trigger_auto_schedule_stop ON public.support_tickets;
CREATE TRIGGER trigger_auto_schedule_stop
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_schedule_stop_from_ticket();

-- Allow the trigger function to insert stops
DROP POLICY IF EXISTS "System can insert stops" ON public.route_stops;
CREATE POLICY "System can insert stops"
ON public.route_stops
FOR INSERT
WITH CHECK (true);