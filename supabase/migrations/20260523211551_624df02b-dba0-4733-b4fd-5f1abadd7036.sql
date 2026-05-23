
CREATE TABLE public.vendx_brand_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'Sparkles',
  color TEXT NOT NULL DEFAULT 'from-primary to-accent',
  badge TEXT,
  section TEXT NOT NULL DEFAULT 'divisions',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_external BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendx_brand_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active brand links"
ON public.vendx_brand_links FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales'));

CREATE POLICY "Admins can insert brand links"
ON public.vendx_brand_links FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales'));

CREATE POLICY "Admins can update brand links"
ON public.vendx_brand_links FOR UPDATE
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales'));

CREATE POLICY "Admins can delete brand links"
ON public.vendx_brand_links FOR DELETE
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'marketing_sales'));

CREATE TRIGGER update_vendx_brand_links_updated_at
BEFORE UPDATE ON public.vendx_brand_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vendx_brand_links_section ON public.vendx_brand_links(section, sort_order) WHERE is_active = true;

INSERT INTO public.vendx_brand_links (name, slug, url, description, icon, color, badge, section, sort_order, is_external, is_featured) VALUES
('Emos R Us', 'emos-r-us', 'https://emosrus.com', 'Alternative fashion & lifestyle — emo, goth, punk, and subculture clothing, accessories, collectibles & décor.', 'Shirt', 'from-fuchsia-600 to-purple-900', 'Alt Fashion', 'featured', 10, true, true),
('Host Heroz', 'host-heroz', 'https://hostheroz.com', 'Party rentals, event ticket platform & online party store for every celebration.', 'PartyPopper', 'from-orange-500 to-pink-500', 'Events & Parties', 'featured', 20, true, true),
('VendX Interactive', 'vendx-interactive', '/games', 'Our gaming & entertainment division — original games, arcade, and digital experiences.', 'Gamepad2', 'from-purple-500 to-pink-500', 'Gaming', 'divisions', 10, false, false),
('VendX Media', 'vendx-media', '/divisions', 'Music, film, and artist commerce powered by the VendX ecosystem.', 'Sparkles', 'from-violet-500 to-indigo-500', 'Media', 'divisions', 20, false, false),
('VendX Mars', 'vendx-mars', '/about', 'Pioneering automated retail beyond Earth — the future of off-world vending.', 'Rocket', 'from-red-600 to-orange-500', 'Future', 'divisions', 30, false, false);
