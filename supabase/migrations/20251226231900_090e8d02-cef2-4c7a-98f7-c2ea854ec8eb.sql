-- Add business_owner role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'business_owner';

-- Machine profit splits table (per-machine revenue sharing)
CREATE TABLE public.machine_profit_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL,
  vendx_percentage NUMERIC NOT NULL DEFAULT 70 CHECK (vendx_percentage >= 0 AND vendx_percentage <= 100),
  business_owner_percentage NUMERIC NOT NULL DEFAULT 30 CHECK (business_owner_percentage >= 0 AND business_owner_percentage <= 100),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT percentages_sum_check CHECK (vendx_percentage + business_owner_percentage = 100)
);

-- Location assignments for business owners
CREATE TABLE public.location_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  business_owner_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, business_owner_id)
);

-- Payout settings for business owners
CREATE TABLE public.payout_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'stripe_connect', 'check')),
  stripe_account_id TEXT,
  bank_name TEXT,
  bank_account_last4 TEXT,
  bank_routing_last4 TEXT,
  payout_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (payout_frequency IN ('weekly', 'bi_weekly', 'monthly')),
  minimum_payout_amount NUMERIC NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payouts table for tracking payments to business owners
CREATE TABLE public.payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_owner_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  gross_revenue NUMERIC NOT NULL,
  vendx_share NUMERIC NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payout line items (per-machine breakdown)
CREATE TABLE public.payout_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payout_id UUID NOT NULL REFERENCES public.payouts(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL,
  location_id UUID NOT NULL,
  gross_revenue NUMERIC NOT NULL,
  vendx_percentage NUMERIC NOT NULL,
  vendx_share NUMERIC NOT NULL,
  owner_share NUMERIC NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add revenue tracking columns to vendx_machines if not exists
ALTER TABLE public.vendx_machines 
ADD COLUMN IF NOT EXISTS current_period_revenue NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS lifetime_revenue NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_revenue_sync TIMESTAMPTZ;

-- Enable RLS
ALTER TABLE public.machine_profit_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for machine_profit_splits
CREATE POLICY "Admins can manage profit splits" ON public.machine_profit_splits
FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));

CREATE POLICY "Business owners can view their machine splits" ON public.machine_profit_splits
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.vendx_machines vm
    JOIN public.location_assignments la ON vm.location_id = la.location_id
    WHERE vm.id = machine_profit_splits.machine_id 
    AND la.business_owner_id = auth.uid()
    AND la.is_active = true
  )
);

-- RLS Policies for location_assignments
CREATE POLICY "Admins can manage location assignments" ON public.location_assignments
FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'global_operations_manager'));

CREATE POLICY "Business owners can view their assignments" ON public.location_assignments
FOR SELECT USING (business_owner_id = auth.uid());

-- RLS Policies for payout_settings
CREATE POLICY "Admins can view all payout settings" ON public.payout_settings
FOR SELECT USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));

CREATE POLICY "Users can manage own payout settings" ON public.payout_settings
FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for payouts
CREATE POLICY "Admins can manage all payouts" ON public.payouts
FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));

CREATE POLICY "Business owners can view their payouts" ON public.payouts
FOR SELECT USING (business_owner_id = auth.uid());

-- RLS Policies for payout_line_items
CREATE POLICY "Admins can view all payout items" ON public.payout_line_items
FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));

CREATE POLICY "Business owners can view their payout items" ON public.payout_line_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.payouts p
    WHERE p.id = payout_line_items.payout_id
    AND p.business_owner_id = auth.uid()
  )
);

-- Create updated_at triggers
CREATE TRIGGER update_machine_profit_splits_updated_at
BEFORE UPDATE ON public.machine_profit_splits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payout_settings_updated_at
BEFORE UPDATE ON public.payout_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at
BEFORE UPDATE ON public.payouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();