-- Create business owner support requests table
CREATE TABLE public.partner_support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id UUID NOT NULL,
  location_id UUID REFERENCES public.locations(id),
  machine_id UUID REFERENCES public.vendx_machines(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('service', 'support', 'billing', 'general', 'emergency')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to UUID,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.partner_support_requests ENABLE ROW LEVEL SECURITY;

-- Business owners can view their own requests
CREATE POLICY "Business owners can view own requests"
ON public.partner_support_requests
FOR SELECT
USING (auth.uid() = business_owner_id);

-- Business owners can create their own requests
CREATE POLICY "Business owners can create requests"
ON public.partner_support_requests
FOR INSERT
WITH CHECK (auth.uid() = business_owner_id);

-- Business owners can update their open requests
CREATE POLICY "Business owners can update own open requests"
ON public.partner_support_requests
FOR UPDATE
USING (auth.uid() = business_owner_id AND status IN ('open', 'in_progress'));

-- Admins and tech support can manage all requests
CREATE POLICY "Admins can manage all partner requests"
ON public.partner_support_requests
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'tech_support_lead') OR
  has_role(auth.uid(), 'global_operations_manager')
);

-- Create trigger for updated_at
CREATE TRIGGER update_partner_support_requests_updated_at
  BEFORE UPDATE ON public.partner_support_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();