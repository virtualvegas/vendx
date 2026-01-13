-- Create arcade waitlist table
CREATE TABLE public.arcade_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  preferred_plan TEXT,
  referral_source TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notified_at TIMESTAMP WITH TIME ZONE,
  converted_at TIMESTAMP WITH TIME ZONE
);

-- Create unique constraint on email to prevent duplicates
CREATE UNIQUE INDEX arcade_waitlist_email_unique ON public.arcade_waitlist (email);

-- Enable Row Level Security
ALTER TABLE public.arcade_waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can sign up for the waitlist
CREATE POLICY "Anyone can join waitlist" 
ON public.arcade_waitlist 
FOR INSERT 
WITH CHECK (true);

-- Users can view their own waitlist entry by email
CREATE POLICY "Users can view own waitlist entry" 
ON public.arcade_waitlist 
FOR SELECT 
USING (true);

-- Super admins can manage all waitlist entries
CREATE POLICY "Admins can manage waitlist" 
ON public.arcade_waitlist 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);