-- Create business_inquiries table for B2B partnership leads
CREATE TABLE public.business_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  location_type TEXT,
  interested_services TEXT,
  message TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.business_inquiries ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public form submission)
CREATE POLICY "Anyone can submit business inquiries"
ON public.business_inquiries
FOR INSERT
WITH CHECK (true);

-- Only authenticated users can view (for admin dashboard)
CREATE POLICY "Authenticated users can view inquiries"
ON public.business_inquiries
FOR SELECT
USING (auth.role() = 'authenticated');

-- Create trigger for updated_at
CREATE TRIGGER update_business_inquiries_updated_at
BEFORE UPDATE ON public.business_inquiries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();