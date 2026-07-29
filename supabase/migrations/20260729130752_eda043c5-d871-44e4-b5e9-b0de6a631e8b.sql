ALTER TABLE public.vendx_external_service_tickets
  ADD COLUMN IF NOT EXISTS parent_ticket_id uuid REFERENCES public.vendx_external_service_tickets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ext_tickets_parent ON public.vendx_external_service_tickets(parent_ticket_id);