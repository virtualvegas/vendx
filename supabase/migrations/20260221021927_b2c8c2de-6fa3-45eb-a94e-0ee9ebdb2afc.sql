
-- Table for site policies (privacy, terms, cookies)
CREATE TABLE public.site_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  last_updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_policies ENABLE ROW LEVEL SECURITY;

-- Anyone can read policies
CREATE POLICY "Public can view policies"
ON public.site_policies FOR SELECT
USING (true);

-- Only super_admins can update
CREATE POLICY "Admins can update policies"
ON public.site_policies FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can insert policies"
ON public.site_policies FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Trigger for updated_at
CREATE TRIGGER update_site_policies_updated_at
BEFORE UPDATE ON public.site_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default policies
INSERT INTO public.site_policies (slug, title, content) VALUES
('privacy-policy', 'Privacy Policy', '# Privacy Policy

## Introduction
VendX Global Corporation ("VendX", "we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our services.

## Information We Collect
We may collect information about you in a variety of ways, including:
- **Personal Data:** Name, email address, phone number, and payment information when you create an account or make purchases.
- **Usage Data:** Information about how you interact with our machines, app, and services.
- **Location Data:** With your permission, we may collect location data to help you find nearby VendX machines.

## How We Use Your Information
We use the information we collect to:
- Process transactions and send related information
- Manage your account and provide customer support
- Improve our products and services
- Send promotional communications (with your consent)
- Comply with legal obligations

## Contact Us
If you have questions about this Privacy Policy, please contact us at privacy@vendx.space.'),

('terms-of-service', 'Terms of Service', '# Terms of Service

## Acceptance of Terms
By accessing or using VendX services, you agree to be bound by these Terms of Service.

## Use of Services
You may use our services only in compliance with these Terms and all applicable laws. You agree not to misuse our services or help anyone else do so.

## Accounts
You are responsible for safeguarding your account credentials and for any activity on your account. VendX is not liable for any loss arising from unauthorized use of your account.

## Purchases & Payments
All purchases through VendX machines and platforms are subject to our pricing at the time of transaction. We accept various payment methods including VendX Pay, credit/debit cards, and other approved methods.

## Limitation of Liability
VendX shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of our services.

## Contact Us
For questions about these Terms, contact us at legal@vendx.space.'),

('cookie-policy', 'Cookie Policy', '# Cookie Policy

## What Are Cookies
Cookies are small text files stored on your device when you visit our website. They help us provide you with a better experience.

## How We Use Cookies
We use cookies for:
- **Essential Cookies:** Required for the website to function properly, such as authentication and security.
- **Analytics Cookies:** Help us understand how visitors interact with our website.
- **Preference Cookies:** Remember your settings and preferences.

## Managing Cookies
You can control cookies through your browser settings. Note that disabling certain cookies may affect website functionality.

## Contact Us
For questions about our Cookie Policy, contact us at privacy@vendx.space.');
