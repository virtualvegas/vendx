# External Products API System

A bidirectional product/service/subscription API that lets partner sites:
1. **Pull** VendX catalog items and sell them on their site, forwarding orders + payment confirmation to VendX.
2. **Push** their own products to VendX so customers can buy them on vendx.space, with orders forwarded back to the partner's order system for fulfillment.

## Concept

Each partner = a **Catalog Partner** with an API key + webhook secret (similar to `vendx_merchants`). Two relationship modes:

- **Outbound (VendX → Partner)**: Partner pulls our products via REST, displays on their site, processes payment on their side, then notifies us via webhook so we record the order, ship/fulfill, and pay them a configured commission.
- **Inbound (Partner → VendX)**: Partner pushes products to us via REST. We display them in the VendX store flagged as "Fulfilled by {Partner}". When a customer buys, we collect payment and POST the order to the partner's fulfillment webhook.

## Database (all prefixed `vendx_`)

1. `vendx_catalog_partners`
   - name, slug, contact_email, logo_url, website_url
   - api_key_hash, api_key_prefix, webhook_secret
   - inbound_fulfillment_url (partner's endpoint we POST orders to)
   - allowed_outbound_categories (text[]), commission_pct
   - is_active, mode (`outbound`, `inbound`, `both`)

2. `vendx_partner_products` (inbound — partner-owned items displayed on VendX)
   - partner_id, external_product_id, name, slug, description
   - price, currency, image_url, category, sku, stock, is_subscription, interval
   - metadata jsonb, is_active, last_synced_at

3. `vendx_partner_orders` (audit + routing trail for both directions)
   - partner_id, direction (`outbound`/`inbound`), external_order_id, vendx_order_id
   - customer_email, customer_name, items jsonb, total, currency
   - status, payment_status, fulfillment_status
   - commission_amount, payload jsonb, error_message

4. `vendx_partner_webhook_deliveries` (delivery log w/ retry support)
   - partner_id, event, url, status_code, response_body, attempt, next_retry_at

RLS: super_admin + finance_accounting full access; partners authenticate via API key, not via JWT.

## Edge Functions (public, signature-validated)

1. `partner-catalog-list` — GET — returns VendX products/services/subscriptions filtered by partner's allowed categories (paginated).
2. `partner-catalog-product` — GET — single product detail.
3. `partner-order-create` — POST — partner posts a completed order (with their payment confirmation). Creates a `store_orders` row + `vendx_partner_orders` audit row + finance income entry.
4. `partner-product-push` — POST — partner uploads/updates a product into `vendx_partner_products` (upsert by external_product_id).
5. `partner-product-delete` — DELETE — removes a partner product.
6. `partner-order-status` — GET — partner queries the status of a forwarded order (inbound flow).
7. `partner-fulfillment-webhook` (internal helper) — when a VendX customer buys an inbound partner product, POST to partner's `inbound_fulfillment_url` with HMAC signature; record delivery + auto-retry on failure.

All endpoints use `X-VendX-Partner-Key` header. Webhook payloads to partner are HMAC-SHA256 signed with their `webhook_secret` (header `X-VendX-Signature`).

## Frontend

### Admin (new dashboard tab "Partner API" under Integrations)
- Partners CRUD + key rotation
- Per-partner allowed categories, commission %, fulfillment URL
- Live view of inbound products, outbound orders, webhook delivery log w/ "Redeliver" button
- Stats: total partner revenue, commissions owed, top partners

### Store integration
- `StoreProductCard` shows a small "via {partner}" badge when item is from `vendx_partner_products`.
- Checkout: when an inbound partner product is purchased, payment goes through normal VendX checkout, then on success we trigger `partner-fulfillment-webhook` to notify the partner.

### Public Documentation page (`/api/partners`)
- Overview, auth, signature verification recipe (with code samples in JS/curl)
- Endpoint reference for all 7 endpoints with request/response examples
- Webhook event reference (`order.created`, `order.cancelled`, `product.updated`)
- Sandbox section explaining test keys (prefix `vxp_test_`)

## Technical notes
- API keys: `vxp_live_` / `vxp_test_` prefix, stored hashed via existing `hash_api_key()` RPC.
- Reuse `create_vendx_merchant` pattern with a new `create_vendx_catalog_partner()` RPC that returns the plain key once.
- Inbound products appear in `/store` alongside native products via a union query in `StorePage`.
- Finance: outbound orders create `finance_income` (gross) + `finance_expenses` (commission paid).

## Out of scope for v1
- Partner-side OAuth (key auth only)
- Partner-facing dashboard UI (they integrate via API only; docs page is enough)
- Multi-currency conversion (store currency as-is)
