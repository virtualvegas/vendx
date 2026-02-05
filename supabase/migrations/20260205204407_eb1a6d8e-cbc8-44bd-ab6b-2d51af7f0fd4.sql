-- Drop partial objects from failed migration
DROP TABLE IF EXISTS public.ticket_redemptions;
DROP TABLE IF EXISTS public.prize_inventory;
DROP TABLE IF EXISTS public.ticket_prizes;

-- Create ticket_prizes table for available prizes
CREATE TABLE public.ticket_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  ticket_cost INTEGER NOT NULL CHECK (ticket_cost > 0),
  category TEXT DEFAULT 'general',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  requires_shipping BOOLEAN DEFAULT false,
  min_age INTEGER,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create prize_inventory table for location-based stock
CREATE TABLE public.prize_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_id UUID REFERENCES public.ticket_prizes(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER DEFAULT 0 NOT NULL,
  reserved_quantity INTEGER DEFAULT 0 NOT NULL,
  low_stock_threshold INTEGER DEFAULT 5,
  last_restocked TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(prize_id, location_id)
);

-- Create ticket_redemptions table for tracking redemptions
CREATE TABLE public.ticket_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  prize_id UUID REFERENCES public.ticket_prizes(id) ON DELETE SET NULL NOT NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  tickets_spent INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'rejected', 'cancelled')),
  redemption_type TEXT DEFAULT 'online' CHECK (redemption_type IN ('online', 'in_person')),
  redemption_code TEXT UNIQUE,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  completed_by UUID,
  completed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  shipping_address_id UUID REFERENCES public.shipping_addresses(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX idx_ticket_prizes_active ON public.ticket_prizes(is_active);
CREATE INDEX idx_ticket_prizes_category ON public.ticket_prizes(category);
CREATE INDEX idx_prize_inventory_prize ON public.prize_inventory(prize_id);
CREATE INDEX idx_prize_inventory_location ON public.prize_inventory(location_id);
CREATE INDEX idx_ticket_redemptions_user ON public.ticket_redemptions(user_id);
CREATE INDEX idx_ticket_redemptions_status ON public.ticket_redemptions(status);
CREATE INDEX idx_ticket_redemptions_code ON public.ticket_redemptions(redemption_code);

-- Enable RLS
ALTER TABLE public.ticket_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prize_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS for ticket_prizes (public read for active prizes)
CREATE POLICY "Anyone can view active prizes"
ON public.ticket_prizes FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage prizes"
ON public.ticket_prizes FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- RLS for prize_inventory (public read)
CREATE POLICY "Anyone can view inventory"
ON public.prize_inventory FOR SELECT
USING (true);

CREATE POLICY "Admins can manage inventory"
ON public.prize_inventory FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'employee_operator'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'employee_operator'));

-- RLS for ticket_redemptions
CREATE POLICY "Users can view own redemptions"
ON public.ticket_redemptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own redemptions"
ON public.ticket_redemptions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all redemptions"
ON public.ticket_redemptions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'employee_operator'));

CREATE POLICY "Admins can update redemptions"
ON public.ticket_redemptions FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'employee_operator'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'employee_operator'));

-- Triggers for updated_at
CREATE TRIGGER update_ticket_prizes_updated_at
BEFORE UPDATE ON public.ticket_prizes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prize_inventory_updated_at
BEFORE UPDATE ON public.prize_inventory
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ticket_redemptions_updated_at
BEFORE UPDATE ON public.ticket_redemptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to process ticket redemption
CREATE OR REPLACE FUNCTION public.process_ticket_redemption(
  p_user_id UUID,
  p_prize_id UUID,
  p_location_id UUID DEFAULT NULL,
  p_redemption_type TEXT DEFAULT 'online',
  p_shipping_address_id UUID DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  redemption_id UUID,
  redemption_code TEXT,
  new_balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prize RECORD;
  v_user_balance INTEGER;
  v_new_balance INTEGER;
  v_redemption_id UUID;
  v_redemption_code TEXT;
  v_inventory_id UUID;
  v_initial_status TEXT;
BEGIN
  -- Get prize info
  SELECT * INTO v_prize FROM ticket_prizes WHERE id = p_prize_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Prize not found or inactive'::TEXT, NULL::UUID, NULL::TEXT, NULL::INTEGER;
    RETURN;
  END IF;
  
  -- Get user's ticket balance
  SELECT balance INTO v_user_balance FROM user_tickets WHERE user_id = p_user_id;
  
  IF v_user_balance IS NULL OR v_user_balance < v_prize.ticket_cost THEN
    RETURN QUERY SELECT false, 'Insufficient tickets'::TEXT, NULL::UUID, NULL::TEXT, COALESCE(v_user_balance, 0);
    RETURN;
  END IF;
  
  -- Check inventory if location specified
  IF p_location_id IS NOT NULL THEN
    SELECT id INTO v_inventory_id 
    FROM prize_inventory 
    WHERE prize_id = p_prize_id 
      AND location_id = p_location_id 
      AND quantity - reserved_quantity > 0
    FOR UPDATE;
    
    IF NOT FOUND THEN
      RETURN QUERY SELECT false, 'Prize out of stock at this location'::TEXT, NULL::UUID, NULL::TEXT, v_user_balance;
      RETURN;
    END IF;
    
    -- Reserve inventory
    UPDATE prize_inventory 
    SET reserved_quantity = reserved_quantity + 1 
    WHERE id = v_inventory_id;
  END IF;
  
  -- Generate redemption code
  v_redemption_code := 'VTX-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8));
  
  -- Determine initial status
  v_initial_status := CASE 
    WHEN v_prize.requires_approval THEN 'pending'
    ELSE 'approved'
  END;
  
  -- Create redemption record
  INSERT INTO ticket_redemptions (
    user_id, prize_id, location_id, tickets_spent, status,
    redemption_type, redemption_code, shipping_address_id,
    approved_at
  ) VALUES (
    p_user_id, p_prize_id, p_location_id, v_prize.ticket_cost, v_initial_status,
    p_redemption_type, v_redemption_code, p_shipping_address_id,
    CASE WHEN v_initial_status = 'approved' THEN NOW() ELSE NULL END
  )
  RETURNING id INTO v_redemption_id;
  
  -- Deduct tickets
  UPDATE user_tickets 
  SET 
    balance = balance - v_prize.ticket_cost,
    lifetime_redeemed = lifetime_redeemed + v_prize.ticket_cost
  WHERE user_id = p_user_id;
  
  -- Log transaction
  INSERT INTO ticket_transactions (
    user_id, transaction_type, amount, balance_after, metadata
  ) VALUES (
    p_user_id, 'redemption', -v_prize.ticket_cost, 
    (SELECT balance FROM user_tickets WHERE user_id = p_user_id),
    jsonb_build_object('redemption_id', v_redemption_id, 'prize_id', p_prize_id, 'prize_name', v_prize.name)
  );
  
  -- Get new balance
  SELECT balance INTO v_new_balance FROM user_tickets WHERE user_id = p_user_id;
  
  RETURN QUERY SELECT 
    true, 
    'Redemption successful'::TEXT, 
    v_redemption_id, 
    v_redemption_code,
    v_new_balance;
END;
$$;

-- Function to complete in-person redemption (staff use)
CREATE OR REPLACE FUNCTION public.complete_redemption(
  p_redemption_id UUID,
  p_staff_id UUID
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption RECORD;
BEGIN
  SELECT * INTO v_redemption FROM ticket_redemptions WHERE id = p_redemption_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Redemption not found'::TEXT;
    RETURN;
  END IF;
  
  IF v_redemption.status = 'completed' THEN
    RETURN QUERY SELECT false, 'Already completed'::TEXT;
    RETURN;
  END IF;
  
  IF v_redemption.status NOT IN ('pending', 'approved') THEN
    RETURN QUERY SELECT false, 'Invalid status for completion'::TEXT;
    RETURN;
  END IF;
  
  -- Update redemption
  UPDATE ticket_redemptions 
  SET 
    status = 'completed',
    completed_by = p_staff_id,
    completed_at = NOW(),
    approved_by = COALESCE(approved_by, p_staff_id),
    approved_at = COALESCE(approved_at, NOW())
  WHERE id = p_redemption_id;
  
  -- Deduct from inventory if location-based
  IF v_redemption.location_id IS NOT NULL THEN
    UPDATE prize_inventory 
    SET 
      quantity = quantity - 1,
      reserved_quantity = GREATEST(reserved_quantity - 1, 0)
    WHERE prize_id = v_redemption.prize_id 
      AND location_id = v_redemption.location_id;
  END IF;
  
  RETURN QUERY SELECT true, 'Redemption completed'::TEXT;
END;
$$;