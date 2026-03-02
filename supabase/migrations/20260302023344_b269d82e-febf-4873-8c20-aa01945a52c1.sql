
-- Add artist_id to media_shop_products
ALTER TABLE public.media_shop_products ADD COLUMN artist_id UUID REFERENCES public.media_artists(id) ON DELETE SET NULL DEFAULT NULL;

-- Create artist payouts table
CREATE TABLE public.artist_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id UUID NOT NULL REFERENCES public.media_artists(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT DEFAULT 'bank_transfer',
  payment_reference TEXT,
  notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create artist payout items (line items per product sold)
CREATE TABLE public.artist_payout_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payout_id UUID NOT NULL REFERENCES public.artist_payouts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.media_shop_products(id) ON DELETE SET NULL,
  product_title TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.artist_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_payout_items ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can manage artist payouts" ON public.artist_payouts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage payout items" ON public.artist_payout_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Public read for payouts (artists can view their own - future)
CREATE POLICY "Public can read artist payouts" ON public.artist_payouts
  FOR SELECT USING (true);

CREATE POLICY "Public can read payout items" ON public.artist_payout_items
  FOR SELECT USING (true);

-- Add index
CREATE INDEX idx_media_shop_products_artist ON public.media_shop_products(artist_id);
CREATE INDEX idx_artist_payouts_artist ON public.artist_payouts(artist_id);

-- Add commission rate to artists
ALTER TABLE public.media_artists ADD COLUMN commission_rate NUMERIC DEFAULT 0.70;

-- Trigger for updated_at
CREATE TRIGGER update_artist_payouts_updated_at
  BEFORE UPDATE ON public.artist_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
