
-- Media Shop Products (merch, digital downloads, etc.)
CREATE TABLE public.media_shop_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  product_type TEXT NOT NULL CHECK (product_type IN ('merch', 'digital_download', 'vinyl', 'cd', 'poster', 'other')),
  media_release_id UUID REFERENCES public.media_releases(id) ON DELETE SET NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  compare_at_price NUMERIC(10,2),
  image_url TEXT,
  file_url TEXT, -- for digital downloads
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  stock_quantity INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.media_shop_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Media shop products are publicly readable"
  ON public.media_shop_products FOR SELECT USING (true);

CREATE POLICY "Super admins can manage media shop products"
  ON public.media_shop_products FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_media_shop_products_updated_at
  BEFORE UPDATE ON public.media_shop_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Beat Tracks for Track Shop
CREATE TABLE public.beat_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  producer TEXT,
  genre TEXT[],
  bpm INTEGER,
  key TEXT, -- musical key
  duration_seconds INTEGER, -- full track duration
  preview_url TEXT, -- 30-second preview audio URL (storage)
  full_file_url TEXT, -- full beat file URL (storage, private)
  cover_image_url TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  license_type TEXT DEFAULT 'standard' CHECK (license_type IN ('standard', 'premium', 'exclusive')),
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  play_count INTEGER DEFAULT 0,
  purchase_count INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beat_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Beat tracks are publicly readable"
  ON public.beat_tracks FOR SELECT USING (true);

CREATE POLICY "Super admins can manage beat tracks"
  ON public.beat_tracks FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_beat_tracks_updated_at
  BEFORE UPDATE ON public.beat_tracks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Beat Purchases tracking
CREATE TABLE public.beat_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  beat_id UUID NOT NULL REFERENCES public.beat_tracks(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'stripe',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  stripe_session_id TEXT,
  download_token TEXT UNIQUE,
  download_count INTEGER DEFAULT 0,
  download_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beat_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own beat purchases"
  ON public.beat_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage beat purchases"
  ON public.beat_purchases FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Allow insert for beat purchases"
  ON public.beat_purchases FOR INSERT
  WITH CHECK (true);

CREATE TRIGGER update_beat_purchases_updated_at
  BEFORE UPDATE ON public.beat_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage buckets for beat files
INSERT INTO storage.buckets (id, name, public) VALUES ('beat-previews', 'beat-previews', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('beat-files', 'beat-files', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('media-shop-images', 'media-shop-images', true);

-- Storage policies for beat previews (public read)
CREATE POLICY "Beat previews are publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'beat-previews');

CREATE POLICY "Admins can upload beat previews"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'beat-previews' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete beat previews"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'beat-previews' AND public.is_super_admin(auth.uid()));

-- Storage policies for beat full files (private, admin upload only)
CREATE POLICY "Admins can upload beat files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'beat-files' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage beat files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'beat-files' AND public.is_super_admin(auth.uid()));

-- Storage policies for media shop images
CREATE POLICY "Media shop images are publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'media-shop-images');

CREATE POLICY "Admins can upload media shop images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media-shop-images' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete media shop images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media-shop-images' AND public.is_super_admin(auth.uid()));
