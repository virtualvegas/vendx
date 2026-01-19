-- Create stands table for amusement/concession stands
CREATE TABLE public.stands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  story TEXT,
  brand_future_focus TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'retired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stand_events table for tracking which events stands will be at
CREATE TABLE public.stand_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stand_id UUID NOT NULL REFERENCES public.stands(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_location TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_end_date DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stand_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for stands - public read, admin write
CREATE POLICY "Stands are viewable by everyone" 
ON public.stands FOR SELECT USING (true);

CREATE POLICY "Admins can manage stands" 
ON public.stands FOR ALL 
USING (public.is_super_admin(auth.uid()));

-- RLS policies for stand_events - public read, admin write
CREATE POLICY "Stand events are viewable by everyone" 
ON public.stand_events FOR SELECT USING (true);

CREATE POLICY "Admins can manage stand events" 
ON public.stand_events FOR ALL 
USING (public.is_super_admin(auth.uid()));

-- Add updated_at triggers
CREATE TRIGGER update_stands_updated_at
BEFORE UPDATE ON public.stands
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stand_events_updated_at
BEFORE UPDATE ON public.stand_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();