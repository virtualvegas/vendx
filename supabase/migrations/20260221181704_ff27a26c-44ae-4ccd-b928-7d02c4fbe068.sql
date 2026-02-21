
-- Create support ticket responses table for conversation threads
CREATE TABLE public.support_ticket_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL,
  responder_name TEXT,
  responder_role TEXT DEFAULT 'admin',
  message TEXT NOT NULL,
  is_internal_note BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_ticket_responses ENABLE ROW LEVEL SECURITY;

-- Admins and tech support can view all responses
CREATE POLICY "Admins can view all responses"
  ON public.support_ticket_responses FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'tech_support_lead')
  );

-- Admins and tech support can create responses
CREATE POLICY "Admins can create responses"
  ON public.support_ticket_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = responder_id AND (
      public.has_role(auth.uid(), 'super_admin') OR 
      public.has_role(auth.uid(), 'tech_support_lead')
    )
  );

-- Admins can delete responses
CREATE POLICY "Admins can delete responses"
  ON public.support_ticket_responses FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Add assigned_to column to support_tickets if not present (it exists based on schema)
-- Add index for performance
CREATE INDEX idx_ticket_responses_ticket_id ON public.support_ticket_responses(ticket_id);
