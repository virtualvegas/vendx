
-- =====================================================
-- VENDX QUESTS SYSTEM - Complete Database Schema
-- =====================================================

-- Quest node rarity enum
CREATE TYPE public.quest_node_rarity AS ENUM ('common', 'rare', 'epic', 'legendary');

-- Quest type enum  
CREATE TYPE public.quest_type AS ENUM ('free', 'game', 'paid', 'order');

-- Quest status enum
CREATE TYPE public.quest_status AS ENUM ('active', 'inactive', 'scheduled', 'expired');

-- Quest completion status enum
CREATE TYPE public.quest_completion_status AS ENUM ('in_progress', 'completed', 'claimed', 'expired');

-- =====================================================
-- QUEST NODES (Physical & Virtual Locations)
-- =====================================================
CREATE TABLE public.quest_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  -- Link to existing location/machine or be standalone
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  machine_id UUID REFERENCES public.vendx_machines(id) ON DELETE SET NULL,
  -- Standalone coordinates for event locations
  latitude NUMERIC,
  longitude NUMERIC,
  radius_meters INTEGER DEFAULT 50,
  -- Node properties
  rarity quest_node_rarity NOT NULL DEFAULT 'common',
  node_type TEXT NOT NULL DEFAULT 'vending', -- vending, arcade, claw, partner, event, virtual
  is_active BOOLEAN DEFAULT true,
  is_virtual BOOLEAN DEFAULT false, -- For game-only quests
  -- Appearance
  icon_url TEXT,
  color TEXT DEFAULT '#00d4ff',
  -- Timing
  available_from TIMESTAMP WITH TIME ZONE,
  available_until TIMESTAMP WITH TIME ZONE,
  cooldown_hours INTEGER DEFAULT 24,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- QUESTS (What players need to do)
-- =====================================================
CREATE TABLE public.quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  short_description TEXT,
  -- Quest configuration
  quest_type quest_type NOT NULL DEFAULT 'free',
  status quest_status NOT NULL DEFAULT 'active',
  -- Requirements
  xp_reward INTEGER NOT NULL DEFAULT 10,
  points_reward INTEGER DEFAULT 0,
  credits_reward NUMERIC DEFAULT 0,
  -- For paid quests
  required_purchase_amount NUMERIC,
  required_product_id UUID REFERENCES public.store_products(id) ON DELETE SET NULL,
  -- For game quests
  required_game_id UUID REFERENCES public.arcade_game_titles(id) ON DELETE SET NULL,
  required_score INTEGER,
  required_achievement TEXT,
  -- Location requirements
  requires_checkin BOOLEAN DEFAULT false,
  requires_qr_scan BOOLEAN DEFAULT false,
  requires_transaction BOOLEAN DEFAULT false,
  -- Timing
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  -- Limits
  max_completions_per_user INTEGER DEFAULT 1,
  max_total_completions INTEGER,
  current_completions INTEGER DEFAULT 0,
  -- Display
  icon_url TEXT,
  difficulty TEXT DEFAULT 'easy', -- easy, medium, hard, extreme
  estimated_time_minutes INTEGER,
  sort_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- QUEST NODE ASSIGNMENTS (Which quests are at which nodes)
-- =====================================================
CREATE TABLE public.quest_node_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES public.quest_nodes(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(quest_id, node_id)
);

-- =====================================================
-- QUEST REWARDS (Multiple rewards per quest)
-- =====================================================
CREATE TABLE public.quest_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL, -- 'xp', 'credits', 'points', 'free_play', 'discount', 'mystery', 'item'
  reward_value NUMERIC, -- Amount for credits/points/xp/discount percentage
  reward_item_id UUID, -- Reference to reward_catalog for physical items
  reward_code TEXT, -- For discount codes
  is_guaranteed BOOLEAN DEFAULT true,
  drop_chance NUMERIC DEFAULT 100, -- Percentage for random drops
  rarity_multiplier NUMERIC DEFAULT 1, -- Bonus based on node rarity
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- QUEST CHAINS (Sequential quests)
-- =====================================================
CREATE TABLE public.quest_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  total_quests INTEGER DEFAULT 0,
  bonus_xp INTEGER DEFAULT 0,
  bonus_credits NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.quest_chain_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID NOT NULL REFERENCES public.quest_chains(id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(chain_id, step_order)
);

-- =====================================================
-- PLAYER PROGRESSION
-- =====================================================
CREATE TABLE public.quest_player_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- XP and Level
  total_xp INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  -- Stats
  quests_completed INTEGER DEFAULT 0,
  nodes_discovered INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_quest_date DATE,
  -- Totals
  total_credits_earned NUMERIC DEFAULT 0,
  total_points_earned INTEGER DEFAULT 0,
  total_distance_traveled NUMERIC DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- =====================================================
-- QUEST COMPLETIONS (Track player quest progress)
-- =====================================================
CREATE TABLE public.quest_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  node_id UUID REFERENCES public.quest_nodes(id) ON DELETE SET NULL,
  -- Status
  status quest_completion_status NOT NULL DEFAULT 'in_progress',
  progress_data JSONB DEFAULT '{}', -- For tracking partial completion
  -- Completion info
  completed_at TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  -- Location verification
  checkin_latitude NUMERIC,
  checkin_longitude NUMERIC,
  verified_via TEXT, -- 'gps', 'qr', 'transaction', 'game'
  -- Rewards received
  xp_earned INTEGER DEFAULT 0,
  credits_earned NUMERIC DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  rewards_data JSONB DEFAULT '[]', -- List of rewards received
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- NODE DISCOVERIES (Track which nodes players have found)
-- =====================================================
CREATE TABLE public.quest_node_discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES public.quest_nodes(id) ON DELETE CASCADE,
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_visited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  visit_count INTEGER DEFAULT 1,
  UNIQUE(user_id, node_id)
);

-- =====================================================
-- PLAYER BADGES/ACHIEVEMENTS
-- =====================================================
CREATE TABLE public.quest_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  category TEXT DEFAULT 'general', -- general, exploration, quests, streaks, spending
  requirement_type TEXT NOT NULL, -- 'quests_completed', 'nodes_discovered', 'streak', 'level', 'xp', 'special'
  requirement_value INTEGER,
  xp_reward INTEGER DEFAULT 0,
  is_hidden BOOLEAN DEFAULT false, -- Secret badges
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.quest_player_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.quest_badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- =====================================================
-- LEADERBOARDS
-- =====================================================
CREATE TABLE public.quest_leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'alltime'
  period_start DATE NOT NULL,
  region TEXT, -- Optional regional filtering
  xp_earned INTEGER DEFAULT 0,
  quests_completed INTEGER DEFAULT 0,
  nodes_visited INTEGER DEFAULT 0,
  rank INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, period, period_start, region)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_quest_nodes_location ON public.quest_nodes(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX idx_quest_nodes_coords ON public.quest_nodes(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX idx_quest_nodes_active ON public.quest_nodes(is_active, rarity);
CREATE INDEX idx_quests_status ON public.quests(status, quest_type);
CREATE INDEX idx_quests_featured ON public.quests(is_featured, status) WHERE is_featured = true;
CREATE INDEX idx_quest_completions_user ON public.quest_completions(user_id, status);
CREATE INDEX idx_quest_completions_quest ON public.quest_completions(quest_id, status);
CREATE INDEX idx_quest_player_progress_user ON public.quest_player_progress(user_id);
CREATE INDEX idx_quest_player_progress_level ON public.quest_player_progress(current_level DESC);
CREATE INDEX idx_quest_leaderboards_period ON public.quest_leaderboards(period, period_start, rank);
CREATE INDEX idx_quest_node_discoveries_user ON public.quest_node_discoveries(user_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.quest_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_node_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_chain_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_player_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_node_discoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_player_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_leaderboards ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - Public Read for Active Content
-- =====================================================
-- Quest Nodes
CREATE POLICY "Anyone can view active quest nodes" ON public.quest_nodes
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage quest nodes" ON public.quest_nodes
  FOR ALL USING (is_super_admin(auth.uid()));

-- Quests
CREATE POLICY "Anyone can view active quests" ON public.quests
  FOR SELECT USING (status = 'active');
CREATE POLICY "Admins can manage quests" ON public.quests
  FOR ALL USING (is_super_admin(auth.uid()));

-- Quest Node Assignments
CREATE POLICY "Anyone can view active assignments" ON public.quest_node_assignments
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage assignments" ON public.quest_node_assignments
  FOR ALL USING (is_super_admin(auth.uid()));

-- Quest Rewards
CREATE POLICY "Anyone can view quest rewards" ON public.quest_rewards
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage quest rewards" ON public.quest_rewards
  FOR ALL USING (is_super_admin(auth.uid()));

-- Quest Chains
CREATE POLICY "Anyone can view active chains" ON public.quest_chains
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage quest chains" ON public.quest_chains
  FOR ALL USING (is_super_admin(auth.uid()));

-- Quest Chain Steps
CREATE POLICY "Anyone can view chain steps" ON public.quest_chain_steps
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage chain steps" ON public.quest_chain_steps
  FOR ALL USING (is_super_admin(auth.uid()));

-- Quest Badges
CREATE POLICY "Anyone can view visible badges" ON public.quest_badges
  FOR SELECT USING (is_hidden = false);
CREATE POLICY "Admins can manage badges" ON public.quest_badges
  FOR ALL USING (is_super_admin(auth.uid()));

-- =====================================================
-- RLS POLICIES - User-Specific Data
-- =====================================================
-- Player Progress
CREATE POLICY "Users can view own progress" ON public.quest_player_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.quest_player_progress
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.quest_player_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all progress" ON public.quest_player_progress
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Quest Completions
CREATE POLICY "Users can view own completions" ON public.quest_completions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own completions" ON public.quest_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own completions" ON public.quest_completions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all completions" ON public.quest_completions
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Node Discoveries
CREATE POLICY "Users can view own discoveries" ON public.quest_node_discoveries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own discoveries" ON public.quest_node_discoveries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own discoveries" ON public.quest_node_discoveries
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all discoveries" ON public.quest_node_discoveries
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Player Badges
CREATE POLICY "Users can view own badges" ON public.quest_player_badges
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert badges" ON public.quest_player_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage player badges" ON public.quest_player_badges
  FOR ALL USING (is_super_admin(auth.uid()));

-- Leaderboards
CREATE POLICY "Anyone can view leaderboards" ON public.quest_leaderboards
  FOR SELECT USING (true);
CREATE POLICY "Users can update own leaderboard entry" ON public.quest_leaderboards
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own leaderboard entry" ON public.quest_leaderboards
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage leaderboards" ON public.quest_leaderboards
  FOR ALL USING (is_super_admin(auth.uid()));

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_quest_nodes_updated_at
  BEFORE UPDATE ON public.quest_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quests_updated_at
  BEFORE UPDATE ON public.quests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quest_chains_updated_at
  BEFORE UPDATE ON public.quest_chains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quest_player_progress_updated_at
  BEFORE UPDATE ON public.quest_player_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quest_completions_updated_at
  BEFORE UPDATE ON public.quest_completions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quest_leaderboards_updated_at
  BEFORE UPDATE ON public.quest_leaderboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTION: Initialize player progress on first quest
-- =====================================================
CREATE OR REPLACE FUNCTION public.init_quest_player_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.quest_player_progress (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER init_player_on_first_completion
  BEFORE INSERT ON public.quest_completions
  FOR EACH ROW EXECUTE FUNCTION init_quest_player_progress();

-- =====================================================
-- FUNCTION: Calculate player level from XP
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_quest_level(xp INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Level formula: each level requires progressively more XP
  -- Level 1: 0 XP, Level 2: 100 XP, Level 3: 300 XP, Level 4: 600 XP, etc.
  RETURN GREATEST(1, FLOOR((-1 + SQRT(1 + 8 * xp / 100.0)) / 2) + 1)::INTEGER;
END;
$$;

-- =====================================================
-- SAMPLE BADGES
-- =====================================================
INSERT INTO public.quest_badges (name, description, icon_url, category, requirement_type, requirement_value, xp_reward) VALUES
('First Steps', 'Complete your first quest', NULL, 'quests', 'quests_completed', 1, 25),
('Explorer', 'Discover 5 quest nodes', NULL, 'exploration', 'nodes_discovered', 5, 50),
('Adventurer', 'Discover 25 quest nodes', NULL, 'exploration', 'nodes_discovered', 25, 150),
('Quest Master', 'Complete 50 quests', NULL, 'quests', 'quests_completed', 50, 500),
('Streak Starter', 'Achieve a 3-day streak', NULL, 'streaks', 'streak', 3, 75),
('Dedicated', 'Achieve a 7-day streak', NULL, 'streaks', 'streak', 7, 200),
('Level 5', 'Reach level 5', NULL, 'general', 'level', 5, 100),
('Level 10', 'Reach level 10', NULL, 'general', 'level', 10, 250),
('Legendary Hunter', 'Complete a quest at a Legendary node', NULL, 'exploration', 'special', 1, 300);
