
ALTER TABLE public.vendx_catalog_partners
  ADD COLUMN IF NOT EXISTS checkout_url_template TEXT NULL;

COMMENT ON COLUMN public.vendx_catalog_partners.checkout_url_template IS
  'URL template used to redirect customers to the partner''s hosted checkout. Supported placeholders: {token}, {order_id}, {external_product_id}, {quantity}, {email}, {amount}, {currency}. Example: https://partner.com/checkout?ref={token}&sku={external_product_id}';

ALTER TABLE public.vendx_partner_orders
  ADD COLUMN IF NOT EXISTS checkout_token TEXT NULL,
  ADD COLUMN IF NOT EXISTS checkout_expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS checkout_redirect_url TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendx_partner_orders_checkout_token
  ON public.vendx_partner_orders(checkout_token) WHERE checkout_token IS NOT NULL;
