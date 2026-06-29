
-- Partners
CREATE TABLE public.vendx_catalog_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  contact_email text,
  logo_url text,
  website_url text,
  api_key_hash text NOT NULL UNIQUE,
  api_key_prefix text NOT NULL,
  webhook_secret text NOT NULL,
  inbound_fulfillment_url text,
  allowed_outbound_categories text[] DEFAULT '{}',
  commission_pct numeric(5,2) DEFAULT 0,
  mode text NOT NULL DEFAULT 'both' CHECK (mode IN ('outbound','inbound','both')),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_catalog_partners TO authenticated;
GRANT ALL ON public.vendx_catalog_partners TO service_role;

ALTER TABLE public.vendx_catalog_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage catalog partners" ON public.vendx_catalog_partners
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

CREATE TRIGGER trg_vendx_catalog_partners_updated_at
  BEFORE UPDATE ON public.vendx_catalog_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inbound partner products (displayed on VendX store)
CREATE TABLE public.vendx_partner_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.vendx_catalog_partners(id) ON DELETE CASCADE,
  external_product_id text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  short_description text,
  price numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  image_url text,
  images jsonb DEFAULT '[]'::jsonb,
  category text,
  sku text,
  stock integer,
  is_subscription boolean DEFAULT false,
  subscription_interval text,
  product_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, external_product_id)
);

GRANT SELECT ON public.vendx_partner_products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vendx_partner_products TO authenticated;
GRANT ALL ON public.vendx_partner_products TO service_role;

ALTER TABLE public.vendx_partner_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active partner products" ON public.vendx_partner_products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins manage partner products" ON public.vendx_partner_products
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

CREATE TRIGGER trg_vendx_partner_products_updated_at
  BEFORE UPDATE ON public.vendx_partner_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vendx_partner_products_partner ON public.vendx_partner_products(partner_id);
CREATE INDEX idx_vendx_partner_products_active ON public.vendx_partner_products(is_active);

-- Orders routed via partners (both directions)
CREATE TABLE public.vendx_partner_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.vendx_catalog_partners(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),
  external_order_id text,
  vendx_order_id uuid REFERENCES public.store_orders(id) ON DELETE SET NULL,
  customer_email text,
  customer_name text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(12,2),
  total numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  payment_status text,
  fulfillment_status text,
  commission_amount numeric(12,2) DEFAULT 0,
  payload jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_partner_orders TO authenticated;
GRANT ALL ON public.vendx_partner_orders TO service_role;

ALTER TABLE public.vendx_partner_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage partner orders" ON public.vendx_partner_orders
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

CREATE TRIGGER trg_vendx_partner_orders_updated_at
  BEFORE UPDATE ON public.vendx_partner_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vendx_partner_orders_partner ON public.vendx_partner_orders(partner_id);
CREATE INDEX idx_vendx_partner_orders_vendx ON public.vendx_partner_orders(vendx_order_id);

-- Webhook delivery log for inbound partners
CREATE TABLE public.vendx_partner_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.vendx_catalog_partners(id) ON DELETE CASCADE,
  partner_order_id uuid REFERENCES public.vendx_partner_orders(id) ON DELETE SET NULL,
  event text NOT NULL,
  url text NOT NULL,
  request_body jsonb,
  status_code integer,
  response_body text,
  attempt integer NOT NULL DEFAULT 1,
  delivered boolean NOT NULL DEFAULT false,
  next_retry_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vendx_partner_webhook_deliveries TO authenticated;
GRANT ALL ON public.vendx_partner_webhook_deliveries TO service_role;

ALTER TABLE public.vendx_partner_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view partner webhook deliveries" ON public.vendx_partner_webhook_deliveries
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting'));

-- RPC: create partner + return plain key once
CREATE OR REPLACE FUNCTION public.create_vendx_catalog_partner(
  p_name text,
  p_slug text,
  p_contact_email text DEFAULT NULL,
  p_website_url text DEFAULT NULL,
  p_mode text DEFAULT 'both',
  p_commission_pct numeric DEFAULT 0,
  p_allowed_outbound_categories text[] DEFAULT '{}',
  p_inbound_fulfillment_url text DEFAULT NULL
)
RETURNS TABLE (partner_id uuid, api_key text, webhook_secret text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $$
DECLARE
  v_key text;
  v_secret text;
  v_id uuid;
BEGIN
  IF NOT (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_key := 'vxp_live_' || encode(extensions.gen_random_bytes(24),'hex');
  v_secret := 'vxpwh_' || encode(extensions.gen_random_bytes(24),'hex');

  INSERT INTO public.vendx_catalog_partners (
    name, slug, contact_email, website_url, mode, commission_pct,
    allowed_outbound_categories, inbound_fulfillment_url,
    api_key_hash, api_key_prefix, webhook_secret
  ) VALUES (
    p_name, p_slug, p_contact_email, p_website_url, p_mode, p_commission_pct,
    COALESCE(p_allowed_outbound_categories,'{}'), p_inbound_fulfillment_url,
    public.hash_api_key(v_key), substring(v_key from 1 for 16), v_secret
  ) RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_key, v_secret;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_vendx_catalog_partner_api_key(p_partner_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $$
DECLARE v_key text;
BEGIN
  IF NOT (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'finance_accounting')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  v_key := 'vxp_live_' || encode(extensions.gen_random_bytes(24),'hex');
  UPDATE public.vendx_catalog_partners
  SET api_key_hash = public.hash_api_key(v_key),
      api_key_prefix = substring(v_key from 1 for 16),
      updated_at = now()
  WHERE id = p_partner_id;
  RETURN v_key;
END;
$$;
