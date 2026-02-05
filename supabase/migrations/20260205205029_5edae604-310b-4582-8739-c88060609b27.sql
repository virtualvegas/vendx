-- Create prize reservations table
CREATE TABLE public.prize_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prize_id UUID NOT NULL REFERENCES public.ticket_prizes(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'claimed')),
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prize_reservations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own reservations"
  ON public.prize_reservations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create reservations"
  ON public.prize_reservations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel their own reservations"
  ON public.prize_reservations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all reservations"
  ON public.prize_reservations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'warehouse_logistics', 'employee_operator')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_prize_reservations_updated_at
  BEFORE UPDATE ON public.prize_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_prize_reservations_user ON public.prize_reservations(user_id);
CREATE INDEX idx_prize_reservations_location ON public.prize_reservations(location_id);
CREATE INDEX idx_prize_reservations_status ON public.prize_reservations(status);