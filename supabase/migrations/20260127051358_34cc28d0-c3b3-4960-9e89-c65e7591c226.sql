-- Create business services table
CREATE TABLE public.business_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icon TEXT NOT NULL DEFAULT 'Package',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  features TEXT[] DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create business benefits table
CREATE TABLE public.business_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icon TEXT NOT NULL DEFAULT 'Star',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create business testimonials table
CREATE TABLE public.business_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  location TEXT NOT NULL,
  quote TEXT NOT NULL,
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.business_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_testimonials ENABLE ROW LEVEL SECURITY;

-- Public read access for all
CREATE POLICY "Public can read active services"
ON public.business_services FOR SELECT
USING (is_active = true);

CREATE POLICY "Public can read active benefits"
ON public.business_benefits FOR SELECT
USING (is_active = true);

CREATE POLICY "Public can read active testimonials"
ON public.business_testimonials FOR SELECT
USING (is_active = true);

-- Admin full access
CREATE POLICY "Admins can manage services"
ON public.business_services FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage benefits"
ON public.business_benefits FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage testimonials"
ON public.business_testimonials FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Add updated_at triggers
CREATE TRIGGER update_business_services_updated_at
  BEFORE UPDATE ON public.business_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_business_benefits_updated_at
  BEFORE UPDATE ON public.business_benefits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_business_testimonials_updated_at
  BEFORE UPDATE ON public.business_testimonials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();