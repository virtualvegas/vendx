-- Add waitlist_enabled column to store_products
ALTER TABLE public.store_products 
ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN DEFAULT false;

-- Create a generic product_waitlist table
CREATE TABLE public.product_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.store_products(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  referral_source TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notified_at TIMESTAMP WITH TIME ZONE,
  converted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.product_waitlist ENABLE ROW LEVEL SECURITY;

-- Allow public inserts for waitlist signups (no auth required)
CREATE POLICY "Anyone can join waitlist"
ON public.product_waitlist
FOR INSERT
WITH CHECK (true);

-- Allow admins to view and manage waitlist
CREATE POLICY "Admins can view waitlist"
ON public.product_waitlist
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'marketing_sales')
  )
);

CREATE POLICY "Admins can update waitlist"
ON public.product_waitlist
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'marketing_sales')
  )
);

CREATE POLICY "Admins can delete waitlist entries"
ON public.product_waitlist
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'marketing_sales')
  )
);

-- Create index for faster lookups
CREATE INDEX idx_product_waitlist_product_id ON public.product_waitlist(product_id);
CREATE INDEX idx_product_waitlist_email ON public.product_waitlist(email);
CREATE INDEX idx_product_waitlist_status ON public.product_waitlist(status);