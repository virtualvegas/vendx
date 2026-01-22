-- Create table to store synced payment provider transactions
CREATE TABLE public.synced_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  provider_transaction_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL DEFAULT 'revenue',
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL,
  description TEXT,
  customer_email TEXT,
  customer_name TEXT,
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_transaction_id)
);

-- Enable Row Level Security
ALTER TABLE public.synced_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for finance and super admin access
CREATE POLICY "Finance can view synced transactions" 
ON public.synced_transactions 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance_accounting'::app_role));

CREATE POLICY "Finance can manage synced transactions" 
ON public.synced_transactions 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance_accounting'::app_role));

-- Create sync status table to track last sync times
CREATE TABLE public.transaction_sync_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE CHECK (provider IN ('stripe', 'paypal')),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_sync_cursor TEXT,
  sync_status TEXT NOT NULL DEFAULT 'idle',
  error_message TEXT,
  transactions_synced INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for sync status
ALTER TABLE public.transaction_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance can view sync status" 
ON public.transaction_sync_status 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance_accounting'::app_role));

CREATE POLICY "Finance can manage sync status" 
ON public.transaction_sync_status 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance_accounting'::app_role));

-- Insert initial sync status records
INSERT INTO public.transaction_sync_status (provider, sync_status) VALUES ('stripe', 'idle'), ('paypal', 'idle');

-- Create index for faster queries
CREATE INDEX idx_synced_transactions_date ON public.synced_transactions(transaction_date DESC);
CREATE INDEX idx_synced_transactions_provider ON public.synced_transactions(provider);