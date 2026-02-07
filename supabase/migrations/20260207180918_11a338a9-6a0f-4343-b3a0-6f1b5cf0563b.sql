-- Create quest_chain_claims table for tracking chain completion bonuses
CREATE TABLE IF NOT EXISTS public.quest_chain_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chain_id UUID NOT NULL REFERENCES public.quest_chains(id) ON DELETE CASCADE,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  bonus_xp_awarded INTEGER DEFAULT 0,
  bonus_credits_awarded NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, chain_id)
);

-- Create quest_daily_claims table for tracking daily challenge rewards
CREATE TABLE IF NOT EXISTS public.quest_daily_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  claim_date DATE NOT NULL,
  challenges_claimed TEXT[] DEFAULT '{}',
  total_xp_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, claim_date)
);

-- Enable RLS
ALTER TABLE public.quest_chain_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_daily_claims ENABLE ROW LEVEL SECURITY;

-- RLS policies for quest_chain_claims
CREATE POLICY "Users can view their own chain claims" 
ON public.quest_chain_claims 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chain claims" 
ON public.quest_chain_claims 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS policies for quest_daily_claims
CREATE POLICY "Users can view their own daily claims" 
ON public.quest_daily_claims 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily claims" 
ON public.quest_daily_claims 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily claims" 
ON public.quest_daily_claims 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create a helper function to increment player XP
CREATE OR REPLACE FUNCTION public.increment_player_xp(p_user_id UUID, p_xp INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE quest_player_progress
  SET 
    total_xp = total_xp + p_xp,
    current_level = calculate_quest_level(total_xp + p_xp),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;