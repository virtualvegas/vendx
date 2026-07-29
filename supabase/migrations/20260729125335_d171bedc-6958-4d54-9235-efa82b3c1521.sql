
-- Schedule enhancements
ALTER TABLE public.vendx_external_service_schedules
  ADD COLUMN IF NOT EXISTS preferred_time TIME,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS assigned_technician_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS advance_notice_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS day_of_week SMALLINT,
  ADD COLUMN IF NOT EXISTS day_of_month SMALLINT,
  ADD COLUMN IF NOT EXISTS last_completed_at TIMESTAMPTZ;

-- Ticket enhancements
ALTER TABLE public.vendx_external_service_tickets
  ADD COLUMN IF NOT EXISTS scheduled_time TIME,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS labor_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS labor_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS parts_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS technician_notes TEXT,
  ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.vendx_external_service_schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ext_tickets_scheduled_date ON public.vendx_external_service_tickets(scheduled_date) WHERE status NOT IN ('completed','cancelled','invoiced');
CREATE INDEX IF NOT EXISTS idx_ext_tickets_technician ON public.vendx_external_service_tickets(assigned_technician_id);

-- Auto-log status changes + reschedules + auto-resolve
CREATE OR REPLACE FUNCTION public.log_ext_ticket_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Auto-stamp resolved_at when moved to completed
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := now();
  END IF;

  -- Track reschedules
  IF NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date AND OLD.scheduled_date IS NOT NULL THEN
    NEW.reschedule_count := COALESCE(OLD.reschedule_count, 0) + 1;
    IF OLD.original_scheduled_date IS NULL THEN
      NEW.original_scheduled_date := OLD.scheduled_date;
    END IF;
    INSERT INTO public.vendx_external_service_ticket_updates(ticket_id, author_id, message, is_internal, status_change)
    VALUES (NEW.id, auth.uid(),
      'Rescheduled from ' || OLD.scheduled_date::text || ' to ' || COALESCE(NEW.scheduled_date::text,'(unset)'),
      true, 'rescheduled');
  END IF;

  -- Status change log
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.vendx_external_service_ticket_updates(ticket_id, author_id, message, is_internal, status_change)
    VALUES (NEW.id, auth.uid(), 'Status: ' || OLD.status || ' → ' || NEW.status, true, NEW.status);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ext_ticket_change_log ON public.vendx_external_service_tickets;
CREATE TRIGGER trg_ext_ticket_change_log
  BEFORE UPDATE ON public.vendx_external_service_tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ext_ticket_changes();

-- Improved generator: carries over new fields + advance notice
CREATE OR REPLACE FUNCTION public.generate_due_external_service_tickets()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s RECORD;
  new_ticket_id UUID;
  next_date DATE;
  created_count INTEGER := 0;
BEGIN
  FOR s IN
    SELECT * FROM public.vendx_external_service_schedules
    WHERE active = true
      AND next_run_date <= (CURRENT_DATE + COALESCE(advance_notice_days,0))
  LOOP
    INSERT INTO public.vendx_external_service_tickets (
      client_id, location_id, machine_id, subject, description, priority,
      service_package, service_location_type, access_notes,
      status, source, scheduled_date, scheduled_time,
      estimated_duration_minutes, assigned_technician_id, schedule_id
    ) VALUES (
      s.client_id, s.location_id, s.machine_id, s.subject,
      COALESCE(s.description, '') ||
        CASE WHEN s.notes IS NOT NULL AND s.notes <> '' THEN E'\n\n[Scheduled note] ' || s.notes ELSE '' END,
      s.priority, s.service_package, s.service_location_type, s.access_notes,
      'scheduled', 'scheduled_job', s.next_run_date, s.preferred_time,
      s.estimated_duration_minutes, s.assigned_technician_id, s.id
    ) RETURNING id INTO new_ticket_id;

    created_count := created_count + 1;

    IF s.recurrence = 'none' THEN
      UPDATE public.vendx_external_service_schedules
      SET active = false, last_generated_ticket_id = new_ticket_id,
          last_generated_at = now(), generated_count = generated_count + 1
      WHERE id = s.id;
    ELSE
      next_date := (CASE s.recurrence
        WHEN 'daily'     THEN s.next_run_date + (s.interval_count || ' days')::INTERVAL
        WHEN 'weekly'    THEN s.next_run_date + (s.interval_count * 7 || ' days')::INTERVAL
        WHEN 'monthly'   THEN s.next_run_date + (s.interval_count || ' months')::INTERVAL
        WHEN 'quarterly' THEN s.next_run_date + (s.interval_count * 3 || ' months')::INTERVAL
        WHEN 'yearly'    THEN s.next_run_date + (s.interval_count || ' years')::INTERVAL
      END)::DATE;

      UPDATE public.vendx_external_service_schedules
      SET next_run_date = next_date,
          active = CASE WHEN s.end_date IS NOT NULL AND next_date > s.end_date THEN false ELSE true END,
          last_generated_ticket_id = new_ticket_id,
          last_generated_at = now(),
          generated_count = generated_count + 1
      WHERE id = s.id;
    END IF;
  END LOOP;

  -- Mark schedules whose latest generated ticket has been completed
  UPDATE public.vendx_external_service_schedules sch
  SET last_completed_at = t.resolved_at
  FROM public.vendx_external_service_tickets t
  WHERE sch.last_generated_ticket_id = t.id
    AND t.status = 'completed'
    AND (sch.last_completed_at IS NULL OR sch.last_completed_at < t.resolved_at);

  RETURN created_count;
END;
$$;
