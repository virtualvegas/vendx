
-- Make ticket_id nullable in support_ticket_responses
ALTER TABLE public.support_ticket_responses ALTER COLUMN ticket_id DROP NOT NULL;

-- Add partner_request_id column
ALTER TABLE public.support_ticket_responses 
ADD COLUMN partner_request_id UUID REFERENCES public.partner_support_requests(id) ON DELETE CASCADE;

-- Add check constraint to ensure at least one reference is set
ALTER TABLE public.support_ticket_responses
ADD CONSTRAINT ticket_or_partner_request CHECK (
  ticket_id IS NOT NULL OR partner_request_id IS NOT NULL
);

-- Update RLS policies to also allow access based on partner_request_id
-- (existing policies already cover super_admin and tech_support_lead roles)
