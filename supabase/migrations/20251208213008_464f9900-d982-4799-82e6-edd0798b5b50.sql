-- VendX Pay Complete Database Schema

-- Extend profiles table with VendX Pay fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS pin_code text,
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS tier_level text NOT NULL DEFAULT 'bronze';

-- Wallets table
CREATE TABLE public.wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  last_loaded timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet" ON public.wallets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert wallets" ON public.wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all wallets" ON public.wallets
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'finance_accounting')
  );

-- Wallet transactions table
CREATE TABLE public.wallet_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  transaction_type text NOT NULL, -- 'load', 'purchase', 'refund', 'reward_credit'
  description text,
  machine_id uuid,
  stripe_payment_intent_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.wallet_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.wallets WHERE id = wallet_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can view all transactions" ON public.wallet_transactions
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'finance_accounting')
  );

-- Rewards points table
CREATE TABLE public.rewards_points (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'bronze',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.rewards_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own points" ON public.rewards_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own points" ON public.rewards_points
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert points" ON public.rewards_points
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all points" ON public.rewards_points
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'marketing_sales')
  );

-- Point transactions table
CREATE TABLE public.point_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL,
  transaction_type text NOT NULL, -- 'earn', 'redeem', 'bonus', 'expire'
  description text,
  reference_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own point transactions" ON public.point_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all point transactions" ON public.point_transactions
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'marketing_sales')
  );

-- Reward catalog table
CREATE TABLE public.reward_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  points_cost integer NOT NULL,
  reward_type text NOT NULL, -- 'vend_credit', 'physical_item', 'partner_discount'
  credit_amount numeric, -- for vend_credit type
  requires_shipping boolean NOT NULL DEFAULT false,
  stock integer,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  tier_required text DEFAULT 'bronze',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active rewards" ON public.reward_catalog
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage rewards" ON public.reward_catalog
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'marketing_sales')
  );

-- Shipping addresses table
CREATE TABLE public.shipping_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

ALTER TABLE public.shipping_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own addresses" ON public.shipping_addresses
  FOR ALL USING (auth.uid() = user_id);

-- Redemptions table
CREATE TABLE public.redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.reward_catalog(id),
  points_spent integer NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'shipped', 'delivered', 'completed'
  shipping_address_id uuid REFERENCES public.shipping_addresses(id),
  tracking_number text,
  notes text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own redemptions" ON public.redemptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create redemptions" ON public.redemptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all redemptions" ON public.redemptions
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'marketing_sales')
  );

-- VendX Pay machines table
CREATE TABLE public.vendx_machines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_code text NOT NULL UNIQUE,
  machine_type text NOT NULL, -- 'vending', 'claw', 'arcade', 'other'
  name text NOT NULL,
  location_id uuid REFERENCES public.locations(id),
  api_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  vendx_pay_enabled boolean NOT NULL DEFAULT true,
  last_seen timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage machines" ON public.vendx_machines
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'tech_support_lead')
  );

-- Machine sessions table (for QR/PIN auth)
CREATE TABLE public.machine_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id uuid NOT NULL REFERENCES public.vendx_machines(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_code text NOT NULL UNIQUE,
  session_type text NOT NULL, -- 'qr', 'pin'
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'expired', 'used'
  expires_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.machine_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON public.machine_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions" ON public.machine_sessions
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'tech_support_lead')
  );

-- Machine transactions table
CREATE TABLE public.machine_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id uuid NOT NULL REFERENCES public.vendx_machines(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  wallet_transaction_id uuid REFERENCES public.wallet_transactions(id),
  amount numeric NOT NULL,
  item_name text,
  points_earned integer NOT NULL DEFAULT 0,
  session_id uuid REFERENCES public.machine_sessions(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.machine_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own machine transactions" ON public.machine_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all machine transactions" ON public.machine_transactions
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'tech_support_lead') OR
    has_role(auth.uid(), 'finance_accounting')
  );

-- Partner offers table
CREATE TABLE public.partner_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_name text NOT NULL,
  offer_name text NOT NULL,
  description text,
  discount_code text NOT NULL,
  discount_type text NOT NULL, -- 'percentage', 'fixed_amount'
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

ALTER TABLE public.partner_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active offers" ON public.partner_offers
  FOR SELECT USING (is_active = true AND (valid_until IS NULL OR valid_until >= CURRENT_DATE));

CREATE POLICY "Admins can manage offers" ON public.partner_offers
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'marketing_sales')
  );

-- Function to create wallet and points for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_vendx_pay()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Create wallet for new user
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0);
  
  -- Create rewards points record for new user
  INSERT INTO public.rewards_points (user_id, balance, lifetime_points, tier)
  VALUES (NEW.id, 0, 0, 'bronze');
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-create wallet and points for new users
DROP TRIGGER IF EXISTS on_auth_user_created_vendx_pay ON auth.users;
CREATE TRIGGER on_auth_user_created_vendx_pay
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_vendx_pay();

-- Function to update tier based on lifetime points
CREATE OR REPLACE FUNCTION public.update_user_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_tier text;
BEGIN
  -- Calculate tier based on lifetime points
  IF NEW.lifetime_points >= 100000 THEN
    new_tier := 'platinum';
  ELSIF NEW.lifetime_points >= 25000 THEN
    new_tier := 'gold';
  ELSIF NEW.lifetime_points >= 5000 THEN
    new_tier := 'silver';
  ELSE
    new_tier := 'bronze';
  END IF;
  
  -- Update tier if changed
  IF NEW.tier != new_tier THEN
    NEW.tier := new_tier;
    -- Also update profiles table
    UPDATE public.profiles SET tier_level = new_tier WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for tier updates
DROP TRIGGER IF EXISTS update_tier_on_points_change ON public.rewards_points;
CREATE TRIGGER update_tier_on_points_change
  BEFORE UPDATE ON public.rewards_points
  FOR EACH ROW EXECUTE FUNCTION public.update_user_tier();

-- Updated at triggers
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rewards_points_updated_at
  BEFORE UPDATE ON public.rewards_points
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reward_catalog_updated_at
  BEFORE UPDATE ON public.reward_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipping_addresses_updated_at
  BEFORE UPDATE ON public.shipping_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_redemptions_updated_at
  BEFORE UPDATE ON public.redemptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendx_machines_updated_at
  BEFORE UPDATE ON public.vendx_machines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_offers_updated_at
  BEFORE UPDATE ON public.partner_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample reward catalog items
INSERT INTO public.reward_catalog (name, description, points_cost, reward_type, credit_amount, requires_shipping, stock, tier_required) VALUES
('$5 Wallet Credit', 'Convert your points to $5 in wallet balance', 1000, 'vend_credit', 5.00, false, null, 'bronze'),
('$10 Wallet Credit', 'Convert your points to $10 in wallet balance', 1800, 'vend_credit', 10.00, false, null, 'bronze'),
('$25 Wallet Credit', 'Convert your points to $25 in wallet balance', 4000, 'vend_credit', 25.00, false, null, 'silver'),
('VendX T-Shirt', 'Premium VendX branded t-shirt', 5000, 'physical_item', null, true, 100, 'silver'),
('VendX Hoodie', 'Comfortable VendX branded hoodie', 8000, 'physical_item', null, true, 50, 'gold'),
('Snack Box', 'Assorted premium snacks delivered to your door', 3000, 'physical_item', null, true, 200, 'bronze'),
('VendX Cap', 'Stylish VendX branded cap', 2500, 'physical_item', null, true, 150, 'bronze'),
('Mystery Prize Box', 'Exclusive mystery items for Platinum members', 15000, 'physical_item', null, true, 25, 'platinum');

-- Insert sample partner offers
INSERT INTO public.partner_offers (partner_name, offer_name, description, discount_code, discount_type, discount_value, points_cost, valid_until) VALUES
('MoviePass', '20% Off Movie Tickets', 'Get 20% off your next movie ticket purchase', 'VENDX20', 'percentage', 20, 2000, '2025-12-31'),
('FoodDelivery', '$5 Off Your Order', 'Save $5 on your next food delivery order', 'VENDX5OFF', 'fixed_amount', 5, 1500, '2025-12-31'),
('GasStation', '10 Cents Off Per Gallon', 'Save 10 cents per gallon at participating stations', 'VENDXGAS10', 'fixed_amount', 0.10, 1000, '2025-12-31');