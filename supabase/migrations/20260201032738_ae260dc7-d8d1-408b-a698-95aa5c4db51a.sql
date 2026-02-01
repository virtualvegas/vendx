-- Add payment method configuration to vendx_machines table
ALTER TABLE vendx_machines 
ADD COLUMN IF NOT EXISTS accepts_cash BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS accepts_coins BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS accepts_cards BOOLEAN DEFAULT true;

-- Create revenue_collections table for field operations revenue collection tracking
CREATE TABLE IF NOT EXISTS revenue_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES vendx_machines(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  collected_by UUID REFERENCES auth.users(id),
  route_stop_id UUID REFERENCES route_stops(id),
  
  -- Collection amounts
  cash_amount NUMERIC DEFAULT 0,
  coins_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  
  -- Collection details
  collection_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  
  -- Verification
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'disputed')),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_revenue_collections_machine ON revenue_collections(machine_id);
CREATE INDEX IF NOT EXISTS idx_revenue_collections_date ON revenue_collections(collection_date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_collections_collector ON revenue_collections(collected_by);

-- Enable RLS
ALTER TABLE revenue_collections ENABLE ROW LEVEL SECURITY;

-- RLS policies for revenue_collections
CREATE POLICY "Operators can create revenue collections"
ON revenue_collections
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'global_operations_manager') OR 
  has_role(auth.uid(), 'regional_manager') OR 
  has_role(auth.uid(), 'employee_operator')
);

CREATE POLICY "Operators can view own collections"
ON revenue_collections
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'finance_accounting') OR
  has_role(auth.uid(), 'global_operations_manager') OR 
  has_role(auth.uid(), 'regional_manager') OR
  (collected_by = auth.uid())
);

CREATE POLICY "Managers can update collections"
ON revenue_collections
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'finance_accounting') OR
  has_role(auth.uid(), 'global_operations_manager')
);

CREATE POLICY "Admins can delete collections"
ON revenue_collections
FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin')
);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_revenue_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_revenue_collections_updated_at ON revenue_collections;
CREATE TRIGGER update_revenue_collections_updated_at
BEFORE UPDATE ON revenue_collections
FOR EACH ROW
EXECUTE FUNCTION update_revenue_collections_updated_at();