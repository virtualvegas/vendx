
-- Stand machine assignments: links machines to stands
CREATE TABLE public.stand_machine_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stand_id UUID NOT NULL REFERENCES public.stands(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.vendx_machines(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(stand_id, machine_id)
);

ALTER TABLE public.stand_machine_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view stand machine assignments"
  ON public.stand_machine_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins can manage stand machine assignments"
  ON public.stand_machine_assignments FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Event rental machine assignments: links machines to private event rentals
CREATE TABLE public.event_machine_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.vendx_machines(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  returned_at TIMESTAMPTZ,
  condition_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, machine_id)
);

ALTER TABLE public.event_machine_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view event machine assignments"
  ON public.event_machine_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins can manage event machine assignments"
  ON public.event_machine_assignments FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Add event_type to events table to distinguish private rentals
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'rental';
-- Add pricing fields for rentals
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS rental_rate NUMERIC DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_company TEXT;
