
CREATE TABLE IF NOT EXISTS public.vendx_custom_arcade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- contact
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  -- address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  -- cabinet preferences
  cabinet_style TEXT,            -- upright | cocktail | pedestal | bartop | sit_down
  cabinet_size TEXT,             -- full | mid | mini
  artwork_theme TEXT,
  control_layout TEXT,           -- 1p | 2p | 4p
  trackball BOOLEAN DEFAULT false,
  spinner BOOLEAN DEFAULT false,
  light_gun BOOLEAN DEFAULT false,
  monitor_size TEXT,             -- 19 | 24 | 27 | 32 | 43
  -- games & software
  preferred_platforms TEXT[],    -- mame, nes, snes, sega, n64, ps1, atomiswave, naomi, pc, etc.
  preferred_games TEXT,
  approx_game_count INTEGER,
  online_play BOOLEAN DEFAULT false,
  -- budget / timeline / financing
  budget_range TEXT,             -- under_2k | 2k_4k | 4k_7k | 7k_10k | 10k_plus
  target_delivery_date DATE,
  financing_interest BOOLEAN DEFAULT false,
  in_home_setup BOOLEAN DEFAULT false,
  -- reference machine (optional link to a store product in arcade_sales/arcade_refurbished)
  reference_product_id UUID REFERENCES public.store_products(id) ON DELETE SET NULL,
  additional_notes TEXT,
  -- admin
  status TEXT NOT NULL DEFAULT 'new',  -- new | reviewing | quoted | accepted | declined | completed
  admin_notes TEXT,
  quoted_price NUMERIC,
  quoted_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_custom_arcade_requests TO authenticated;
GRANT INSERT ON public.vendx_custom_arcade_requests TO anon;
GRANT ALL ON public.vendx_custom_arcade_requests TO service_role;

ALTER TABLE public.vendx_custom_arcade_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (including guests) can submit
CREATE POLICY "Anyone can submit custom arcade requests"
  ON public.vendx_custom_arcade_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can view their own requests
CREATE POLICY "Users can view own custom arcade requests"
  ON public.vendx_custom_arcade_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Staff can view all
CREATE POLICY "Staff can view all custom arcade requests"
  ON public.vendx_custom_arcade_requests FOR SELECT
  TO authenticated
  USING (public.is_ext_service_staff(auth.uid()));

-- Staff can update
CREATE POLICY "Staff can update custom arcade requests"
  ON public.vendx_custom_arcade_requests FOR UPDATE
  TO authenticated
  USING (public.is_ext_service_staff(auth.uid()))
  WITH CHECK (public.is_ext_service_staff(auth.uid()));

-- Staff can delete
CREATE POLICY "Staff can delete custom arcade requests"
  ON public.vendx_custom_arcade_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- request number generator
CREATE OR REPLACE FUNCTION public.generate_custom_arcade_request_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := 'CAR-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM()*100000)::TEXT,5,'0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER set_custom_arcade_request_number
  BEFORE INSERT ON public.vendx_custom_arcade_requests
  FOR EACH ROW EXECUTE FUNCTION public.generate_custom_arcade_request_number();

CREATE TRIGGER update_custom_arcade_requests_updated_at
  BEFORE UPDATE ON public.vendx_custom_arcade_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_custom_arcade_requests_status ON public.vendx_custom_arcade_requests(status);
CREATE INDEX idx_custom_arcade_requests_created_at ON public.vendx_custom_arcade_requests(created_at DESC);
