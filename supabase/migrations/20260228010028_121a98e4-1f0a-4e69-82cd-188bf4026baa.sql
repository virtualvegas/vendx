
-- Ad Locations: admin-created ad placements on machines or games
CREATE TABLE public.ad_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  location_type TEXT NOT NULL CHECK (location_type IN ('machine_screen', 'machine_wrap', 'in_game_banner', 'in_game_interstitial')),
  machine_id UUID REFERENCES public.vendx_machines(id) ON DELETE SET NULL,
  game_id UUID REFERENCES public.arcade_game_titles(id) ON DELETE SET NULL,
  pricing_model TEXT NOT NULL DEFAULT 'monthly' CHECK (pricing_model IN ('weekly', 'monthly')),
  price NUMERIC NOT NULL DEFAULT 0,
  estimated_weekly_views INTEGER NOT NULL DEFAULT 0,
  dimensions TEXT,
  max_file_size_mb INTEGER DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ad locations" ON public.ad_locations
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can view active ad locations" ON public.ad_locations
  FOR SELECT TO authenticated USING (is_active = true);

-- Ad Bookings: business owner ad reservations
CREATE TABLE public.ad_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_location_id UUID NOT NULL REFERENCES public.ad_locations(id) ON DELETE CASCADE,
  business_owner_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'completed', 'cancelled')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_price NUMERIC NOT NULL DEFAULT 0,
  ad_creative_url TEXT,
  ad_title TEXT,
  ad_description TEXT,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all bookings" ON public.ad_bookings
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Business owners can view own bookings" ON public.ad_bookings
  FOR SELECT TO authenticated USING (auth.uid() = business_owner_id);

CREATE POLICY "Business owners can create bookings" ON public.ad_bookings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_owner_id);

-- Ad Performance: impressions and stats tracking
CREATE TABLE public.ad_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_booking_id UUID NOT NULL REFERENCES public.ad_bookings(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  estimated_views INTEGER NOT NULL DEFAULT 0,
  actual_views INTEGER,
  clicks INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage performance" ON public.ad_performance
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Business owners can view own performance" ON public.ad_performance
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.ad_bookings WHERE id = ad_booking_id AND business_owner_id = auth.uid())
  );

-- Branded Game Requests: business owner custom game season requests
CREATE TABLE public.branded_game_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id UUID NOT NULL,
  request_type TEXT NOT NULL DEFAULT 'reskin' CHECK (request_type IN ('reskin', 'custom')),
  brand_name TEXT NOT NULL,
  brand_colors JSONB DEFAULT '{}',
  brand_logo_url TEXT,
  game_title_id UUID REFERENCES public.arcade_game_titles(id) ON DELETE SET NULL,
  desired_start_date DATE,
  desired_end_date DATE,
  description TEXT,
  target_locations TEXT[],
  budget_range TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_production', 'live', 'completed', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.branded_game_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage branded game requests" ON public.branded_game_requests
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Business owners can view own requests" ON public.branded_game_requests
  FOR SELECT TO authenticated USING (auth.uid() = business_owner_id);

CREATE POLICY "Business owners can create requests" ON public.branded_game_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_owner_id);

-- Triggers for updated_at
CREATE TRIGGER update_ad_locations_updated_at BEFORE UPDATE ON public.ad_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ad_bookings_updated_at BEFORE UPDATE ON public.ad_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_branded_game_requests_updated_at BEFORE UPDATE ON public.branded_game_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
