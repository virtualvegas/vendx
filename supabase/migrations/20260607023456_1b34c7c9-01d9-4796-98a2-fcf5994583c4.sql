
-- Helper: staff role check
CREATE OR REPLACE FUNCTION public.is_ext_service_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'super_admin')
      OR public.has_role(_user_id,'finance_accounting')
      OR public.has_role(_user_id,'tech_support_lead')
      OR public.has_role(_user_id,'support')
      OR public.has_role(_user_id,'global_operations_manager')
      OR public.has_role(_user_id,'regional_manager')
      OR public.has_role(_user_id,'employee_operator')
$$;

-- 1. CLIENTS
CREATE TABLE public.vendx_external_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  billing_address text,
  billing_city text,
  billing_state text,
  billing_postal_code text,
  billing_country text,
  tax_id text,
  default_hourly_rate numeric(10,2) DEFAULT 125.00,
  default_payment_terms_days integer DEFAULT 30,
  notes text,
  status text NOT NULL DEFAULT 'active',
  linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_external_clients TO authenticated;
GRANT ALL ON public.vendx_external_clients TO service_role;
ALTER TABLE public.vendx_external_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage ext clients" ON public.vendx_external_clients
FOR ALL TO authenticated USING (public.is_ext_service_staff(auth.uid())) WITH CHECK (public.is_ext_service_staff(auth.uid()));
CREATE POLICY "Linked owner views client" ON public.vendx_external_clients
FOR SELECT TO authenticated USING (linked_user_id = auth.uid());

-- 2. LOCATIONS
CREATE TABLE public.vendx_external_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.vendx_external_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text, city text, state text, postal_code text, country text,
  contact_name text, contact_phone text,
  access_notes text, hours text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_external_locations TO authenticated;
GRANT ALL ON public.vendx_external_locations TO service_role;
ALTER TABLE public.vendx_external_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage ext locations" ON public.vendx_external_locations
FOR ALL TO authenticated USING (public.is_ext_service_staff(auth.uid())) WITH CHECK (public.is_ext_service_staff(auth.uid()));
CREATE POLICY "Owner views own ext locations" ON public.vendx_external_locations
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.vendx_external_clients c WHERE c.id = client_id AND c.linked_user_id = auth.uid()
));

-- 3. MACHINES
CREATE TABLE public.vendx_external_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.vendx_external_clients(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.vendx_external_locations(id) ON DELETE SET NULL,
  asset_label text NOT NULL,
  machine_type text, make text, model text, serial_number text,
  install_date date, warranty_expires_on date,
  hourly_rate_override numeric(10,2),
  photo_url text, contract_terms text, notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_external_machines TO authenticated;
GRANT ALL ON public.vendx_external_machines TO service_role;
ALTER TABLE public.vendx_external_machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage ext machines" ON public.vendx_external_machines
FOR ALL TO authenticated USING (public.is_ext_service_staff(auth.uid())) WITH CHECK (public.is_ext_service_staff(auth.uid()));
CREATE POLICY "Owner views own ext machines" ON public.vendx_external_machines
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.vendx_external_clients c WHERE c.id = client_id AND c.linked_user_id = auth.uid()
));

-- 4. TICKETS
CREATE TABLE public.vendx_external_service_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE,
  client_id uuid REFERENCES public.vendx_external_clients(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.vendx_external_locations(id) ON DELETE SET NULL,
  machine_id uuid REFERENCES public.vendx_external_machines(id) ON DELETE SET NULL,
  intake_company_name text, intake_contact_name text, intake_contact_email text,
  intake_contact_phone text, intake_address text, intake_machine_description text,
  subject text NOT NULL, description text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'new',
  source text NOT NULL DEFAULT 'admin',
  scheduled_date date,
  assigned_technician_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  route_stop_id uuid REFERENCES public.route_stops(id) ON DELETE SET NULL,
  resolution text,
  resolved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_external_service_tickets TO authenticated;
GRANT INSERT ON public.vendx_external_service_tickets TO anon;
GRANT ALL ON public.vendx_external_service_tickets TO service_role;
ALTER TABLE public.vendx_external_service_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public intake submit" ON public.vendx_external_service_tickets
FOR INSERT TO anon, authenticated
WITH CHECK (source = 'public_intake' AND status = 'new' AND client_id IS NULL);

CREATE POLICY "Staff manage tickets" ON public.vendx_external_service_tickets
FOR ALL TO authenticated USING (public.is_ext_service_staff(auth.uid())) WITH CHECK (public.is_ext_service_staff(auth.uid()));

CREATE POLICY "Owner views own tickets" ON public.vendx_external_service_tickets
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.vendx_external_clients c WHERE c.id = client_id AND c.linked_user_id = auth.uid()
));

CREATE POLICY "Owner creates own ticket" ON public.vendx_external_service_tickets
FOR INSERT TO authenticated
WITH CHECK (client_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.vendx_external_clients c WHERE c.id = client_id AND c.linked_user_id = auth.uid()
));

CREATE OR REPLACE FUNCTION public.generate_external_ticket_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := 'EXT-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM()*100000)::TEXT,5,'0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_ext_ticket_number BEFORE INSERT ON public.vendx_external_service_tickets
FOR EACH ROW EXECUTE FUNCTION public.generate_external_ticket_number();
CREATE TRIGGER trg_ext_tickets_updated BEFORE UPDATE ON public.vendx_external_service_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. TICKET UPDATES
CREATE TABLE public.vendx_external_service_ticket_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.vendx_external_service_tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  message text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  status_change text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_external_service_ticket_updates TO authenticated;
GRANT ALL ON public.vendx_external_service_ticket_updates TO service_role;
ALTER TABLE public.vendx_external_service_ticket_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage ticket updates" ON public.vendx_external_service_ticket_updates
FOR ALL TO authenticated USING (public.is_ext_service_staff(auth.uid())) WITH CHECK (public.is_ext_service_staff(auth.uid()));
CREATE POLICY "Owner reads non-internal" ON public.vendx_external_service_ticket_updates
FOR SELECT TO authenticated USING (is_internal = false AND EXISTS (
  SELECT 1 FROM public.vendx_external_service_tickets t
  JOIN public.vendx_external_clients c ON c.id = t.client_id
  WHERE t.id = ticket_id AND c.linked_user_id = auth.uid()
));
CREATE POLICY "Owner adds updates" ON public.vendx_external_service_ticket_updates
FOR INSERT TO authenticated WITH CHECK (is_internal = false AND EXISTS (
  SELECT 1 FROM public.vendx_external_service_tickets t
  JOIN public.vendx_external_clients c ON c.id = t.client_id
  WHERE t.id = ticket_id AND c.linked_user_id = auth.uid()
));

-- 6. INVOICES
CREATE TABLE public.vendx_external_service_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  client_id uuid NOT NULL REFERENCES public.vendx_external_clients(id) ON DELETE RESTRICT,
  ticket_id uuid REFERENCES public.vendx_external_service_tickets(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_external_service_invoices TO authenticated;
GRANT ALL ON public.vendx_external_service_invoices TO service_role;
ALTER TABLE public.vendx_external_service_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance/admin manage ext invoices" ON public.vendx_external_service_invoices
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'))
WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'));
CREATE POLICY "Staff read ext invoices" ON public.vendx_external_service_invoices
FOR SELECT TO authenticated USING (public.is_ext_service_staff(auth.uid()));
CREATE POLICY "Owner views own invoices" ON public.vendx_external_service_invoices
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.vendx_external_clients c WHERE c.id = client_id AND c.linked_user_id = auth.uid()
));

CREATE OR REPLACE FUNCTION public.generate_external_invoice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-EXT-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM()*100000)::TEXT,5,'0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_ext_invoice_number BEFORE INSERT ON public.vendx_external_service_invoices
FOR EACH ROW EXECUTE FUNCTION public.generate_external_invoice_number();
CREATE TRIGGER trg_ext_invoices_updated BEFORE UPDATE ON public.vendx_external_service_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. INVOICE ITEMS
CREATE TABLE public.vendx_external_service_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.vendx_external_service_invoices(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'labor',
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  logged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  logged_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_external_service_invoice_items TO authenticated;
GRANT ALL ON public.vendx_external_service_invoice_items TO service_role;
ALTER TABLE public.vendx_external_service_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance/admin manage invoice items" ON public.vendx_external_service_invoice_items
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'))
WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'finance_accounting'));
CREATE POLICY "Tech log items on draft" ON public.vendx_external_service_invoice_items
FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'tech_support_lead')
  AND EXISTS (SELECT 1 FROM public.vendx_external_service_invoices i WHERE i.id = invoice_id AND i.status = 'draft')
);
CREATE POLICY "Staff read invoice items" ON public.vendx_external_service_invoice_items
FOR SELECT TO authenticated USING (public.is_ext_service_staff(auth.uid()));
CREATE POLICY "Owner views own items" ON public.vendx_external_service_invoice_items
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.vendx_external_service_invoices i
  JOIN public.vendx_external_clients c ON c.id = i.client_id
  WHERE i.id = invoice_id AND c.linked_user_id = auth.uid()
));

CREATE OR REPLACE FUNCTION public.set_external_invoice_item_line_total()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.line_total := ROUND(COALESCE(NEW.quantity,0) * COALESCE(NEW.unit_price,0), 2);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.recalc_external_invoice_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invoice_id uuid;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  UPDATE public.vendx_external_service_invoices
  SET subtotal = COALESCE((SELECT SUM(line_total) FROM public.vendx_external_service_invoice_items WHERE invoice_id = v_invoice_id),0),
      total = COALESCE((SELECT SUM(line_total) FROM public.vendx_external_service_invoice_items WHERE invoice_id = v_invoice_id),0) + COALESCE((SELECT tax_amount FROM public.vendx_external_service_invoices WHERE id = v_invoice_id),0),
      updated_at = now()
  WHERE id = v_invoice_id;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trg_ext_inv_item_line_total BEFORE INSERT OR UPDATE ON public.vendx_external_service_invoice_items
FOR EACH ROW EXECUTE FUNCTION public.set_external_invoice_item_line_total();
CREATE TRIGGER trg_ext_inv_item_rollup AFTER INSERT OR UPDATE OR DELETE ON public.vendx_external_service_invoice_items
FOR EACH ROW EXECUTE FUNCTION public.recalc_external_invoice_totals();

CREATE TRIGGER trg_ext_clients_updated BEFORE UPDATE ON public.vendx_external_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ext_locations_updated BEFORE UPDATE ON public.vendx_external_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ext_machines_updated BEFORE UPDATE ON public.vendx_external_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ext_locations_client ON public.vendx_external_locations(client_id);
CREATE INDEX idx_ext_machines_client ON public.vendx_external_machines(client_id);
CREATE INDEX idx_ext_machines_location ON public.vendx_external_machines(location_id);
CREATE INDEX idx_ext_tickets_client ON public.vendx_external_service_tickets(client_id);
CREATE INDEX idx_ext_tickets_status ON public.vendx_external_service_tickets(status);
CREATE INDEX idx_ext_tickets_scheduled ON public.vendx_external_service_tickets(scheduled_date);
CREATE INDEX idx_ext_invoice_items_invoice ON public.vendx_external_service_invoice_items(invoice_id);
CREATE INDEX idx_ext_invoices_client ON public.vendx_external_service_invoices(client_id);
CREATE INDEX idx_ext_clients_linked_user ON public.vendx_external_clients(linked_user_id);
