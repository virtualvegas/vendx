-- Create prize_wins table to track arcade prize wins
CREATE TABLE public.prize_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  machine_id UUID REFERENCES public.vendx_machines(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.arcade_play_sessions(id) ON DELETE SET NULL,
  prize_name TEXT NOT NULL,
  prize_value INTEGER DEFAULT 0, -- Value in tickets or dollars (cents)
  prize_type TEXT DEFAULT 'standard', -- standard, jackpot, bonus, grand
  photo_url TEXT, -- Optional verification photo
  verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create index for efficient queries
CREATE INDEX idx_prize_wins_user_id ON public.prize_wins(user_id);
CREATE INDEX idx_prize_wins_machine_id ON public.prize_wins(machine_id);
CREATE INDEX idx_prize_wins_location_id ON public.prize_wins(location_id);
CREATE INDEX idx_prize_wins_created_at ON public.prize_wins(created_at DESC);

-- Enable RLS
ALTER TABLE public.prize_wins ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all verified wins (for transparency/engagement)
CREATE POLICY "Anyone can view verified prize wins"
ON public.prize_wins
FOR SELECT
USING (verified = true);

-- Policy: Users can view their own wins (verified or not)
CREATE POLICY "Users can view own prize wins"
ON public.prize_wins
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Admins can view all wins
CREATE POLICY "Admins can view all prize wins"
ON public.prize_wins
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_accounting'));

-- Policy: Admins can insert/update/delete
CREATE POLICY "Admins can manage prize wins"
ON public.prize_wins
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_accounting'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_accounting'));

-- Trigger for updated_at
CREATE TRIGGER update_prize_wins_updated_at
BEFORE UPDATE ON public.prize_wins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live win feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.prize_wins;