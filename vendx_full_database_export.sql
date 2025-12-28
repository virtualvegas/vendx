-- ============================================================
-- VENDX COMPLETE DATABASE EXPORT
-- Generated: 2025-12-28
-- 
-- This file contains:
-- 1. Enum types
-- 2. Helper functions
-- 3. All tables with structure
-- 4. Triggers
-- 5. Row Level Security (RLS) policies
-- 6. Storage buckets
-- 7. Data inserts
--
-- INSTRUCTIONS:
-- 1. Create a new Supabase project
-- 2. Go to SQL Editor in Supabase Dashboard
-- 3. Run this entire script
-- 4. Copy your Edge Functions from supabase/functions/ folder
-- 5. Update environment variables with new project credentials
-- ============================================================

-- ============================================================
-- PART 1: ENUM TYPES
-- ============================================================

CREATE TYPE public.app_role AS ENUM (
  'super_admin',
  'global_operations_manager', 
  'regional_manager',
  'finance_accounting',
  'marketing_sales',
  'tech_support_lead',
  'warehouse_logistics',
  'business_owner',
  'employee_operator',
  'event_manager',
  'customer'
);

-- ============================================================
-- PART 2: HELPER FUNCTIONS
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to generate TOTP secret
CREATE OR REPLACE FUNCTION public.generate_totp_secret()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..16 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'VX-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS BOOLEAN AS $$
  SELECT public.has_role(_user_id, 'super_admin')
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, totp_secret)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name', generate_totp_secret());
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to assign default role to new user
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to handle new user VendX Pay setup
CREATE OR REPLACE FUNCTION public.handle_new_user_vendx_pay()
RETURNS TRIGGER AS $$
BEGIN
  -- Create wallet for new user
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0);
  
  -- Create rewards points record for new user
  INSERT INTO public.rewards_points (user_id, balance, lifetime_points, tier)
  VALUES (NEW.id, 0, 0, 'bronze');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to update user tier based on lifetime points
CREATE OR REPLACE FUNCTION public.update_user_tier()
RETURNS TRIGGER AS $$
DECLARE
  new_tier text;
BEGIN
  IF NEW.lifetime_points >= 100000 THEN
    new_tier := 'platinum';
  ELSIF NEW.lifetime_points >= 25000 THEN
    new_tier := 'gold';
  ELSIF NEW.lifetime_points >= 5000 THEN
    new_tier := 'silver';
  ELSE
    new_tier := 'bronze';
  END IF;
  
  IF NEW.tier != new_tier THEN
    NEW.tier := new_tier;
    UPDATE public.profiles SET tier_level = new_tier WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to auto-schedule stop from support ticket
CREATE OR REPLACE FUNCTION public.auto_schedule_stop_from_ticket()
RETURNS TRIGGER AS $$
DECLARE
  v_zone_id UUID;
  v_location_id UUID;
  v_machine_id UUID;
  v_machine_name TEXT;
  v_location_name TEXT;
  v_address TEXT;
  v_max_order INTEGER;
  v_scheduled_date DATE;
BEGIN
  IF NEW.machine_id = 'CONTACT_FORM' THEN
    RETURN NEW;
  END IF;
  
  SELECT vm.id, vm.name, vm.location_id, l.name, l.address || ', ' || l.city
  INTO v_machine_id, v_machine_name, v_location_id, v_location_name, v_address
  FROM vendx_machines vm
  LEFT JOIN locations l ON vm.location_id = l.id
  WHERE vm.id::text = NEW.machine_id OR vm.machine_code = NEW.machine_id;
  
  IF v_machine_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT sr.id INTO v_zone_id
  FROM service_routes sr
  JOIN route_stops rs ON rs.route_id = sr.id
  WHERE rs.location_id = v_location_id OR rs.machine_id = v_machine_id
  AND sr.status = 'active'
  LIMIT 1;
  
  IF v_zone_id IS NULL THEN
    SELECT id INTO v_zone_id FROM service_routes WHERE status = 'active' LIMIT 1;
  END IF;
  
  IF v_zone_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  v_scheduled_date := CURRENT_DATE + INTERVAL '1 day';
  IF EXTRACT(DOW FROM v_scheduled_date) = 0 THEN
    v_scheduled_date := v_scheduled_date + INTERVAL '1 day';
  ELSIF EXTRACT(DOW FROM v_scheduled_date) = 6 THEN
    v_scheduled_date := v_scheduled_date + INTERVAL '2 days';
  END IF;
  
  SELECT COALESCE(MAX(stop_order), 0) + 1 INTO v_max_order
  FROM route_stops WHERE route_id = v_zone_id;
  
  INSERT INTO route_stops (
    route_id, stop_name, address, notes, stop_order, 
    location_id, machine_id, scheduled_date, priority,
    auto_scheduled, source_ticket_id, status
  ) VALUES (
    v_zone_id,
    COALESCE(v_machine_name, v_location_name, 'Service Call'),
    v_address,
    'Auto-scheduled from ticket: ' || NEW.ticket_number || E'\n' || NEW.description,
    v_max_order,
    v_location_id,
    v_machine_id,
    v_scheduled_date,
    CASE 
      WHEN NEW.priority = 'critical' THEN 'urgent'
      WHEN NEW.priority = 'high' THEN 'high'
      ELSE 'normal'
    END,
    TRUE,
    NEW.id,
    'pending'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- PART 3: TABLES
-- ============================================================

-- User Roles Table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles Table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  stripe_customer_id TEXT,
  tier_level TEXT NOT NULL DEFAULT 'bronze',
  totp_secret TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Wallets Table
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  last_loaded TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Wallet Transactions Table
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id),
  amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL,
  description TEXT,
  stripe_payment_intent_id TEXT,
  machine_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Rewards Points Table
CREATE TABLE public.rewards_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.rewards_points ENABLE ROW LEVEL SECURITY;

-- Point Transactions Table
CREATE TABLE public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- Locations Table
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  address TEXT,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  machine_count INTEGER NOT NULL DEFAULT 0,
  snack_machine_count INTEGER DEFAULT 0,
  drink_machine_count INTEGER DEFAULT 0,
  combo_machine_count INTEGER DEFAULT 0,
  specialty_machine_count INTEGER DEFAULT 0,
  arcade_machine_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  is_visible BOOLEAN NOT NULL DEFAULT true,
  location_type TEXT DEFAULT 'office',
  location_category TEXT DEFAULT 'vending',
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- VendX Machines Table
CREATE TABLE public.vendx_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_code TEXT NOT NULL,
  name TEXT NOT NULL,
  machine_type TEXT NOT NULL,
  api_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  location_id UUID REFERENCES public.locations(id),
  vendx_pay_enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  last_seen TIMESTAMP WITH TIME ZONE,
  installed_at TIMESTAMP WITH TIME ZONE,
  current_period_revenue NUMERIC DEFAULT 0,
  lifetime_revenue NUMERIC DEFAULT 0,
  last_revenue_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.vendx_machines ENABLE ROW LEVEL SECURITY;

-- Machine Sessions Table
CREATE TABLE public.machine_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.vendx_machines(id),
  user_id UUID,
  session_code TEXT NOT NULL,
  session_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.machine_sessions ENABLE ROW LEVEL SECURITY;

-- Machine Transactions Table
CREATE TABLE public.machine_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.vendx_machines(id),
  user_id UUID,
  wallet_transaction_id UUID REFERENCES public.wallet_transactions(id),
  session_id UUID REFERENCES public.machine_sessions(id),
  amount NUMERIC NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  item_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.machine_transactions ENABLE ROW LEVEL SECURITY;

-- Machine Inventory Table
CREATE TABLE public.machine_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.vendx_machines(id),
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  slot_number TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  max_capacity INTEGER NOT NULL DEFAULT 10,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  cost_of_goods NUMERIC DEFAULT 0,
  last_restocked TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.machine_inventory ENABLE ROW LEVEL SECURITY;

-- Machine Kiosk Categories Table
CREATE TABLE public.machine_kiosk_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.vendx_machines(id),
  category_name TEXT NOT NULL,
  base_price NUMERIC NOT NULL DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.machine_kiosk_categories ENABLE ROW LEVEL SECURITY;

-- Machine Profit Splits Table
CREATE TABLE public.machine_profit_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL,
  vendx_percentage NUMERIC NOT NULL DEFAULT 70,
  business_owner_percentage NUMERIC NOT NULL DEFAULT 30,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.machine_profit_splits ENABLE ROW LEVEL SECURITY;

-- Location Assignments Table
CREATE TABLE public.location_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id),
  business_owner_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.location_assignments ENABLE ROW LEVEL SECURITY;

-- Divisions Table
CREATE TABLE public.divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;

-- Metrics Table
CREATE TABLE public.metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  metric_label TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  display_order INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;

-- Jobs Table
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  location TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'full-time',
  description TEXT NOT NULL,
  requirements TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Job Applications Table
CREATE TABLE public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id),
  applicant_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  resume_url TEXT,
  cover_letter TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  reviewed_by UUID,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Events Table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  machines_deployed INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Daily Tasks Table
CREATE TABLE public.daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  assigned_to UUID,
  created_by UUID,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

-- Support Tickets Table
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL,
  machine_id TEXT NOT NULL,
  location TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  description TEXT NOT NULL,
  resolution TEXT,
  assigned_to UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Service Routes Table
CREATE TABLE public.service_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  zone_area TEXT,
  assigned_to UUID,
  created_by UUID,
  service_frequency_days INTEGER DEFAULT 15,
  last_serviced_at TIMESTAMP WITH TIME ZONE,
  next_service_due TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.service_routes ENABLE ROW LEVEL SECURITY;

-- Route Stops Table
CREATE TABLE public.route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.service_routes(id),
  stop_name TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  stop_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  location_id UUID REFERENCES public.locations(id),
  machine_id UUID REFERENCES public.vendx_machines(id),
  scheduled_date DATE,
  estimated_duration_minutes INTEGER DEFAULT 15,
  auto_scheduled BOOLEAN DEFAULT false,
  source_ticket_id UUID REFERENCES public.support_tickets(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

-- Restock Logs Table
CREATE TABLE public.restock_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.vendx_machines(id),
  performed_by UUID,
  items_restocked JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.restock_logs ENABLE ROW LEVEL SECURITY;

-- Regions Table
CREATE TABLE public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  active_machines INTEGER NOT NULL DEFAULT 0,
  monthly_revenue NUMERIC NOT NULL DEFAULT 0,
  monthly_transactions INTEGER NOT NULL DEFAULT 0,
  growth_rate NUMERIC NOT NULL DEFAULT 0,
  manager_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

-- Inventory Items Table (Warehouse)
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL,
  supplier TEXT,
  last_restocked TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Financial Transactions Table
CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  division_id UUID REFERENCES public.divisions(id),
  transaction_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- Marketing Campaigns Table
CREATE TABLE public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL,
  end_date DATE,
  budget NUMERIC NOT NULL DEFAULT 0,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- Reward Catalog Table
CREATE TABLE public.reward_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL,
  points_cost INTEGER NOT NULL,
  credit_amount NUMERIC,
  image_url TEXT,
  tier_required TEXT DEFAULT 'bronze',
  requires_shipping BOOLEAN NOT NULL DEFAULT false,
  stock INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.reward_catalog ENABLE ROW LEVEL SECURITY;

-- Partner Offers Table
CREATE TABLE public.partner_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name TEXT NOT NULL,
  offer_name TEXT NOT NULL,
  description TEXT,
  discount_code TEXT NOT NULL,
  discount_type TEXT NOT NULL,
  discount_value NUMERIC NOT NULL,
  points_cost INTEGER NOT NULL,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  max_redemptions INTEGER,
  current_redemptions INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_offers ENABLE ROW LEVEL SECURITY;

-- Shipping Addresses Table
CREATE TABLE public.shipping_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'USA',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.shipping_addresses ENABLE ROW LEVEL SECURITY;

-- Redemptions Table
CREATE TABLE public.redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reward_id UUID NOT NULL REFERENCES public.reward_catalog(id),
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  shipping_address_id UUID REFERENCES public.shipping_addresses(id),
  tracking_number TEXT,
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

-- Arcade Game Titles Table
CREATE TABLE public.arcade_game_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  game_type TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.arcade_game_titles ENABLE ROW LEVEL SECURITY;

-- Location Arcade Games Table
CREATE TABLE public.location_arcade_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id),
  arcade_game_id UUID NOT NULL REFERENCES public.arcade_game_titles(id),
  machine_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.location_arcade_games ENABLE ROW LEVEL SECURITY;

-- Video Games Table
CREATE TABLE public.video_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  short_description TEXT,
  full_description TEXT,
  release_status TEXT NOT NULL DEFAULT 'coming_soon',
  cover_image_url TEXT,
  trailer_url TEXT,
  platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  screenshots JSONB DEFAULT '[]'::jsonb,
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
ALTER TABLE public.video_games ENABLE ROW LEVEL SECURITY;

-- Store Products Table
CREATE TABLE public.store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  compare_at_price NUMERIC,
  images TEXT[] DEFAULT '{}'::text[],
  stock INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  is_subscription BOOLEAN DEFAULT false,
  subscription_interval TEXT,
  subscription_price NUMERIC,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

-- Store Product Addons Table
CREATE TABLE public.store_product_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.store_products(id),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  stripe_price_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.store_product_addons ENABLE ROW LEVEL SECURITY;

-- Store Carts Table
CREATE TABLE public.store_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.store_carts ENABLE ROW LEVEL SECURITY;

-- Store Cart Items Table
CREATE TABLE public.store_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES public.store_carts(id),
  product_id UUID REFERENCES public.store_products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  addon_ids TEXT[] DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.store_cart_items ENABLE ROW LEVEL SECURITY;

-- Store Orders Table
CREATE TABLE public.store_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  order_number TEXT NOT NULL,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  shipping_address_id UUID REFERENCES public.shipping_addresses(id),
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;

-- Store Order Items Table
CREATE TABLE public.store_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.store_orders(id),
  product_id UUID REFERENCES public.store_products(id),
  product_name TEXT NOT NULL,
  product_price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  addon_details JSONB DEFAULT '[]'::jsonb,
  total NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;

-- Store Subscriptions Table
CREATE TABLE public.store_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID REFERENCES public.store_products(id),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  addon_ids TEXT[],
  shipping_address_id UUID REFERENCES public.shipping_addresses(id),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;

-- Payouts Table
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_revenue NUMERIC NOT NULL,
  vendx_share NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_reference TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Payout Line Items Table
CREATE TABLE public.payout_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL REFERENCES public.payouts(id),
  machine_id UUID NOT NULL,
  location_id UUID NOT NULL,
  gross_revenue NUMERIC NOT NULL,
  vendx_percentage NUMERIC NOT NULL,
  vendx_share NUMERIC NOT NULL,
  owner_share NUMERIC NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.payout_line_items ENABLE ROW LEVEL SECURITY;

-- Payout Settings Table
CREATE TABLE public.payout_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  stripe_account_id TEXT,
  bank_name TEXT,
  bank_account_last4 TEXT,
  bank_routing_last4 TEXT,
  payout_frequency TEXT NOT NULL DEFAULT 'monthly',
  minimum_payout_amount NUMERIC NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.payout_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 4: TRIGGERS
-- ============================================================

-- Create trigger for new user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create trigger for assigning default role
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- Create trigger for VendX Pay setup
CREATE TRIGGER on_auth_user_created_vendx_pay
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_vendx_pay();

-- Create trigger for updating user tier
CREATE TRIGGER update_user_tier_trigger
  BEFORE UPDATE ON public.rewards_points
  FOR EACH ROW EXECUTE FUNCTION public.update_user_tier();

-- Create trigger for order number generation
CREATE TRIGGER generate_order_number_trigger
  BEFORE INSERT ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

-- Create trigger for auto-scheduling from tickets
CREATE TRIGGER auto_schedule_from_ticket
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.auto_schedule_stop_from_ticket();

-- Updated_at triggers for all relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rewards_points_updated_at BEFORE UPDATE ON public.rewards_points FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vendx_machines_updated_at BEFORE UPDATE ON public.vendx_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_machine_inventory_updated_at BEFORE UPDATE ON public.machine_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_machine_kiosk_categories_updated_at BEFORE UPDATE ON public.machine_kiosk_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_machine_profit_splits_updated_at BEFORE UPDATE ON public.machine_profit_splits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_divisions_updated_at BEFORE UPDATE ON public.divisions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_job_applications_updated_at BEFORE UPDATE ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_daily_tasks_updated_at BEFORE UPDATE ON public.daily_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_service_routes_updated_at BEFORE UPDATE ON public.service_routes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_route_stops_updated_at BEFORE UPDATE ON public.route_stops FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_regions_updated_at BEFORE UPDATE ON public.regions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_financial_transactions_updated_at BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marketing_campaigns_updated_at BEFORE UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reward_catalog_updated_at BEFORE UPDATE ON public.reward_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_partner_offers_updated_at BEFORE UPDATE ON public.partner_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shipping_addresses_updated_at BEFORE UPDATE ON public.shipping_addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_redemptions_updated_at BEFORE UPDATE ON public.redemptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_arcade_game_titles_updated_at BEFORE UPDATE ON public.arcade_game_titles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_video_games_updated_at BEFORE UPDATE ON public.video_games FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_store_products_updated_at BEFORE UPDATE ON public.store_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_store_carts_updated_at BEFORE UPDATE ON public.store_carts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_store_orders_updated_at BEFORE UPDATE ON public.store_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_store_subscriptions_updated_at BEFORE UPDATE ON public.store_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payouts_updated_at BEFORE UPDATE ON public.payouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payout_settings_updated_at BEFORE UPDATE ON public.payout_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PART 5: ROW LEVEL SECURITY POLICIES
-- ============================================================

-- User Roles Policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage all roles" ON public.user_roles FOR ALL USING (is_super_admin(auth.uid()));

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (is_super_admin(auth.uid()));

-- Wallets Policies
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all wallets" ON public.wallets FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));

-- Wallet Transactions Policies
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.user_id = auth.uid())
);
CREATE POLICY "Admins can view all transactions" ON public.wallet_transactions FOR SELECT USING (
  has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting')
);

-- Rewards Points Policies
CREATE POLICY "Users can view own points" ON public.rewards_points FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own points" ON public.rewards_points FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert points" ON public.rewards_points FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all points" ON public.rewards_points FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales'));

-- Point Transactions Policies
CREATE POLICY "Users can view own point transactions" ON public.point_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all point transactions" ON public.point_transactions FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales'));

-- Locations Policies
CREATE POLICY "Anyone can view visible locations" ON public.locations FOR SELECT USING (is_visible = true OR is_super_admin(auth.uid()));
CREATE POLICY "Admins can manage locations" ON public.locations FOR ALL USING (is_super_admin(auth.uid()));

-- VendX Machines Policies
CREATE POLICY "Admins can manage machines" ON public.vendx_machines FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'tech_support_lead'));

-- Machine Sessions Policies
CREATE POLICY "Users can view own sessions" ON public.machine_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage sessions" ON public.machine_sessions FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'tech_support_lead'));

-- Machine Transactions Policies
CREATE POLICY "Users can view own machine transactions" ON public.machine_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all machine transactions" ON public.machine_transactions FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'tech_support_lead') OR has_role(auth.uid(), 'finance_accounting'));

-- Machine Inventory Policies
CREATE POLICY "Admins can manage machine inventory" ON public.machine_inventory FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'warehouse_logistics') OR has_role(auth.uid(), 'tech_support_lead'));
CREATE POLICY "Operators can view assigned machine inventory" ON public.machine_inventory FOR SELECT USING (
  EXISTS (SELECT 1 FROM route_stops rs JOIN service_routes sr ON rs.route_id = sr.id WHERE rs.machine_id = machine_inventory.machine_id AND sr.assigned_to = auth.uid())
);

-- Machine Kiosk Categories Policies
CREATE POLICY "Anyone can view active kiosk categories" ON public.machine_kiosk_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage kiosk categories" ON public.machine_kiosk_categories FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'tech_support_lead'));

-- Machine Profit Splits Policies
CREATE POLICY "Admins can manage profit splits" ON public.machine_profit_splits FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));
CREATE POLICY "Business owners can view their machine splits" ON public.machine_profit_splits FOR SELECT USING (
  EXISTS (SELECT 1 FROM vendx_machines vm JOIN location_assignments la ON vm.location_id = la.location_id WHERE vm.id = machine_profit_splits.machine_id AND la.business_owner_id = auth.uid() AND la.is_active = true)
);

-- Location Assignments Policies
CREATE POLICY "Admins can manage assignments" ON public.location_assignments FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Business owners can view own assignments" ON public.location_assignments FOR SELECT USING (auth.uid() = business_owner_id);

-- Divisions Policies
CREATE POLICY "Anyone can view divisions" ON public.divisions FOR SELECT USING (true);
CREATE POLICY "Super admins can manage divisions" ON public.divisions FOR ALL USING (is_super_admin(auth.uid()));

-- Metrics Policies
CREATE POLICY "Anyone can view metrics" ON public.metrics FOR SELECT USING (true);
CREATE POLICY "Super admins can manage metrics" ON public.metrics FOR ALL USING (is_super_admin(auth.uid()));

-- Jobs Policies
CREATE POLICY "Anyone can view active jobs" ON public.jobs FOR SELECT USING (status = 'active');
CREATE POLICY "Admins can manage jobs" ON public.jobs FOR ALL USING (is_super_admin(auth.uid()));

-- Job Applications Policies
CREATE POLICY "Anyone can apply" ON public.job_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage applications" ON public.job_applications FOR ALL USING (is_super_admin(auth.uid()));

-- Events Policies
CREATE POLICY "Event managers can view events" ON public.events FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'event_manager'));
CREATE POLICY "Event managers can create events" ON public.events FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'event_manager'));
CREATE POLICY "Event managers can update events" ON public.events FOR UPDATE USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'event_manager'));
CREATE POLICY "Event managers can delete events" ON public.events FOR DELETE USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'event_manager'));

-- Daily Tasks Policies
CREATE POLICY "Users can view assigned tasks" ON public.daily_tasks FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "Users can create tasks" ON public.daily_tasks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their tasks" ON public.daily_tasks FOR UPDATE USING (has_role(auth.uid(), 'super_admin') OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "Admins can delete tasks" ON public.daily_tasks FOR DELETE USING (has_role(auth.uid(), 'super_admin') OR created_by = auth.uid());

-- Support Tickets Policies
CREATE POLICY "Tech support can view tickets" ON public.support_tickets FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'tech_support_lead'));
CREATE POLICY "Tech support can create tickets" ON public.support_tickets FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'tech_support_lead'));
CREATE POLICY "Tech support can update tickets" ON public.support_tickets FOR UPDATE USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'tech_support_lead'));
CREATE POLICY "Tech support can delete tickets" ON public.support_tickets FOR DELETE USING (has_role(auth.uid(), 'super_admin'));

-- Service Routes Policies
CREATE POLICY "Users can view routes based on role" ON public.service_routes FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'global_operations_manager') OR has_role(auth.uid(), 'regional_manager') OR assigned_to = auth.uid());
CREATE POLICY "Admins can manage all routes" ON public.service_routes FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'global_operations_manager'));
CREATE POLICY "Managers can update service routes" ON public.service_routes FOR UPDATE USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'global_operations_manager') OR has_role(auth.uid(), 'regional_manager'));

-- Route Stops Policies
CREATE POLICY "Users can view route stops based on role" ON public.route_stops FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'global_operations_manager') OR has_role(auth.uid(), 'regional_manager') OR EXISTS (SELECT 1 FROM service_routes WHERE service_routes.id = route_stops.route_id AND service_routes.assigned_to = auth.uid()));
CREATE POLICY "Admins can manage all stops" ON public.route_stops FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'global_operations_manager'));
CREATE POLICY "Users can update route stops based on role" ON public.route_stops FOR UPDATE USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'global_operations_manager') OR has_role(auth.uid(), 'regional_manager') OR EXISTS (SELECT 1 FROM service_routes WHERE service_routes.id = route_stops.route_id AND service_routes.assigned_to = auth.uid()));
CREATE POLICY "System can insert stops" ON public.route_stops FOR INSERT WITH CHECK (true);

-- Restock Logs Policies
CREATE POLICY "Operators can view own restock logs" ON public.restock_logs FOR SELECT USING (auth.uid() = performed_by OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can create restock logs" ON public.restock_logs FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'global_operations_manager') OR has_role(auth.uid(), 'regional_manager') OR has_role(auth.uid(), 'warehouse_logistics') OR has_role(auth.uid(), 'employee_operator'));
CREATE POLICY "Admins can manage restock logs" ON public.restock_logs FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'warehouse_logistics'));

-- Regions Policies
CREATE POLICY "Regional managers can view regions" ON public.regions FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'regional_manager') OR has_role(auth.uid(), 'global_operations_manager'));
CREATE POLICY "Admins can manage regions" ON public.regions FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'global_operations_manager'));

-- Inventory Items Policies
CREATE POLICY "Warehouse can view inventory" ON public.inventory_items FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'warehouse_logistics'));
CREATE POLICY "Warehouse can manage inventory" ON public.inventory_items FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'warehouse_logistics'));

-- Financial Transactions Policies
CREATE POLICY "Finance can view transactions" ON public.financial_transactions FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));
CREATE POLICY "Finance can manage transactions" ON public.financial_transactions FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));

-- Marketing Campaigns Policies
CREATE POLICY "Marketing can view campaigns" ON public.marketing_campaigns FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales'));
CREATE POLICY "Marketing can manage campaigns" ON public.marketing_campaigns FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales'));

-- Reward Catalog Policies
CREATE POLICY "Anyone can view active rewards" ON public.reward_catalog FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage rewards" ON public.reward_catalog FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales'));

-- Partner Offers Policies
CREATE POLICY "Anyone can view active offers" ON public.partner_offers FOR SELECT USING (is_active = true AND (valid_until IS NULL OR valid_until >= CURRENT_DATE));
CREATE POLICY "Admins can manage offers" ON public.partner_offers FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales'));

-- Shipping Addresses Policies
CREATE POLICY "Users can manage own addresses" ON public.shipping_addresses FOR ALL USING (auth.uid() = user_id);

-- Redemptions Policies
CREATE POLICY "Users can view own redemptions" ON public.redemptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create redemptions" ON public.redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all redemptions" ON public.redemptions FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales'));

-- Arcade Game Titles Policies
CREATE POLICY "Anyone can view active arcade games" ON public.arcade_game_titles FOR SELECT USING (is_active = true);
CREATE POLICY "Super admins can manage arcade games" ON public.arcade_game_titles FOR ALL USING (is_super_admin(auth.uid()));

-- Location Arcade Games Policies
CREATE POLICY "Anyone can view active location arcade games" ON public.location_arcade_games FOR SELECT USING (is_active = true);
CREATE POLICY "Super admins can manage location arcade games" ON public.location_arcade_games FOR ALL USING (is_super_admin(auth.uid()));

-- Video Games Policies
CREATE POLICY "Anyone can view active video games" ON public.video_games FOR SELECT USING (is_active = true);
CREATE POLICY "Super admins can manage video games" ON public.video_games FOR ALL USING (is_super_admin(auth.uid()));

-- Store Products Policies
CREATE POLICY "Anyone can view active products" ON public.store_products FOR SELECT USING (is_active = true);
CREATE POLICY "Super admins can manage products" ON public.store_products FOR ALL USING (is_super_admin(auth.uid()));

-- Store Product Addons Policies
CREATE POLICY "Anyone can view active addons" ON public.store_product_addons FOR SELECT USING (is_active = true);
CREATE POLICY "Super admins can manage addons" ON public.store_product_addons FOR ALL USING (is_super_admin(auth.uid()));

-- Store Carts Policies
CREATE POLICY "Users can manage own cart" ON public.store_carts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anonymous carts by session" ON public.store_carts FOR ALL USING (session_id IS NOT NULL AND user_id IS NULL);

-- Store Cart Items Policies
CREATE POLICY "Users can manage cart items" ON public.store_cart_items FOR ALL USING (
  EXISTS (SELECT 1 FROM store_carts WHERE store_carts.id = store_cart_items.cart_id AND (store_carts.user_id = auth.uid() OR store_carts.session_id IS NOT NULL))
);

-- Store Orders Policies
CREATE POLICY "Users can view own orders" ON public.store_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage all orders" ON public.store_orders FOR ALL USING (is_super_admin(auth.uid()));

-- Store Order Items Policies
CREATE POLICY "Users can view own order items" ON public.store_order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM store_orders WHERE store_orders.id = store_order_items.order_id AND store_orders.user_id = auth.uid())
);
CREATE POLICY "Super admins can manage all order items" ON public.store_order_items FOR ALL USING (is_super_admin(auth.uid()));

-- Store Subscriptions Policies
CREATE POLICY "Users can view own subscriptions" ON public.store_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage subscriptions" ON public.store_subscriptions FOR ALL USING (is_super_admin(auth.uid()));

-- Payouts Policies
CREATE POLICY "Admins can manage payouts" ON public.payouts FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));
CREATE POLICY "Business owners can view own payouts" ON public.payouts FOR SELECT USING (auth.uid() = business_owner_id);

-- Payout Line Items Policies
CREATE POLICY "Admins can manage payout items" ON public.payout_line_items FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));
CREATE POLICY "Business owners can view own payout items" ON public.payout_line_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM payouts WHERE payouts.id = payout_line_items.payout_id AND payouts.business_owner_id = auth.uid())
);

-- Payout Settings Policies
CREATE POLICY "Users can manage own payout settings" ON public.payout_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all payout settings" ON public.payout_settings FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));

-- ============================================================
-- PART 6: STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

CREATE POLICY "Public can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Admins can upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND (SELECT is_super_admin(auth.uid())));
CREATE POLICY "Admins can update product images" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images' AND (SELECT is_super_admin(auth.uid())));
CREATE POLICY "Admins can delete product images" ON storage.objects FOR DELETE USING (bucket_id = 'product-images' AND (SELECT is_super_admin(auth.uid())));

-- ============================================================
-- PART 7: DATA INSERTS
-- ============================================================

-- Locations
INSERT INTO public.locations (id, name, address, city, country, latitude, longitude, machine_count, snack_machine_count, drink_machine_count, combo_machine_count, specialty_machine_count, arcade_machine_count, status, is_visible, location_type, location_category, created_at, updated_at)
VALUES ('ecc4d437-70fe-4fff-8934-a67bdb0685f0', 'VENDX OFFICE', '50 Gannett Pasture Lane', 'SCITUATE', 'United States', 42.22072506944633, -7079078303029412, 2, 1, 0, 0, 0, 1, 'active', true, 'office', 'mixed', '2025-12-01 01:44:42.277744+00', '2025-12-27 16:36:52.446688+00');

-- VendX Machines
INSERT INTO public.vendx_machines (id, machine_code, name, machine_type, api_key, status, location_id, vendx_pay_enabled, current_period_revenue, lifetime_revenue, created_at, updated_at)
VALUES ('5dd58d48-55b9-48ec-b6e1-b2fb917c4656', 'VX00000001', 'HQ TEST', 'snack', 'vx_5Z7KzcLGYINNdNYol4VKg2setylIs1pJ', 'active', 'ecc4d437-70fe-4fff-8934-a67bdb0685f0', true, 0, 0, '2025-12-09 13:15:18.471818+00', '2025-12-26 23:31:01.094568+00');

-- Divisions
INSERT INTO public.divisions (id, name, slug, description, features, status, created_at) VALUES
('3960099d-f288-4c05-981a-0962e83aff22', 'VendX Vending Systems', 'vending-systems', 'The core global vending division. Handles all smart vending, snack machines, drink machines, combo units, micro-markets, and AI-powered vending systems worldwide.', '[]', 'active', '2025-12-01 14:31:44.42503+00'),
('c57653e2-3e66-4185-820e-41c0e0d9115b', 'VendX Arcade & Entertainment', 'arcade-entertainment', '(Formerly Northeast Amusements operational services) Manages arcade placements, claw machines, redemption units, and entertainment equipment across malls, restaurants, events, and venues.', '[]', 'active', '2025-12-01 14:33:12.241912+00'),
('edae4cea-ef5b-442e-84d0-75d6c587121f', 'VendX Financial Services', 'financial-services', 'Handles:  Cashless payments  NFC + QR transactions  Crypto payments  VendX Rewards  Member subscriptions  Machine revenue distribution', '[]', 'active', '2025-12-01 14:35:13.066663+00'),
('8708f308-4d34-4630-923c-1a8110072f87', 'VendX Logistics & Supply', 'logistics', 'Runs: Inventory distribution  Global warehouse management  Supply chain automation', '[]', 'active', '2025-12-01 14:36:28.459546+00'),
('c3744cfe-a53c-4abf-a8df-80b6fe78676e', 'VendX Tech & AI Labs', 'ai-labs', 'Develops:  VendX OS  Payment systems  Remote monitoring  IoT hardware integrations  Software dashboards and admin systems  Robotics-enhanced vending systems', '[]', 'active', '2025-12-01 14:37:20.835915+00'),
('28ad2f52-e90d-4555-a2c3-f56cb79504d6', 'VendX Events & Experiences', 'events', '(Final home for the "Northeast Amusements" brand) Covers:  Event rentals  Party claw machines  Arcade trailers  Pop-up vending experiences', '[]', 'active', '2025-12-01 14:38:13.033447+00'),
('1d3a74ad-9457-44e8-807d-25f31743128b', 'VendX Manufacturing & Engineering', 'manufacturing', 'Builds and designs:  Smart vending machines  Robotic vending systems  Modular arcade equipment  Solar + battery vending machines  Space-compatible vending units', '[]', 'active', '2025-12-01 14:39:46.832121+00'),
('665f179a-192c-481c-9bea-120f997332bb', 'VendX Support & Customer Services', 'customer-services', 'Manages:  Technical support  Machine outage reporting  Partner support  Client dashboards  Remote diagnostics', '[]', 'active', '2025-12-01 14:43:22.190777+00'),
('7a8b125b-17a0-4111-bcc7-cfe622c6d5e4', 'VendX Media & Growth', 'marketing-team', 'The VendX Media & Growth Division is the creative engine behind the VendX brand. Our team leads all marketing, media, and user-growth initiatives across the entire VendX ecosystem—including cashless vending, rewards, arcades, claw machines, events, and VendX Pay.', '[]', 'active', '2025-12-11 00:48:39.168843+00');

-- Metrics
INSERT INTO public.metrics (id, metric_type, metric_label, metric_value, display_order, updated_at) VALUES
('d68c97c7-3d87-40d7-9811-430e78b56f4e', 'map_pin', 'Machines Installed', 1, 1, '2025-12-17 01:32:42.479801+00'),
('178d7d10-8947-4ae5-9bca-e86e54598709', 'users', 'Countries Operated In', 1, 2, '2025-11-30 23:22:06.659692+00'),
('c806347f-80fd-4203-93dc-436596b31b60', 'trending_up', 'Daily Customers', 45, 3, '2025-11-30 23:20:05.898193+00'),
('1fd119e5-dfad-4a28-9843-1426d932a05f', 'calendar', 'Projected Mars Launch', 2050, 4, '2025-11-30 23:20:10.352458+00');

-- Jobs
INSERT INTO public.jobs (id, title, department, location, type, description, requirements, status, posted_at, created_at, updated_at) VALUES
('e739b91d-d796-4001-a6ba-3b67c5dd41e0', 'Field Technician – Vending, Smart Machines & Stocking', 'Operations & Field Services', 'BOSTON, MA, USA', 'contract', 'About the Role:
VendX is expanding worldwide and needs reliable, tech-savvy technicians to install, service, stock, and manage our vending, arcade, and automated retail machines. This role combines technical work with on-the-ground operations to keep VendX machines running smoothly and fully supplied.

Responsibilities:

Install, repair, and maintain VendX vending, arcade, and automated retail machines

Diagnose issues, replace parts, and update firmware/software

Stock machines with products based on the inventory plan

Collect and secure cash/coins from machines that are not fully cashless

Track inventory, cash, and service logs in the VendX Operations Dashboard

Ensure machines meet VendX''s quality and uptime standards

Provide on-site support to partner businesses and clients', 'Requirements:

Experience with electronics, vending machines, or mechanical repair (preferred)

Ability to lift and restock product cases

Valid driver''s license and reliable transportation

Strong problem-solving and communication skills

Basic understanding of mobile/desktop apps for logging work

Bonus:

Experience with smart vending systems or IoT

Ability to travel for new territory launches', 'active', '2025-12-01 01:51:44.290658+00', '2025-12-01 01:51:44.290658+00', '2025-12-01 01:51:44.290658+00'),
('72768546-c666-4ff5-b57a-2a62d9054c09', 'Customer Support Specialist – Technical Support', 'Customer Experience & Support', 'Remote', 'contract', 'About the Role:
Help customers and business partners through the VendX Technical Support system.

Responsibilities:

Respond to support tickets

Troubleshoot machine and dashboard issues

Document cases in the support system

Guide partners through machine operations', 'Requirements:

Customer service or tech support experience

Strong communication and problem-solving skills', 'active', '2025-12-01 01:53:24.200965+00', '2025-12-01 01:53:24.200965+00', '2025-12-01 01:53:24.200965+00'),
('600c1227-5ff4-4a2f-a78f-867b8fa9e480', 'VendX Marketing Intern (Unpaid — School/College Credit Available)', 'VendX Media & Growth', 'Remote / Flexible', 'part-time', 'Position Overview:
We''re seeking a Marketing Intern to join the VendX Media & Growth Division, helping drive brand awareness, user engagement, and creative content. This is an unpaid role with school or college credit available.
What You''ll Do

Assist in creating social media content and digital campaigns.

Help develop marketing strategies for VendX Pay, VendX Kiosk, and other projects.

Conduct research on vending, fintech, and entertainment trends.

Support community engagement and brand communication.

Brainstorm creative campaigns and advertising ideas.

What You''ll Gain

Real-world marketing experience at a growing tech startup.

Portfolio-building opportunities (content, campaigns, branding).

Flexible schedule that works around school.

Internship credit with your school/college.

Hands-on experience working with innovative products and vending tech.

Opportunity for Full-Time Employment

The VendX Media & Growth Division is actively expanding, and top-performing interns may be offered a transition into a full-time, paid position within the company.
Exceptional interns who demonstrate commitment, creativity, reliability, and strong results will be considered for future roles in:

Digital Marketing

Social Media & Content

Brand Management

Product Marketing

Operations or Partnerships

This internship serves as a real pathway into a long-term career at VendX for those who show talent and drive.', 'Requirements

Must be currently enrolled in high school, college, or a trade program that accepts internship credit.

Ability to receive school/college credit (we will sign any required forms).

Basic understanding of social media platforms (TikTok, Instagram, Snapchat, X).

Good communication and writing skills.

Interest in marketing, branding, or digital media.

Ability to work independently with minimal supervision.

Reliable internet connection for remote work.

Willingness to learn new tools and technologies.

Optional but preferred: experience with Canva, CapCut, Photoshop, or social media tools.', 'active', '2025-12-11 00:53:13.244405+00', '2025-12-11 00:53:13.244405+00', '2025-12-11 00:53:13.244405+00');

-- Arcade Game Titles
INSERT INTO public.arcade_game_titles (id, name, game_type, description, is_active, created_at, updated_at) VALUES
('238c958b-864a-4aee-9c5d-a66051901904', 'Claw Master Pro', 'claw', 'Classic claw machine with premium prizes including electronics and plush toys', true, '2025-12-27 16:25:54.091644+00', '2025-12-27 16:25:54.091644+00'),
('424cda78-32fc-4af0-bbc9-1e5977bea9d2', 'Prize Zone Deluxe', 'claw', 'Large capacity claw machine with rotating prize selection', true, '2025-12-27 16:25:54.091644+00', '2025-12-27 16:25:54.091644+00'),
('09f32baf-5414-43ad-b599-4c72333f3638', 'Pac-Man Battle Royale', 'cabinet', 'Multiplayer Pac-Man action for up to 4 players', true, '2025-12-27 16:25:54.091644+00', '2025-12-27 16:25:54.091644+00'),
('c4f1e4fd-60a9-4145-8552-a83abd6c93f0', 'Street Fighter 6', 'cabinet', 'Latest fighting game with stunning graphics and competitive gameplay', true, '2025-12-27 16:25:54.091644+00', '2025-12-27 16:25:54.091644+00'),
('10ff29a0-0cf4-4e47-9c39-4c845a25bad4', 'Mario Kart Arcade GP DX', 'racing', 'High-speed racing with your favorite Mario characters', true, '2025-12-27 16:25:54.091644+00', '2025-12-27 16:25:54.091644+00'),
('869e922d-d0e7-4247-84ad-caf7a6afed8d', 'House of the Dead: Scarlet Dawn', 'shooter', 'Intense zombie shooting action with motion controls', true, '2025-12-27 16:25:54.091644+00', '2025-12-27 16:25:54.091644+00'),
('3dda8ac6-dd6b-4ad1-a4dc-dfe21f5972da', 'Dance Dance Revolution A20', 'rhythm', 'Legendary rhythm game with hundreds of songs', true, '2025-12-27 16:25:54.091644+00', '2025-12-27 16:25:54.091644+00'),
('baac693d-1972-4ee0-86d6-d96e33312546', 'NBA Hoops', 'sports', 'Basketball shooting challenge with progressive difficulty', true, '2025-12-27 16:25:54.091644+00', '2025-12-27 16:25:54.091644+00'),
('c47a05cf-6ee1-4be9-8421-9498191e8629', 'Ticket Time', 'redemption', 'Spin the wheel for tickets and prizes', true, '2025-12-27 16:25:54.091644+00', '2025-12-27 16:25:54.091644+00'),
('2459dd16-8dbf-463a-a838-4387b6f3d6fa', 'Skee-Ball Classic', 'redemption', 'Timeless alley roller game - aim for the 100!', true, '2025-12-27 16:25:54.091644+00', '2025-12-27 16:25:54.091644+00');

-- Location Arcade Games
INSERT INTO public.location_arcade_games (id, location_id, arcade_game_id, machine_count, is_active, created_at) VALUES
('7d90f27e-8b6f-4836-b33b-9b6db5b46ffb', 'ecc4d437-70fe-4fff-8934-a67bdb0685f0', '238c958b-864a-4aee-9c5d-a66051901904', 1, true, '2025-12-27 16:36:52.310011+00');

-- Regions
INSERT INTO public.regions (id, name, country, active_machines, monthly_revenue, monthly_transactions, growth_rate, created_at, updated_at) VALUES
('a98b5485-d84e-42b9-beb2-713f307135c5', 'USA - Northeast', 'United States of America', 0, 0, 0, 0, '2025-11-30 23:25:14.534434+00', '2025-12-16 04:00:28.59994+00'),
('8b2feb8c-edf4-4348-ae6f-b43886707222', 'Southeast', 'United States of America', 0, 0, 0, 0, '2025-12-01 02:01:03.255724+00', '2025-12-01 02:01:03.255724+00'),
('99f69548-5591-402f-bdf9-1da9bed44f76', 'Midwest', 'United States of America', 0, 0, 0, 0, '2025-12-01 02:01:19.172914+00', '2025-12-01 02:01:19.172914+00'),
('b3dd3613-975d-4ef8-b1cc-3b7b42bed189', 'Southwest', 'United States of America', 0, 0, 0, 0, '2025-12-01 02:01:39.002437+00', '2025-12-01 02:01:39.002437+00'),
('7b5ecdce-e4e7-42eb-8832-d9b03242df2b', 'West Coast', 'United States of America', 0, 0, 0, 0, '2025-12-01 02:01:45.288834+00', '2025-12-01 02:01:45.288834+00'),
('6b32226d-3d85-4560-b829-3c7fe2d182a9', 'Mountain', 'United States of America', 0, 0, 0, 0, '2025-12-01 02:01:59.160363+00', '2025-12-01 02:01:59.160363+00'),
('a7fc677a-e92a-47b0-b51b-b3fe8f47a761', 'Pacific Northwest', 'United States of America', 0, 0, 0, 0, '2025-12-01 02:02:14.438983+00', '2025-12-01 02:02:14.438983+00');

-- Service Routes
INSERT INTO public.service_routes (id, name, description, status, zone_area, service_frequency_days, last_serviced_at, next_service_due, created_at, updated_at) VALUES
('970f92b5-f4b5-4b87-8da3-5f7f535fbe4f', 'South Shore MA', NULL, 'inactive', 'Scituate', 7, '2025-12-27 00:24:43.284+00', '2026-01-03 00:24:43.279+00', '2025-12-27 00:24:16.768665+00', '2025-12-27 00:52:03.659596+00');

-- Machine Kiosk Categories
INSERT INTO public.machine_kiosk_categories (id, machine_id, category_name, base_price, display_order, is_active, created_at, updated_at) VALUES
('768ee4a0-e089-44ff-a188-5c797d918391', '5dd58d48-55b9-48ec-b6e1-b2fb917c4656', 'Snacks', 2, 0, true, '2025-12-26 23:40:04.107461+00', '2025-12-26 23:40:25.958432+00'),
('1a0fa891-97f1-4e6a-95a3-99344f4676e1', '5dd58d48-55b9-48ec-b6e1-b2fb917c4656', 'Drinks', 3, 1, true, '2025-12-26 23:40:04.107461+00', '2025-12-26 23:40:30.628957+00'),
('e015c224-f086-4490-b0ee-0ccbafb240f3', '5dd58d48-55b9-48ec-b6e1-b2fb917c4656', 'Candy', 2.5, 2, true, '2025-12-26 23:40:04.107461+00', '2025-12-26 23:40:37.741264+00'),
('3e3886a8-a4f5-4cb6-bf7e-4da2b60c9a75', '5dd58d48-55b9-48ec-b6e1-b2fb917c4656', 'Chips', 2.5, 3, true, '2025-12-26 23:40:04.107461+00', '2025-12-26 23:40:48.456388+00');

-- Inventory Items (Warehouse)
INSERT INTO public.inventory_items (id, product_name, sku, category, location, quantity, min_stock_level, unit_cost, supplier, last_restocked, created_at, updated_at) VALUES
('ffb1d864-370b-48ff-b1e3-f7ac1412154e', 'HAHA VENDING AI SMART COOLER', 'HAHA-AI-BLK-01', 'Other', 'Main Warehouse', 0, -1, 3311, 'HAHA VENDING', '2025-12-16 03:59:20.274+00', '2025-12-16 03:59:05.869127+00', '2025-12-26 23:28:15.873053+00'),
('aa181c07-4ad2-4750-8910-ccbfba713497', 'Vevor Mini Claw Machine', 'VEVOR-MINI-CLAW', 'Other', 'Main Warehouse', 1, -1, 408.99, 'Vevor Tools', NULL, '2025-12-16 04:06:01.78806+00', '2025-12-26 23:28:57.570446+00');

-- Machine Profit Splits
INSERT INTO public.machine_profit_splits (id, machine_id, vendx_percentage, business_owner_percentage, effective_from, created_at, updated_at) VALUES
('ab7d71a2-4f26-41b1-84a1-65c5d9c3af48', '5dd58d48-55b9-48ec-b6e1-b2fb917c4656', 85, 15, '2025-12-26', '2025-12-26 23:26:39.152828+00', '2025-12-26 23:26:39.152828+00');

-- Video Games
INSERT INTO public.video_games (id, title, slug, release_status, cover_image_url, platforms, google_play_url, itch_io_url, microsoft_store_url, display_order, is_featured, is_active, created_at, updated_at) VALUES
('5a8da130-a59d-45fc-9de2-42fc18e7c5d2', 'Duke Of Nukes', 'duke-of-nukes', 'beta', 'https://img.itch.zone/aW1nLzE1NDIxMTg4LnBuZw==/315x250%23c/W0%2BdFl.png', '["android", "itchio"]', 'https://play.google.com/store/apps/details?id=com.tappynuke', 'https://northeastamusements.itch.io/duke-of-nukes', NULL, 1, true, true, '2025-12-26 23:22:37.718201+00', '2025-12-26 23:33:29.256083+00'),
('5a8efb18-4286-448f-baeb-60b7a8f84a65', 'Topshot', 'topshot', 'coming_soon', 'https://img.itch.zone/aW1nLzIyMDM0MTk2LnBuZw==/347x500/kxCNTp.png', '["windows", "itchio"]', NULL, 'https://northeastamusements.itch.io/topshot', 'https://www.xbox.com/en-US/games/store/topshot/9PPGHWSCVRRW', 2, true, true, '2025-12-26 23:21:18.710427+00', '2025-12-26 23:33:33.510109+00');

-- Store Products
INSERT INTO public.store_products (id, name, slug, description, short_description, category, subcategory, price, images, stock, is_active, is_featured, is_subscription, subscription_interval, subscription_price, created_at, updated_at) VALUES
('1bc06246-a946-430f-8fe2-a635ae688453', 'VendX Beanie', 'vendx-cap', 'Warm Beanie with embroidered VendX logo. One size fits all.', 'Beanie with VendX logo', 'apparel', NULL, 19.99, ARRAY['https://xbbnodpvfvxtbffziuvr.supabase.co/storage/v1/object/public/product-images/products/1766020827216-vd2qvo.webp'], 50, true, true, false, NULL, NULL, '2025-12-11 17:26:11.510229+00', '2025-12-18 01:20:41.976329+00'),
('74c922a5-99b3-450c-96e1-f4c4dc4597a7', 'VendX Utility Backpack', 'vendx-backpack', 'Express your style with a backpack that''s equal parts trendy and practical.', 'Express your style with a backpack that''s equal parts trendy', 'apparel', 'bags', 65.5, ARRAY['https://xbbnodpvfvxtbffziuvr.supabase.co/storage/v1/object/public/product-images/products/1766020962361-phbyh.webp', 'https://xbbnodpvfvxtbffziuvr.supabase.co/storage/v1/object/public/product-images/products/1766020966520-3y2loi.webp', 'https://xbbnodpvfvxtbffziuvr.supabase.co/storage/v1/object/public/product-images/products/1766020972907-jyefby.webp', 'https://xbbnodpvfvxtbffziuvr.supabase.co/storage/v1/object/public/product-images/products/1766020978154-fyh8wa.webp'], 5, true, true, false, NULL, NULL, '2025-12-11 17:26:11.510229+00', '2025-12-18 01:23:03.796957+00'),
('8cc8d629-1d82-4664-b94b-a938c7e262d9', 'VendX Hoodie', 'vendx-hoodie', 'Stay warm in style with our premium VendX hoodie. Soft fleece interior, kangaroo pocket, and embroidered logo.', 'Premium VendX branded hoodie', 'apparel', NULL, 59.99, ARRAY['https://xbbnodpvfvxtbffziuvr.supabase.co/storage/v1/object/public/product-images/products/1766020854182-zear4m.webp', 'https://xbbnodpvfvxtbffziuvr.supabase.co/storage/v1/object/public/product-images/products/1766020857623-1tgc6.webp'], 25, true, true, false, NULL, NULL, '2025-12-11 17:26:11.510229+00', '2025-12-18 01:23:16.533169+00'),
('4bc1233e-d038-41db-a04b-a95fbefb1d00', 'Snack Variety Pack', 'snack-variety-pack', 'One-time purchase variety pack with 20 premium snacks. Sample what Snack In The Box offers!', '20-snack variety pack', 'snacks', NULL, 39.99, ARRAY['https://xbbnodpvfvxtbffziuvr.supabase.co/storage/v1/object/public/product-images/products/1766021036846-cylb2e.jpg'], 40, true, true, false, NULL, NULL, '2025-12-11 17:26:11.510229+00', '2025-12-18 01:24:06.258574+00'),
('36d5d272-9150-4e84-975e-bec1f97a0a3e', 'Snack In The Box', 'snack-in-the-box', 'Get 20+ premium snacks from around the world delivered monthly. Each box includes a curated selection of chips, candy, cookies, and unique treats you won''t find in stores. Cancel anytime.', 'Monthly premium snack subscription delivered to your door', 'subscriptions', NULL, 29.99, ARRAY['https://xbbnodpvfvxtbffziuvr.supabase.co/storage/v1/object/public/product-images/products/1766021058581-j4gtdx.jpg'], 999, true, true, true, 'month', 29.99, '2025-12-11 17:26:11.510229+00', '2025-12-18 01:24:28.346352+00');

-- Store Product Addons
INSERT INTO public.store_product_addons (id, product_id, name, description, price, is_active, created_at) VALUES
('41455aa9-218a-4f84-805f-e396d2f6edb0', '36d5d272-9150-4e84-975e-bec1f97a0a3e', 'International Snacks', 'Add exotic snacks from Japan, Korea, and Europe', 7.99, true, '2025-12-11 17:26:11.510229+00'),
('d531bb6e-0134-48d3-ac30-2985e110ac1b', '36d5d272-9150-4e84-975e-bec1f97a0a3e', 'Drink Add-On', 'Include 4 premium beverages with your box', 5.99, true, '2025-12-11 17:26:11.510229+00'),
('3c25c276-b317-4ae6-b2ae-5cd89353d9de', '36d5d272-9150-4e84-975e-bec1f97a0a3e', 'Healthy Options', 'Swap some snacks for healthier alternatives', 3.99, true, '2025-12-11 17:26:11.510229+00');

-- Reward Catalog
INSERT INTO public.reward_catalog (id, name, description, reward_type, points_cost, credit_amount, tier_required, requires_shipping, stock, is_active, created_at, updated_at) VALUES
('8519cf84-6f69-4d48-904a-4bca0e55a952', '$5 Wallet Credit', 'Convert your points to $5 in wallet balance', 'vend_credit', 1000, 5.00, 'bronze', false, NULL, true, '2025-12-08 21:30:07.300628+00', '2025-12-08 21:30:07.300628+00'),
('6d130c3b-436d-4cae-8173-f2ec20f078e2', '$10 Wallet Credit', 'Convert your points to $10 in wallet balance', 'vend_credit', 1800, 10.00, 'bronze', false, NULL, true, '2025-12-08 21:30:07.300628+00', '2025-12-08 21:30:07.300628+00'),
('7d017228-8e24-471c-bb80-456f0f6fd7a0', '$25 Wallet Credit', 'Convert your points to $25 in wallet balance', 'vend_credit', 4000, 25.00, 'silver', false, NULL, true, '2025-12-08 21:30:07.300628+00', '2025-12-08 21:30:07.300628+00'),
('637bb548-2a56-49f7-9b7c-966645edabeb', 'VendX T-Shirt', 'Premium VendX branded t-shirt', 'physical_item', 5000, NULL, 'silver', true, 100, true, '2025-12-08 21:30:07.300628+00', '2025-12-08 21:30:07.300628+00'),
('ffd96cb5-4a8e-45cb-9e7a-acb064214cdd', 'VendX Hoodie', 'Comfortable VendX branded hoodie', 'physical_item', 8000, NULL, 'gold', true, 50, true, '2025-12-08 21:30:07.300628+00', '2025-12-08 21:30:07.300628+00'),
('6a029d65-6e92-4b4c-bbe7-613fc4abf2a9', 'Snack Box', 'Assorted premium snacks delivered to your door', 'physical_item', 3000, NULL, 'bronze', true, 200, true, '2025-12-08 21:30:07.300628+00', '2025-12-08 21:30:07.300628+00'),
('7f18a340-4fcd-4227-be42-9fecf40045ef', 'VendX Cap', 'Stylish VendX branded cap', 'physical_item', 2500, NULL, 'bronze', true, 150, true, '2025-12-08 21:30:07.300628+00', '2025-12-08 21:30:07.300628+00'),
('b9591c25-2dc6-4503-98c4-05c92c821765', 'Mystery Prize Box', 'Exclusive mystery items for Platinum members', 'physical_item', 15000, NULL, 'platinum', true, 25, true, '2025-12-08 21:30:07.300628+00', '2025-12-08 21:30:07.300628+00');

-- Partner Offers
INSERT INTO public.partner_offers (id, partner_name, offer_name, description, discount_code, discount_type, discount_value, points_cost, valid_from, valid_until, is_active, created_at, updated_at) VALUES
('7227dcde-bbdc-4e2e-b803-aaee0002ec72', 'GasStation', '10 Cents Off Per Gallon', 'Save 10 cents per gallon at participating stations', 'VENDXGAS10', 'fixed_amount', 0.10, 1000, '2025-12-08', '2025-12-31', false, '2025-12-08 21:30:07.300628+00', '2025-12-09 13:14:15.942044+00'),
('c37afb22-f813-491c-b156-2da73213c7ce', 'FoodDelivery', '$5 Off Your Order', 'Save $5 on your next food delivery order', 'VENDX5OFF', 'fixed_amount', 5, 1500, '2025-12-08', '2025-12-31', false, '2025-12-08 21:30:07.300628+00', '2025-12-09 13:14:17.175818+00'),
('23d711a7-1151-430f-8f2a-1e236bd19227', 'MoviePass', '20% Off Movie Tickets', 'Get 20% off your next movie ticket purchase', 'VENDX20', 'percentage', 20, 2000, '2025-12-08', '2025-12-31', false, '2025-12-08 21:30:07.300628+00', '2025-12-09 13:14:18.254282+00');

-- Job Applications
INSERT INTO public.job_applications (id, job_id, applicant_name, email, phone, cover_letter, status, applied_at, created_at, updated_at) VALUES
('69efa501-ac09-432f-a651-ea4273a239fc', '72768546-c666-4ff5-b57a-2a62d9054c09', 'Nathan Joseph Mccusker', 'nate@northeastamusements.com', '7812141806', 'TEST', 'rejected', '2025-12-01 01:53:56.510653+00', '2025-12-01 01:53:56.510653+00', '2025-12-01 01:54:30.587765+00'),
('c306ffc1-8ff0-4a58-b4d8-ebc763fcdf96', '72768546-c666-4ff5-b57a-2a62d9054c09', 'Christian Stevens', 'suechristian3113@gmail.com', '', 'I''m looking for another job to earn enough money to get by. I have a year of experience in customer support and feel I''d be a good edition to the team. :)', 'rejected', '2025-12-20 16:41:47.0185+00', '2025-12-20 16:41:47.0185+00', '2025-12-26 23:24:50.644826+00');

-- Restock Logs
INSERT INTO public.restock_logs (id, machine_id, performed_by, items_restocked, notes, created_at) VALUES
('9f03a968-541f-4937-ae86-609b1ed51fe9', '5dd58d48-55b9-48ec-b6e1-b2fb917c4656', 'ea1325ae-e94e-49fc-b2c8-08cd3ed2223c', '[]', 'test', '2025-12-27 00:04:11.631866+00');

-- ============================================================
-- NOTE: User-specific data (profiles, wallets, user_roles, etc.)
-- must be inserted AFTER users sign up in the new project.
-- The triggers will automatically create these records.
-- ============================================================

-- ============================================================
-- DONE! Your database schema and data have been exported.
-- 
-- NEXT STEPS:
-- 1. Run this SQL in your new Supabase project's SQL Editor
-- 2. Copy Edge Functions from supabase/functions/ to your new project
-- 3. Set up secrets in your new project (STRIPE_SECRET_KEY, etc.)
-- 4. Update your .env file with new project credentials
-- 5. Re-upload product images to new storage bucket
-- ============================================================
