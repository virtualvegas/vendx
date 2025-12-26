-- Video Games Table
CREATE TABLE public.video_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT,
  full_description TEXT,
  platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  release_status TEXT NOT NULL DEFAULT 'coming_soon' CHECK (release_status IN ('live', 'beta', 'coming_soon')),
  cover_image_url TEXT,
  screenshots JSONB DEFAULT '[]'::jsonb,
  trailer_url TEXT,
  google_play_url TEXT,
  apple_store_url TEXT,
  microsoft_store_url TEXT,
  steam_url TEXT,
  itch_io_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_games ENABLE ROW LEVEL SECURITY;

-- RLS Policies for video_games
CREATE POLICY "Anyone can view active video games" 
ON public.video_games 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Super admins can manage video games" 
ON public.video_games 
FOR ALL 
USING (is_super_admin(auth.uid()));

-- Arcade Game Titles (catalog of arcade games that can be at locations)
CREATE TABLE public.arcade_game_titles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  game_type TEXT NOT NULL CHECK (game_type IN ('claw', 'cabinet', 'redemption', 'simulator', 'racing', 'shooter', 'sports', 'rhythm', 'vr', 'other')),
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.arcade_game_titles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for arcade_game_titles
CREATE POLICY "Anyone can view active arcade games" 
ON public.arcade_game_titles 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Super admins can manage arcade games" 
ON public.arcade_game_titles 
FOR ALL 
USING (is_super_admin(auth.uid()));

-- Location arcade games junction table
CREATE TABLE public.location_arcade_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  arcade_game_id UUID NOT NULL REFERENCES public.arcade_game_titles(id) ON DELETE CASCADE,
  machine_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(location_id, arcade_game_id)
);

-- Enable RLS
ALTER TABLE public.location_arcade_games ENABLE ROW LEVEL SECURITY;

-- RLS Policies for location_arcade_games
CREATE POLICY "Anyone can view active location arcade games" 
ON public.location_arcade_games 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Super admins can manage location arcade games" 
ON public.location_arcade_games 
FOR ALL 
USING (is_super_admin(auth.uid()));

-- Add location_category to locations table for vending/arcade/mixed
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS location_category TEXT DEFAULT 'vending' CHECK (location_category IN ('vending', 'arcade', 'mixed'));

-- Add vending machine counts to locations
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS snack_machine_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS drink_machine_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS combo_machine_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS specialty_machine_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS arcade_machine_count INTEGER DEFAULT 0;

-- Create indexes for performance
CREATE INDEX idx_video_games_release_status ON public.video_games(release_status);
CREATE INDEX idx_video_games_is_active ON public.video_games(is_active);
CREATE INDEX idx_arcade_game_titles_game_type ON public.arcade_game_titles(game_type);
CREATE INDEX idx_location_arcade_games_location ON public.location_arcade_games(location_id);
CREATE INDEX idx_locations_category ON public.locations(location_category);

-- Update trigger for video_games
CREATE TRIGGER update_video_games_updated_at
BEFORE UPDATE ON public.video_games
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for arcade_game_titles
CREATE TRIGGER update_arcade_game_titles_updated_at
BEFORE UPDATE ON public.arcade_game_titles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();