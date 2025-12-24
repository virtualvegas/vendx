-- ============================================
-- VendX Complete Database Migration Script
-- Run this in your external Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. CREATE ENUM TYPE
-- ============================================
DO $$ BEGIN
  CREATE TYPE public.vendx_app_role AS ENUM (
    'super_admin',
    'global_operations_manager',
    'regional_manager',
    'finance_accounting',
    'marketing_sales',
    'warehouse_logistics',
    'tech_support_lead',
    'event_manager',
    'employee_operator',
    'customer'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 2. HELPER FUNCTIONS
-- ============================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.vendx_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Generate TOTP secret
CREATE OR REPLACE FUNCTION public.vendx_generate_totp_secret()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Generate order number
CREATE OR REPLACE FUNCTION public.vendx_generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.order_number := 'VX-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- ============================================
-- 3. USER ROLES TABLE (Create first for RLS)
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role vendx_app_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.vendx_user_roles ENABLE ROW LEVEL SECURITY;

-- Has role function (needed for RLS policies)
CREATE OR REPLACE FUNCTION public.vendx_has_role(_user_id uuid, _role vendx_app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendx_user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Is super admin function
CREATE OR REPLACE FUNCTION public.vendx_is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.vendx_has_role(_user_id, 'super_admin')
$$;

-- User roles RLS policies
CREATE POLICY "Super admins can manage roles" ON public.vendx_user_roles
  FOR ALL USING (vendx_is_super_admin(auth.uid()));

CREATE POLICY "Super admins can view all roles" ON public.vendx_user_roles
  FOR SELECT USING (vendx_is_super_admin(auth.uid()));

-- ============================================
-- 4. PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  phone text,
  stripe_customer_id text,
  tier_level text NOT NULL DEFAULT 'bronze',
  totp_secret text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.vendx_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.vendx_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.vendx_profiles
  FOR SELECT USING (vendx_is_super_admin(auth.uid()));

-- Handle new user function
CREATE OR REPLACE FUNCTION public.vendx_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vendx_profiles (id, email, full_name, totp_secret)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name', vendx_generate_totp_secret());
  RETURN new;
END;
$$;

-- Assign default role function
CREATE OR REPLACE FUNCTION public.vendx_assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vendx_user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;

-- Trigger for new users (creates profile)
DROP TRIGGER IF EXISTS on_auth_user_created_vendx ON auth.users;
CREATE TRIGGER on_auth_user_created_vendx
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.vendx_handle_new_user();

-- Trigger for new users (assigns default role)
DROP TRIGGER IF EXISTS on_auth_user_created_vendx_role ON auth.users;
CREATE TRIGGER on_auth_user_created_vendx_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.vendx_assign_default_role();

-- ============================================
-- 5. WALLETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  last_loaded timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet" ON public.vendx_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet" ON public.vendx_wallets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert wallets" ON public.vendx_wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all wallets" ON public.vendx_wallets
  FOR ALL USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'finance_accounting'));

-- ============================================
-- 6. REWARDS POINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_rewards_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'bronze',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_rewards_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own points" ON public.vendx_rewards_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own points" ON public.vendx_rewards_points
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert points" ON public.vendx_rewards_points
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all points" ON public.vendx_rewards_points
  FOR ALL USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'marketing_sales'));

-- Update user tier function
CREATE OR REPLACE FUNCTION public.vendx_update_user_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    UPDATE public.vendx_profiles SET tier_level = new_tier WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER vendx_update_user_tier_trigger
  BEFORE UPDATE ON public.vendx_rewards_points
  FOR EACH ROW EXECUTE FUNCTION public.vendx_update_user_tier();

-- Handle new user VendX Pay (creates wallet and rewards)
CREATE OR REPLACE FUNCTION public.vendx_handle_new_user_vendx_pay()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vendx_wallets (user_id, balance)
  VALUES (NEW.id, 0);
  
  INSERT INTO public.vendx_rewards_points (user_id, balance, lifetime_points, tier)
  VALUES (NEW.id, 0, 0, 'bronze');
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_vendx_pay ON auth.users;
CREATE TRIGGER on_auth_user_created_vendx_pay
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.vendx_handle_new_user_vendx_pay();

-- ============================================
-- 7. LOCATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  country text NOT NULL,
  city text NOT NULL,
  address text,
  latitude numeric,
  longitude numeric,
  location_type text DEFAULT 'office',
  contact_name text,
  contact_phone text,
  contact_email text,
  machine_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible locations" ON public.vendx_locations
  FOR SELECT USING (is_visible = true OR vendx_is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage locations" ON public.vendx_locations
  FOR ALL USING (vendx_is_super_admin(auth.uid()));

-- ============================================
-- 8. MACHINES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_code text NOT NULL UNIQUE,
  machine_type text NOT NULL,
  name text NOT NULL,
  api_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  location_id uuid REFERENCES public.vendx_locations(id),
  vendx_pay_enabled boolean NOT NULL DEFAULT true,
  last_seen timestamp with time zone,
  installed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage machines" ON public.vendx_machines
  FOR ALL USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'tech_support_lead'));

-- ============================================
-- 9. WALLET TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.vendx_wallets(id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  amount numeric NOT NULL,
  description text,
  machine_id uuid REFERENCES public.vendx_machines(id),
  stripe_payment_intent_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.vendx_wallet_transactions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM vendx_wallets WHERE vendx_wallets.id = vendx_wallet_transactions.wallet_id AND vendx_wallets.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all transactions" ON public.vendx_wallet_transactions
  FOR SELECT USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'finance_accounting'));

-- ============================================
-- 10. MACHINE SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_machine_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.vendx_machines(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  session_code text NOT NULL,
  session_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_machine_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON public.vendx_machine_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions" ON public.vendx_machine_sessions
  FOR SELECT USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'tech_support_lead'));

-- ============================================
-- 11. MACHINE TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_machine_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.vendx_machines(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  wallet_transaction_id uuid REFERENCES public.vendx_wallet_transactions(id),
  session_id uuid REFERENCES public.vendx_machine_sessions(id),
  amount numeric NOT NULL,
  item_name text,
  points_earned integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_machine_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own machine transactions" ON public.vendx_machine_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all machine transactions" ON public.vendx_machine_transactions
  FOR ALL USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'tech_support_lead') OR vendx_has_role(auth.uid(), 'finance_accounting'));

-- ============================================
-- 12. POINT TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  points integer NOT NULL,
  description text,
  reference_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own point transactions" ON public.vendx_point_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all point transactions" ON public.vendx_point_transactions
  FOR SELECT USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'marketing_sales'));

-- ============================================
-- 13. MACHINE INVENTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_machine_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.vendx_machines(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  sku text NOT NULL,
  slot_number text,
  quantity integer NOT NULL DEFAULT 0,
  max_capacity integer NOT NULL DEFAULT 10,
  unit_price numeric NOT NULL DEFAULT 0,
  last_restocked timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_machine_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage machine inventory" ON public.vendx_machine_inventory
  FOR ALL USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'warehouse_logistics') OR vendx_has_role(auth.uid(), 'tech_support_lead'));

-- ============================================
-- 14. SERVICE ROUTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_service_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  assigned_to uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_service_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all routes" ON public.vendx_service_routes
  FOR ALL USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'global_operations_manager'));

CREATE POLICY "Users can view routes based on role" ON public.vendx_service_routes
  FOR SELECT USING (
    vendx_has_role(auth.uid(), 'super_admin') OR 
    vendx_has_role(auth.uid(), 'global_operations_manager') OR 
    vendx_has_role(auth.uid(), 'regional_manager') OR 
    assigned_to = auth.uid()
  );

CREATE POLICY "Managers can update service routes" ON public.vendx_service_routes
  FOR UPDATE USING (
    vendx_has_role(auth.uid(), 'super_admin') OR 
    vendx_has_role(auth.uid(), 'global_operations_manager') OR 
    vendx_has_role(auth.uid(), 'regional_manager')
  );

-- ============================================
-- 15. ROUTE STOPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.vendx_service_routes(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.vendx_locations(id),
  machine_id uuid REFERENCES public.vendx_machines(id),
  stop_name text NOT NULL,
  address text,
  stop_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  estimated_duration_minutes integer DEFAULT 15,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_route_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all stops" ON public.vendx_route_stops
  FOR ALL USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'global_operations_manager'));

CREATE POLICY "Users can view route stops based on role" ON public.vendx_route_stops
  FOR SELECT USING (
    vendx_has_role(auth.uid(), 'super_admin') OR 
    vendx_has_role(auth.uid(), 'global_operations_manager') OR 
    vendx_has_role(auth.uid(), 'regional_manager') OR 
    EXISTS (SELECT 1 FROM vendx_service_routes WHERE vendx_service_routes.id = vendx_route_stops.route_id AND vendx_service_routes.assigned_to = auth.uid())
  );

CREATE POLICY "Users can update route stops based on role" ON public.vendx_route_stops
  FOR UPDATE USING (
    vendx_has_role(auth.uid(), 'super_admin') OR 
    vendx_has_role(auth.uid(), 'global_operations_manager') OR 
    vendx_has_role(auth.uid(), 'regional_manager') OR 
    EXISTS (SELECT 1 FROM vendx_service_routes WHERE vendx_service_routes.id = vendx_route_stops.route_id AND vendx_service_routes.assigned_to = auth.uid())
  );

-- ============================================
-- 16. RESTOCK LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_restock_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.vendx_machines(id) ON DELETE CASCADE,
  performed_by uuid REFERENCES auth.users(id),
  items_restocked jsonb NOT NULL DEFAULT '[]',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_restock_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage restock logs" ON public.vendx_restock_logs
  FOR ALL USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'warehouse_logistics'));

CREATE POLICY "Operators can view own restock logs" ON public.vendx_restock_logs
  FOR SELECT USING (auth.uid() = performed_by OR vendx_is_super_admin(auth.uid()));

CREATE POLICY "Users can create restock logs" ON public.vendx_restock_logs
  FOR INSERT WITH CHECK (
    vendx_has_role(auth.uid(), 'super_admin') OR 
    vendx_has_role(auth.uid(), 'global_operations_manager') OR 
    vendx_has_role(auth.uid(), 'regional_manager') OR 
    vendx_has_role(auth.uid(), 'warehouse_logistics') OR 
    vendx_has_role(auth.uid(), 'employee_operator')
  );

-- ============================================
-- 17. DIVISIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  status text DEFAULT 'active',
  features jsonb DEFAULT '[]',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view divisions" ON public.vendx_divisions
  FOR SELECT USING (true);

CREATE POLICY "Super admins can manage divisions" ON public.vendx_divisions
  FOR ALL USING (vendx_is_super_admin(auth.uid()));

-- ============================================
-- 18. METRICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type text NOT NULL,
  metric_label text NOT NULL,
  metric_value numeric NOT NULL,
  display_order integer DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view metrics" ON public.vendx_metrics
  FOR SELECT USING (true);

CREATE POLICY "Super admins can manage metrics" ON public.vendx_metrics
  FOR ALL USING (vendx_is_super_admin(auth.uid()));

-- ============================================
-- 19. JOBS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department text NOT NULL,
  location text NOT NULL,
  type text NOT NULL DEFAULT 'full-time',
  description text NOT NULL,
  requirements text,
  status text NOT NULL DEFAULT 'active',
  posted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active jobs" ON public.vendx_jobs
  FOR SELECT USING (status = 'active');

CREATE POLICY "Admins can manage jobs" ON public.vendx_jobs
  FOR ALL USING (vendx_is_super_admin(auth.uid()));

-- ============================================
-- 20. JOB APPLICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.vendx_jobs(id) ON DELETE CASCADE,
  applicant_name text NOT NULL,
  email text NOT NULL,
  phone text,
  resume_url text,
  cover_letter text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  applied_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit applications" ON public.vendx_job_applications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view applications" ON public.vendx_job_applications
  FOR SELECT USING (vendx_is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage applications" ON public.vendx_job_applications
  FOR ALL USING (vendx_is_super_admin(auth.uid()));

-- ============================================
-- 21. EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'upcoming',
  machines_deployed integer NOT NULL DEFAULT 0,
  revenue numeric DEFAULT 0,
  contact_email text,
  contact_phone text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event managers can view events" ON public.vendx_events
  FOR SELECT USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'event_manager'));

CREATE POLICY "Event managers can create events" ON public.vendx_events
  FOR INSERT WITH CHECK (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'event_manager'));

CREATE POLICY "Event managers can update events" ON public.vendx_events
  FOR UPDATE USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'event_manager'));

CREATE POLICY "Event managers can delete events" ON public.vendx_events
  FOR DELETE USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'event_manager'));

-- ============================================
-- 22. DAILY TASKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_daily_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  due_date date NOT NULL,
  assigned_to uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_daily_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assigned tasks" ON public.vendx_daily_tasks
  FOR SELECT USING (vendx_has_role(auth.uid(), 'super_admin') OR assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Users can create tasks" ON public.vendx_daily_tasks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their tasks" ON public.vendx_daily_tasks
  FOR UPDATE USING (vendx_has_role(auth.uid(), 'super_admin') OR assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Admins can delete tasks" ON public.vendx_daily_tasks
  FOR DELETE USING (vendx_has_role(auth.uid(), 'super_admin') OR created_by = auth.uid());

-- ============================================
-- 23. SUPPORT TICKETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE,
  machine_id text NOT NULL,
  location text NOT NULL,
  issue_type text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  description text NOT NULL,
  resolution text,
  assigned_to uuid REFERENCES auth.users(id),
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tech support can view tickets" ON public.vendx_support_tickets
  FOR SELECT USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'tech_support_lead'));

CREATE POLICY "Tech support can create tickets" ON public.vendx_support_tickets
  FOR INSERT WITH CHECK (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'tech_support_lead'));

CREATE POLICY "Tech support can update tickets" ON public.vendx_support_tickets
  FOR UPDATE USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'tech_support_lead'));

CREATE POLICY "Tech support can delete tickets" ON public.vendx_support_tickets
  FOR DELETE USING (vendx_has_role(auth.uid(), 'super_admin'));

-- ============================================
-- 24. INVENTORY ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  sku text NOT NULL UNIQUE,
  category text NOT NULL,
  location text NOT NULL,
  supplier text,
  quantity integer NOT NULL DEFAULT 0,
  min_stock_level integer NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL,
  last_restocked timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Warehouse can view inventory" ON public.vendx_inventory_items
  FOR SELECT USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'warehouse_logistics'));

CREATE POLICY "Warehouse can manage inventory" ON public.vendx_inventory_items
  FOR ALL USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'warehouse_logistics'));

-- ============================================
-- 25. FINANCIAL TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type text NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL,
  description text,
  division_id uuid REFERENCES public.vendx_divisions(id),
  transaction_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance can view transactions" ON public.vendx_financial_transactions
  FOR SELECT USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'finance_accounting'));

CREATE POLICY "Finance can manage transactions" ON public.vendx_financial_transactions
  FOR ALL USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'finance_accounting'));

-- ============================================
-- 26. MARKETING CAMPAIGNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  start_date date NOT NULL,
  end_date date,
  budget numeric NOT NULL DEFAULT 0,
  spend numeric NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketing can view campaigns" ON public.vendx_marketing_campaigns
  FOR SELECT USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'marketing_sales'));

CREATE POLICY "Marketing can manage campaigns" ON public.vendx_marketing_campaigns
  FOR ALL USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'marketing_sales'));

-- ============================================
-- 27. REWARD CATALOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_reward_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  reward_type text NOT NULL,
  image_url text,
  points_cost integer NOT NULL,
  credit_amount numeric,
  tier_required text DEFAULT 'bronze',
  requires_shipping boolean NOT NULL DEFAULT false,
  stock integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_reward_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active rewards" ON public.vendx_reward_catalog
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage rewards" ON public.vendx_reward_catalog
  FOR ALL USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'marketing_sales'));

-- ============================================
-- 28. PARTNER OFFERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_partner_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name text NOT NULL,
  offer_name text NOT NULL,
  description text,
  discount_code text NOT NULL,
  discount_type text NOT NULL,
  discount_value numeric NOT NULL,
  points_cost integer NOT NULL,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  max_redemptions integer,
  current_redemptions integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_partner_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active offers" ON public.vendx_partner_offers
  FOR SELECT USING (is_active = true AND (valid_until IS NULL OR valid_until >= CURRENT_DATE));

CREATE POLICY "Admins can manage offers" ON public.vendx_partner_offers
  FOR ALL USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'marketing_sales'));

-- ============================================
-- 29. SHIPPING ADDRESSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_shipping_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state text NOT NULL,
  zip_code text NOT NULL,
  country text NOT NULL DEFAULT 'USA',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_shipping_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own addresses" ON public.vendx_shipping_addresses
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 30. REDEMPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.vendx_reward_catalog(id),
  points_spent integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  shipping_address_id uuid REFERENCES public.vendx_shipping_addresses(id),
  tracking_number text,
  notes text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own redemptions" ON public.vendx_redemptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create redemptions" ON public.vendx_redemptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all redemptions" ON public.vendx_redemptions
  FOR ALL USING (vendx_has_role(auth.uid(), 'super_admin') OR vendx_has_role(auth.uid(), 'marketing_sales'));

-- ============================================
-- 31. STORE PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  short_description text,
  category text NOT NULL,
  subcategory text,
  price numeric NOT NULL DEFAULT 0,
  compare_at_price numeric,
  images text[] DEFAULT '{}',
  stock integer DEFAULT 0,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  is_subscription boolean DEFAULT false,
  subscription_interval text,
  subscription_price numeric,
  stripe_product_id text,
  stripe_price_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.vendx_store_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products" ON public.vendx_store_products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Super admins can manage products" ON public.vendx_store_products
  FOR ALL USING (vendx_is_super_admin(auth.uid()));

-- ============================================
-- 32. STORE PRODUCT ADDONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_store_product_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.vendx_store_products(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  stripe_price_id text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.vendx_store_product_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active addons" ON public.vendx_store_product_addons
  FOR SELECT USING (is_active = true);

CREATE POLICY "Super admins can manage addons" ON public.vendx_store_product_addons
  FOR ALL USING (vendx_is_super_admin(auth.uid()));

-- ============================================
-- 33. STORE CARTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_store_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.vendx_store_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cart" ON public.vendx_store_carts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anonymous carts by session" ON public.vendx_store_carts
  FOR ALL USING (session_id IS NOT NULL AND user_id IS NULL);

-- ============================================
-- 34. STORE CART ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_store_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid REFERENCES public.vendx_store_carts(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.vendx_store_products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  addon_ids uuid[] DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.vendx_store_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cart items" ON public.vendx_store_cart_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM vendx_store_carts 
    WHERE vendx_store_carts.id = vendx_store_cart_items.cart_id 
    AND (vendx_store_carts.user_id = auth.uid() OR vendx_store_carts.session_id IS NOT NULL)
  ));

-- ============================================
-- 35. STORE ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_store_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending',
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric DEFAULT 0,
  shipping_cost numeric DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  shipping_address_id uuid REFERENCES public.vendx_shipping_addresses(id),
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.vendx_store_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders" ON public.vendx_store_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all orders" ON public.vendx_store_orders
  FOR ALL USING (vendx_is_super_admin(auth.uid()));

-- Order number trigger
CREATE TRIGGER vendx_generate_order_number_trigger
  BEFORE INSERT ON public.vendx_store_orders
  FOR EACH ROW EXECUTE FUNCTION public.vendx_generate_order_number();

-- ============================================
-- 36. STORE ORDER ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_store_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.vendx_store_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.vendx_store_products(id),
  product_name text NOT NULL,
  product_price numeric NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  addon_details jsonb DEFAULT '[]',
  total numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.vendx_store_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order items" ON public.vendx_store_order_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM vendx_store_orders WHERE vendx_store_orders.id = vendx_store_order_items.order_id AND vendx_store_orders.user_id = auth.uid()
  ));

CREATE POLICY "Super admins can manage all order items" ON public.vendx_store_order_items
  FOR ALL USING (vendx_is_super_admin(auth.uid()));

-- ============================================
-- 37. STORE SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_store_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.vendx_store_products(id),
  addon_ids uuid[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  stripe_subscription_id text,
  stripe_customer_id text,
  shipping_address_id uuid REFERENCES public.vendx_shipping_addresses(id),
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  canceled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.vendx_store_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" ON public.vendx_store_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON public.vendx_store_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all subscriptions" ON public.vendx_store_subscriptions
  FOR ALL USING (vendx_is_super_admin(auth.uid()));

-- ============================================
-- 38. REGIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendx_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  country text NOT NULL,
  manager_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view regions" ON public.vendx_regions
  FOR SELECT USING (true);

CREATE POLICY "Super admins can manage regions" ON public.vendx_regions
  FOR ALL USING (vendx_is_super_admin(auth.uid()));

-- ============================================
-- 39. STORAGE BUCKET FOR PRODUCT IMAGES
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendx-product-images', 'vendx-product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public can view product images" ON storage.objects
  FOR SELECT USING (bucket_id = 'vendx-product-images');

CREATE POLICY "Admins can upload product images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'vendx-product-images' AND 
    public.vendx_has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Admins can update product images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'vendx-product-images' AND 
    public.vendx_has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Admins can delete product images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'vendx-product-images' AND 
    public.vendx_has_role(auth.uid(), 'super_admin')
  );

-- ============================================
-- 40. UPDATED_AT TRIGGERS
-- ============================================
CREATE TRIGGER vendx_profiles_updated_at BEFORE UPDATE ON public.vendx_profiles FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_wallets_updated_at BEFORE UPDATE ON public.vendx_wallets FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_rewards_points_updated_at BEFORE UPDATE ON public.vendx_rewards_points FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_locations_updated_at BEFORE UPDATE ON public.vendx_locations FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_machines_updated_at BEFORE UPDATE ON public.vendx_machines FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_service_routes_updated_at BEFORE UPDATE ON public.vendx_service_routes FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_route_stops_updated_at BEFORE UPDATE ON public.vendx_route_stops FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_daily_tasks_updated_at BEFORE UPDATE ON public.vendx_daily_tasks FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_support_tickets_updated_at BEFORE UPDATE ON public.vendx_support_tickets FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_inventory_items_updated_at BEFORE UPDATE ON public.vendx_inventory_items FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_financial_transactions_updated_at BEFORE UPDATE ON public.vendx_financial_transactions FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_marketing_campaigns_updated_at BEFORE UPDATE ON public.vendx_marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_reward_catalog_updated_at BEFORE UPDATE ON public.vendx_reward_catalog FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_partner_offers_updated_at BEFORE UPDATE ON public.vendx_partner_offers FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_shipping_addresses_updated_at BEFORE UPDATE ON public.vendx_shipping_addresses FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_redemptions_updated_at BEFORE UPDATE ON public.vendx_redemptions FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_store_products_updated_at BEFORE UPDATE ON public.vendx_store_products FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_store_carts_updated_at BEFORE UPDATE ON public.vendx_store_carts FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_store_orders_updated_at BEFORE UPDATE ON public.vendx_store_orders FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_store_subscriptions_updated_at BEFORE UPDATE ON public.vendx_store_subscriptions FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_jobs_updated_at BEFORE UPDATE ON public.vendx_jobs FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_job_applications_updated_at BEFORE UPDATE ON public.vendx_job_applications FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_events_updated_at BEFORE UPDATE ON public.vendx_events FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_machine_inventory_updated_at BEFORE UPDATE ON public.vendx_machine_inventory FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();
CREATE TRIGGER vendx_regions_updated_at BEFORE UPDATE ON public.vendx_regions FOR EACH ROW EXECUTE FUNCTION public.vendx_update_updated_at_column();

-- ============================================
-- COMPLETE!
-- ============================================
-- This script creates all VendX tables with vendx_ prefix
-- All functions use vendx_ prefix
-- All RLS policies use vendx_ helper functions
-- Storage bucket for product images included
-- Triggers for new user creation included
