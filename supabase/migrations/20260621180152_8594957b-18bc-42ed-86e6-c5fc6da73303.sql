
ALTER TABLE public.vendx_external_machines
  ADD COLUMN IF NOT EXISTS purchased_from_us boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_arcade_request_id uuid REFERENCES public.vendx_custom_arcade_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manual_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS warranty_pdf_url text,
  ADD COLUMN IF NOT EXISTS sale_date date,
  ADD COLUMN IF NOT EXISTS sale_price numeric;

CREATE INDEX IF NOT EXISTS idx_ext_machines_purchased_from_us ON public.vendx_external_machines(purchased_from_us);
CREATE INDEX IF NOT EXISTS idx_ext_machines_custom_arcade ON public.vendx_external_machines(custom_arcade_request_id);

CREATE OR REPLACE FUNCTION public.get_external_machine_service_stats(p_machine_id uuid)
RETURNS TABLE(
  total_tickets bigint,
  open_tickets bigint,
  completed_tickets bigint,
  last_service_date timestamptz,
  total_invoiced numeric,
  total_paid numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.vendx_external_service_tickets WHERE machine_id = p_machine_id),
    (SELECT count(*) FROM public.vendx_external_service_tickets WHERE machine_id = p_machine_id AND status NOT IN ('completed','invoiced','cancelled')),
    (SELECT count(*) FROM public.vendx_external_service_tickets WHERE machine_id = p_machine_id AND status IN ('completed','invoiced')),
    (SELECT max(COALESCE(resolved_at, updated_at)) FROM public.vendx_external_service_tickets WHERE machine_id = p_machine_id AND status IN ('completed','invoiced')),
    COALESCE((SELECT sum(total) FROM public.vendx_external_service_invoices i JOIN public.vendx_external_service_tickets t ON t.id = i.ticket_id WHERE t.machine_id = p_machine_id), 0),
    COALESCE((SELECT sum(amount_paid) FROM public.vendx_external_service_invoices i JOIN public.vendx_external_service_tickets t ON t.id = i.ticket_id WHERE t.machine_id = p_machine_id), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_external_machine_service_stats(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_sold_machines_with_stats()
RETURNS TABLE(
  machine_id uuid,
  asset_label text,
  machine_type text,
  make text,
  model text,
  serial_number text,
  client_id uuid,
  client_name text,
  sale_date date,
  sale_price numeric,
  install_date date,
  warranty_expires_on date,
  custom_arcade_request_id uuid,
  custom_request_number text,
  photo_url text,
  status text,
  total_tickets bigint,
  open_tickets bigint,
  last_service_date timestamptz,
  total_invoiced numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.asset_label,
    m.machine_type,
    m.make,
    m.model,
    m.serial_number,
    m.client_id,
    c.company_name,
    m.sale_date,
    m.sale_price,
    m.install_date,
    m.warranty_expires_on,
    m.custom_arcade_request_id,
    car.request_number,
    m.photo_url,
    m.status,
    (SELECT count(*) FROM public.vendx_external_service_tickets t WHERE t.machine_id = m.id),
    (SELECT count(*) FROM public.vendx_external_service_tickets t WHERE t.machine_id = m.id AND t.status NOT IN ('completed','invoiced','cancelled')),
    (SELECT max(COALESCE(t.resolved_at, t.updated_at)) FROM public.vendx_external_service_tickets t WHERE t.machine_id = m.id AND t.status IN ('completed','invoiced')),
    COALESCE((SELECT sum(i.total) FROM public.vendx_external_service_invoices i JOIN public.vendx_external_service_tickets t ON t.id = i.ticket_id WHERE t.machine_id = m.id), 0)
  FROM public.vendx_external_machines m
  LEFT JOIN public.vendx_external_clients c ON c.id = m.client_id
  LEFT JOIN public.vendx_custom_arcade_requests car ON car.id = m.custom_arcade_request_id
  WHERE m.purchased_from_us = true
  ORDER BY COALESCE(m.sale_date, m.install_date, m.created_at::date) DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.list_sold_machines_with_stats() TO authenticated, service_role;
