
-- Create location change requests table for business owners
CREATE TABLE public.location_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requested_by UUID NOT NULL,
  location_id UUID REFERENCES public.locations(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('name_change', 'add_machine', 'new_location', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  details JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.location_change_requests ENABLE ROW LEVEL SECURITY;

-- Business owners can see their own requests
CREATE POLICY "Users can view own change requests"
  ON public.location_change_requests FOR SELECT
  USING (auth.uid() = requested_by);

-- Business owners can create requests
CREATE POLICY "Users can create change requests"
  ON public.location_change_requests FOR INSERT
  WITH CHECK (auth.uid() = requested_by);

-- Admins can view all requests
CREATE POLICY "Admins can view all change requests"
  ON public.location_change_requests FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Admins can update requests (approve/deny)
CREATE POLICY "Admins can update change requests"
  ON public.location_change_requests FOR UPDATE
  USING (public.is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_location_change_requests_updated_at
  BEFORE UPDATE ON public.location_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
