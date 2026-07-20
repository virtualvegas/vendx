
CREATE TABLE public.vendx_external_service_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.vendx_external_clients(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.vendx_external_locations(id) ON DELETE SET NULL,
  machine_id UUID REFERENCES public.vendx_external_machines(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  service_package TEXT,
  service_location_type TEXT,
  access_notes TEXT,
  notes TEXT,
  recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','monthly','quarterly','yearly')),
  interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
  next_run_date DATE NOT NULL,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  last_generated_ticket_id UUID,
  last_generated_at TIMESTAMPTZ,
  generated_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_external_service_schedules TO authenticated;
GRANT ALL ON public.vendx_external_service_schedules TO service_role;

ALTER TABLE public.vendx_external_service_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage external service schedules"
  ON public.vendx_external_service_schedules FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'tech_support_lead')
    OR public.has_role(auth.uid(), 'support')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'tech_support_lead')
    OR public.has_role(auth.uid(), 'support')
  );

CREATE INDEX idx_ext_schedules_due ON public.vendx_external_service_schedules(next_run_date) WHERE active = true;

CREATE TRIGGER trg_ext_schedules_updated
  BEFORE UPDATE ON public.vendx_external_service_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_due_external_service_tickets()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  new_ticket_id UUID;
  next_date DATE;
  created_count INTEGER := 0;
BEGIN
  FOR s IN
    SELECT * FROM public.vendx_external_service_schedules
    WHERE active = true AND next_run_date <= CURRENT_DATE
  LOOP
    INSERT INTO public.vendx_external_service_tickets (
      client_id, location_id, machine_id, subject, description, priority,
      service_package, service_location_type, access_notes,
      status, source, scheduled_date
    ) VALUES (
      s.client_id, s.location_id, s.machine_id,
      s.subject,
      COALESCE(s.description, '') ||
        CASE WHEN s.notes IS NOT NULL AND s.notes <> '' THEN E'\n\n[Scheduled note] ' || s.notes ELSE '' END,
      s.priority, s.service_package, s.service_location_type, s.access_notes,
      'scheduled', 'scheduled_job', s.next_run_date
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

  RETURN created_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_due_external_service_tickets() TO authenticated, service_role;
