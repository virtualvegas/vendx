-- ============================================================================
-- VendX Offices System
-- ============================================================================

CREATE TABLE public.vendx_offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'USA',
  phone TEXT,
  email TEXT,
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  handles_machine_storage BOOLEAN NOT NULL DEFAULT true,
  handles_customer_service BOOLEAN NOT NULL DEFAULT true,
  handles_service_tech BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active', -- active | inactive
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_vendx_offices_status ON public.vendx_offices(status);
CREATE INDEX idx_vendx_offices_manager ON public.vendx_offices(manager_id);

ALTER TABLE public.vendx_offices ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_vendx_offices_updated_at
  BEFORE UPDATE ON public.vendx_offices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Add office_id to existing tables
-- ============================================================================

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.vendx_offices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_locations_office_id ON public.locations(office_id);

ALTER TABLE public.vendx_machines
  ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.vendx_offices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vendx_machines_office_id ON public.vendx_machines(office_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.vendx_offices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_office_id ON public.profiles(office_id);

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.vendx_offices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_office_id ON public.support_tickets(office_id);

-- ============================================================================
-- Helper: get current user's office_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_office_id()
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT office_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ============================================================================
-- Auto-route support tickets to office on create
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_route_ticket_to_office()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office_id UUID;
  v_location_id UUID;
BEGIN
  -- Skip if already assigned, or if it's a contact-form ticket
  IF NEW.office_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.machine_id = 'CONTACT_FORM' OR NEW.machine_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Try machine first (machines can override location's office)
  SELECT vm.office_id, vm.location_id
  INTO v_office_id, v_location_id
  FROM public.vendx_machines vm
  WHERE vm.id::text = NEW.machine_id OR vm.machine_code = NEW.machine_id
  LIMIT 1;

  -- Fall back to the location's office
  IF v_office_id IS NULL AND v_location_id IS NOT NULL THEN
    SELECT office_id INTO v_office_id FROM public.locations WHERE id = v_location_id;
  END IF;

  NEW.office_id := v_office_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_route_ticket_to_office ON public.support_tickets;
CREATE TRIGGER trg_auto_route_ticket_to_office
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.auto_route_ticket_to_office();

-- ============================================================================
-- RLS policies: vendx_offices
-- ============================================================================

CREATE POLICY "Super admins manage all offices"
  ON public.vendx_offices FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Office staff can view their own office"
  ON public.vendx_offices FOR SELECT
  USING (id = public.get_my_office_id());

-- ============================================================================
-- Update support_tickets RLS for office scoping
-- (Keep super_admin and existing policies; add office-staff visibility)
-- ============================================================================

CREATE POLICY "Office staff can view their office tickets and unassigned"
  ON public.support_tickets FOR SELECT
  USING (
    public.get_my_office_id() IS NOT NULL
    AND (office_id = public.get_my_office_id() OR office_id IS NULL)
  );

CREATE POLICY "Office staff can update their office tickets"
  ON public.support_tickets FOR UPDATE
  USING (
    public.get_my_office_id() IS NOT NULL
    AND (office_id = public.get_my_office_id() OR office_id IS NULL)
  );