ALTER TABLE public.vendx_external_service_tickets ADD COLUMN IF NOT EXISTS merged_into_ticket_id uuid REFERENCES public.vendx_external_service_tickets(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.vendx_external_service_ticket_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.vendx_external_service_tickets(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.vendx_external_machines(id) ON DELETE CASCADE,
  issue text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, machine_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_external_service_ticket_machines TO authenticated;
GRANT ALL ON public.vendx_external_service_ticket_machines TO service_role;
ALTER TABLE public.vendx_external_service_ticket_machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage ticket machines" ON public.vendx_external_service_ticket_machines
  FOR ALL TO authenticated USING (public.is_ext_service_staff(auth.uid())) WITH CHECK (public.is_ext_service_staff(auth.uid()));
CREATE POLICY "Ticket viewers see ticket machines" ON public.vendx_external_service_ticket_machines
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.vendx_external_service_tickets t WHERE t.id = ticket_id));

INSERT INTO public.vendx_external_service_ticket_machines (ticket_id, machine_id)
SELECT id, machine_id FROM public.vendx_external_service_tickets WHERE machine_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.list_ext_service_technicians()
RETURNS TABLE(id uuid, full_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.id, p.full_name, p.email
  FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.id
  WHERE public.is_ext_service_staff(auth.uid())
    AND r.role NOT IN ('customer','business_owner')
  ORDER BY p.full_name NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.list_ext_service_technicians() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_ext_service_technicians() TO authenticated;

CREATE OR REPLACE FUNCTION public.merge_ext_service_tickets(_target uuid, _sources uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tgt record; src record; nums text := '';
BEGIN
  IF NOT public.is_ext_service_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO tgt FROM vendx_external_service_tickets WHERE id = _target;
  IF tgt.id IS NULL THEN RAISE EXCEPTION 'Target ticket not found'; END IF;
  IF tgt.location_id IS NULL THEN RAISE EXCEPTION 'Target ticket needs a site to merge'; END IF;
  FOR src IN SELECT * FROM vendx_external_service_tickets WHERE id = ANY(_sources) AND id <> _target LOOP
    IF src.location_id IS DISTINCT FROM tgt.location_id THEN
      RAISE EXCEPTION 'Ticket % is at a different site', src.ticket_number;
    END IF;
    IF src.machine_id IS NOT NULL THEN
      INSERT INTO vendx_external_service_ticket_machines(ticket_id, machine_id, issue)
      VALUES (_target, src.machine_id, src.subject) ON CONFLICT DO NOTHING;
    END IF;
    INSERT INTO vendx_external_service_ticket_machines(ticket_id, machine_id, issue, status)
      SELECT _target, machine_id, issue, status FROM vendx_external_service_ticket_machines WHERE ticket_id = src.id
      ON CONFLICT DO NOTHING;
    UPDATE vendx_external_service_ticket_updates SET ticket_id = _target WHERE ticket_id = src.id;
    UPDATE vendx_external_service_tickets SET parent_ticket_id = _target WHERE parent_ticket_id = src.id;
    UPDATE vendx_external_service_tickets SET
      description = concat_ws(E'\n\n', description, '[Merged from ' || src.ticket_number || '] ' || src.subject || coalesce(E'\n' || src.description, ''))
      WHERE id = _target;
    UPDATE vendx_external_service_tickets SET status = 'cancelled', merged_into_ticket_id = _target,
      resolution = 'Merged into ' || tgt.ticket_number WHERE id = src.id;
    nums := nums || src.ticket_number || ' ';
  END LOOP;
  INSERT INTO vendx_external_service_ticket_updates(ticket_id, author_id, message, is_internal)
  VALUES (_target, auth.uid(), 'Merged tickets: ' || trim(nums), true);
  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'merge', 'vendx_external_service_tickets', _target::text, jsonb_build_object('sources', _sources))
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN undefined_column THEN RAISE;
END $$;
REVOKE ALL ON FUNCTION public.merge_ext_service_tickets(uuid, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.merge_ext_service_tickets(uuid, uuid[]) TO authenticated;