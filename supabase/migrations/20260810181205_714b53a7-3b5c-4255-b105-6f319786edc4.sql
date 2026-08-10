ALTER TABLE public.vendx_custom_arcade_requests
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.vendx_external_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_custom_arcade_requests_client ON public.vendx_custom_arcade_requests(client_id);

ALTER TABLE public.vendx_external_service_invoices
  ADD COLUMN IF NOT EXISTS custom_arcade_request_id uuid REFERENCES public.vendx_custom_arcade_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ext_invoices_custom_request ON public.vendx_external_service_invoices(custom_arcade_request_id);