-- Create store products table
CREATE TABLE public.store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  compare_at_price NUMERIC,
  category TEXT NOT NULL,
  subcategory TEXT,
  images TEXT[] DEFAULT '{}',
  stock INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  is_subscription BOOLEAN DEFAULT false,
  subscription_interval TEXT,
  subscription_price NUMERIC,
  stripe_price_id TEXT,
  stripe_product_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create product add-ons table (for Snack In The Box)
CREATE TABLE public.store_product_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.store_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  stripe_price_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create shopping cart table
CREATE TABLE public.store_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create cart items table
CREATE TABLE public.store_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES public.store_carts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.store_products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  addon_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create orders table
CREATE TABLE public.store_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  shipping_address_id UUID REFERENCES public.shipping_addresses(id),
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create order items table
CREATE TABLE public.store_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.store_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.store_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  addon_details JSONB DEFAULT '[]',
  total NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create subscriptions table for Snack In The Box
CREATE TABLE public.store_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.store_products(id) ON DELETE SET NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  addon_ids UUID[] DEFAULT '{}',
  shipping_address_id UUID REFERENCES public.shipping_addresses(id),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_product_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;

-- Products: Anyone can view active products
CREATE POLICY "Anyone can view active products" ON public.store_products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Super admins can manage products" ON public.store_products
  FOR ALL USING (is_super_admin(auth.uid()));

-- Product addons: Anyone can view active addons
CREATE POLICY "Anyone can view active addons" ON public.store_product_addons
  FOR SELECT USING (is_active = true);

CREATE POLICY "Super admins can manage addons" ON public.store_product_addons
  FOR ALL USING (is_super_admin(auth.uid()));

-- Carts: Users can manage their own cart
CREATE POLICY "Users can manage own cart" ON public.store_carts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anonymous carts by session" ON public.store_carts
  FOR ALL USING (session_id IS NOT NULL AND user_id IS NULL);

-- Cart items: Based on cart ownership
CREATE POLICY "Users can manage own cart items" ON public.store_cart_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.store_carts 
      WHERE store_carts.id = store_cart_items.cart_id 
      AND (store_carts.user_id = auth.uid() OR store_carts.session_id IS NOT NULL)
    )
  );

-- Orders: Users can view own orders
CREATE POLICY "Users can view own orders" ON public.store_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all orders" ON public.store_orders
  FOR ALL USING (is_super_admin(auth.uid()));

-- Order items: Based on order ownership
CREATE POLICY "Users can view own order items" ON public.store_order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.store_orders 
      WHERE store_orders.id = store_order_items.order_id 
      AND store_orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage all order items" ON public.store_order_items
  FOR ALL USING (is_super_admin(auth.uid()));

-- Subscriptions: Users can view own subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.store_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON public.store_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all subscriptions" ON public.store_subscriptions
  FOR ALL USING (is_super_admin(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_store_products_updated_at
  BEFORE UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_carts_updated_at
  BEFORE UPDATE ON public.store_carts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_orders_updated_at
  BEFORE UPDATE ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_subscriptions_updated_at
  BEFORE UPDATE ON public.store_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generate order number function
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.order_number := 'VX-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_order_number_trigger
  BEFORE INSERT ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

-- Insert sample products
INSERT INTO public.store_products (name, slug, description, short_description, price, category, is_active, is_featured, images) VALUES
('Snack In The Box', 'snack-in-the-box', 'Monthly curated snack box delivered to your door. Premium snacks from around the world, featuring chips, candy, cookies, and unique treats you wont find anywhere else.', 'Monthly premium snack subscription box', 29.99, 'subscriptions', true, true, ARRAY['https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=800']),
('VendX Classic Tee', 'vendx-classic-tee', 'Premium cotton t-shirt featuring the VendX logo. Comfortable, stylish, and perfect for tech enthusiasts.', 'Classic VendX logo t-shirt', 24.99, 'apparel', true, true, ARRAY['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800']),
('VendX Hoodie', 'vendx-hoodie', 'Stay warm in style with our premium VendX hoodie. Soft fleece interior, kangaroo pocket, and embroidered logo.', 'Premium VendX branded hoodie', 59.99, 'apparel', true, true, ARRAY['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800']),
('Sticker Pack', 'vendx-sticker-pack', 'Collection of 10 premium vinyl stickers featuring VendX designs, space themes, and vending machine art.', '10-pack premium vinyl stickers', 9.99, 'accessories', true, false, ARRAY['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800']),
('VendX Cap', 'vendx-cap', 'Adjustable snapback cap with embroidered VendX logo. One size fits all.', 'Snapback cap with VendX logo', 29.99, 'apparel', true, false, ARRAY['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800']),
('Retro Arcade Tokens', 'arcade-tokens', 'Pack of 25 authentic arcade tokens. Perfect for collectors or arcade machine owners.', '25-pack arcade tokens', 19.99, 'tech', true, false, ARRAY['https://images.unsplash.com/photo-1511882150382-421056c89033?w=800']),
('VendX Water Bottle', 'vendx-water-bottle', 'Insulated stainless steel water bottle with VendX branding. Keeps drinks cold for 24 hours.', '24oz insulated water bottle', 34.99, 'accessories', true, false, ARRAY['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800']),
('Snack Variety Pack', 'snack-variety-pack', 'One-time purchase variety pack with 20 premium snacks. Sample what Snack In The Box offers!', '20-snack variety pack', 39.99, 'snacks', true, true, ARRAY['https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=800']);

-- Update Snack In The Box to be a subscription product
UPDATE public.store_products 
SET is_subscription = true, subscription_interval = 'month', subscription_price = 29.99
WHERE slug = 'snack-in-the-box';

-- Insert add-ons for Snack In The Box
INSERT INTO public.store_product_addons (product_id, name, description, price) 
SELECT id, 'International Snacks', 'Add exotic snacks from Japan, Korea, and Europe', 7.99
FROM public.store_products WHERE slug = 'snack-in-the-box';

INSERT INTO public.store_product_addons (product_id, name, description, price) 
SELECT id, 'Drink Add-On', 'Include 4 premium beverages with your box', 5.99
FROM public.store_products WHERE slug = 'snack-in-the-box';

INSERT INTO public.store_product_addons (product_id, name, description, price) 
SELECT id, 'Healthy Options', 'Swap some snacks for healthier alternatives', 3.99
FROM public.store_products WHERE slug = 'snack-in-the-box';