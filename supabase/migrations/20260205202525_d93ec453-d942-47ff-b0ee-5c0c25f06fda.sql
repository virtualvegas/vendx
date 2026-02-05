-- Add arcade pricing columns to vendx_machines
ALTER TABLE public.vendx_machines 
ADD COLUMN IF NOT EXISTS price_per_play numeric DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS plays_per_bundle integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS bundle_price numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pricing_template_id uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS total_plays integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_vends integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT NULL;

-- Create arcade pricing templates table
CREATE TABLE IF NOT EXISTS public.arcade_pricing_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  price_per_play numeric NOT NULL DEFAULT 1.00,
  bundles jsonb DEFAULT '[]'::jsonb,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create machine activity log table for detailed tracking
CREATE TABLE IF NOT EXISTS public.machine_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id uuid NOT NULL REFERENCES public.vendx_machines(id) ON DELETE CASCADE,
  activity_type text NOT NULL, -- 'play', 'vend', 'payment', 'status_change', 'error'
  user_id uuid DEFAULT NULL,
  session_id uuid DEFAULT NULL,
  amount numeric DEFAULT 0,
  credits_used integer DEFAULT 0,
  item_name text DEFAULT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster activity queries
CREATE INDEX IF NOT EXISTS idx_machine_activity_machine_id ON public.machine_activity_log(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_activity_created_at ON public.machine_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_machine_activity_type ON public.machine_activity_log(activity_type);

-- Add foreign key for pricing template
ALTER TABLE public.vendx_machines 
ADD CONSTRAINT fk_pricing_template 
FOREIGN KEY (pricing_template_id) 
REFERENCES public.arcade_pricing_templates(id) 
ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.arcade_pricing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_activity_log ENABLE ROW LEVEL SECURITY;

-- Policies for pricing templates (admin only via service role, read for authenticated)
CREATE POLICY "Anyone can view active pricing templates" 
ON public.arcade_pricing_templates FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage pricing templates" 
ON public.arcade_pricing_templates FOR ALL 
USING (true);

-- Policies for activity log (read for authenticated users)
CREATE POLICY "Authenticated users can view activity logs" 
ON public.machine_activity_log FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Service role can insert activity logs" 
ON public.machine_activity_log FOR INSERT 
WITH CHECK (true);

-- Function to log machine activity and update stats
CREATE OR REPLACE FUNCTION public.log_machine_activity(
  p_machine_id uuid,
  p_activity_type text,
  p_user_id uuid DEFAULT NULL,
  p_session_id uuid DEFAULT NULL,
  p_amount numeric DEFAULT 0,
  p_credits_used integer DEFAULT 0,
  p_item_name text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_id uuid;
BEGIN
  -- Insert activity log
  INSERT INTO machine_activity_log (
    machine_id, activity_type, user_id, session_id, 
    amount, credits_used, item_name, metadata
  ) VALUES (
    p_machine_id, p_activity_type, p_user_id, p_session_id,
    p_amount, p_credits_used, p_item_name, p_metadata
  ) RETURNING id INTO v_activity_id;

  -- Update machine stats based on activity type
  IF p_activity_type = 'play' THEN
    UPDATE vendx_machines 
    SET 
      total_plays = COALESCE(total_plays, 0) + 1,
      last_activity_at = now(),
      current_period_revenue = COALESCE(current_period_revenue, 0) + p_amount,
      lifetime_revenue = COALESCE(lifetime_revenue, 0) + p_amount
    WHERE id = p_machine_id;
  ELSIF p_activity_type = 'vend' THEN
    UPDATE vendx_machines 
    SET 
      total_vends = COALESCE(total_vends, 0) + 1,
      last_activity_at = now(),
      current_period_revenue = COALESCE(current_period_revenue, 0) + p_amount,
      lifetime_revenue = COALESCE(lifetime_revenue, 0) + p_amount
    WHERE id = p_machine_id;
  ELSE
    UPDATE vendx_machines 
    SET last_activity_at = now()
    WHERE id = p_machine_id;
  END IF;

  RETURN v_activity_id;
END;
$$;

-- Insert default pricing template
INSERT INTO public.arcade_pricing_templates (name, description, price_per_play, bundles, is_default)
VALUES (
  'Standard Arcade',
  'Default arcade pricing with bundle options',
  1.00,
  '[{"plays": 2, "price": 1.50, "label": "2 Plays"}, {"plays": 5, "price": 3.50, "label": "5 Plays"}, {"plays": 10, "price": 6.00, "label": "10 Plays"}]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- Enable realtime for activity log
ALTER PUBLICATION supabase_realtime ADD TABLE public.machine_activity_log;