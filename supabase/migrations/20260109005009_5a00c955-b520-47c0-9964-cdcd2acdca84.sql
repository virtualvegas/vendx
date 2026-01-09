
-- =============================================
-- SALES FUNNELS SYSTEM
-- =============================================

-- Main funnels table
CREATE TABLE public.store_funnels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  funnel_type TEXT NOT NULL DEFAULT 'standard', -- standard, upsell, cross-sell, bundle
  display_order INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Funnel steps/stages
CREATE TABLE public.store_funnel_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.store_funnels(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 0,
  step_type TEXT NOT NULL DEFAULT 'product', -- product, upsell, cross-sell, addon, checkout
  title TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Products linked to funnel steps
CREATE TABLE public.store_funnel_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_step_id UUID NOT NULL REFERENCES public.store_funnel_steps(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  custom_price NUMERIC, -- Override price for this funnel
  custom_name TEXT, -- Override name for this funnel
  discount_percentage NUMERIC DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  quantity_limit INTEGER, -- Max quantity per order
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Funnel-specific add-ons
CREATE TABLE public.store_funnel_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_step_id UUID NOT NULL REFERENCES public.store_funnel_steps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Funnel analytics/tracking
CREATE TABLE public.store_funnel_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.store_funnels(id) ON DELETE CASCADE,
  session_id TEXT,
  user_id UUID,
  step_reached INTEGER DEFAULT 1,
  completed BOOLEAN DEFAULT false,
  total_value NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- NEWS/BLOG SYSTEM
-- =============================================

-- News categories
CREATE TABLE public.news_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- News articles
CREATE TABLE public.news_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image TEXT,
  category_id UUID REFERENCES public.news_categories(id) ON DELETE SET NULL,
  author_id UUID,
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_funnel_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_funnel_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_funnel_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_funnel_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Funnels
CREATE POLICY "Anyone can view active funnels" ON public.store_funnels
  FOR SELECT USING (is_active = true);

CREATE POLICY "Super admins can manage funnels" ON public.store_funnels
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Anyone can view funnel steps" ON public.store_funnel_steps
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM store_funnels WHERE id = funnel_id AND is_active = true
  ));

CREATE POLICY "Super admins can manage funnel steps" ON public.store_funnel_steps
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Anyone can view funnel products" ON public.store_funnel_products
  FOR SELECT USING (true);

CREATE POLICY "Super admins can manage funnel products" ON public.store_funnel_products
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Anyone can view active funnel addons" ON public.store_funnel_addons
  FOR SELECT USING (is_active = true);

CREATE POLICY "Super admins can manage funnel addons" ON public.store_funnel_addons
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Analytics insert for all" ON public.store_funnel_analytics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own analytics" ON public.store_funnel_analytics
  FOR SELECT USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage analytics" ON public.store_funnel_analytics
  FOR ALL USING (is_super_admin(auth.uid()));

-- RLS Policies for News
CREATE POLICY "Anyone can view published articles" ON public.news_articles
  FOR SELECT USING (is_published = true);

CREATE POLICY "Super admins can manage articles" ON public.news_articles
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Anyone can view active categories" ON public.news_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Super admins can manage categories" ON public.news_categories
  FOR ALL USING (is_super_admin(auth.uid()));

-- Update trigger for timestamps
CREATE TRIGGER update_store_funnels_updated_at
  BEFORE UPDATE ON public.store_funnels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_funnel_steps_updated_at
  BEFORE UPDATE ON public.store_funnel_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_news_articles_updated_at
  BEFORE UPDATE ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
