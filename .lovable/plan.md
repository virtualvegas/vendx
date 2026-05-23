## VendX Wallet Pay — External Merchant Integration

Build a PayPal-style payment system that lets your other sites (Emos R Us, Host Heroz, future partners) accept payments directly from a customer's VendX wallet, with a secure callback on success.

---

### How it will work (customer flow)

1. Customer checks out on `emosrus.com` and picks **"Pay with VendX Wallet"**.
2. Merchant site calls our API to create a **payment session**, then redirects the customer to:
   `https://vendx.space/pay/checkout/{session_token}`
3. Customer signs in to VendX (if not already), sees order summary + merchant name + amount, and confirms.
4. We debit their wallet, mark the session `paid`, and:
   - **Redirect** the customer to the merchant's `return_url`
   - **POST a signed webhook** to the merchant's `webhook_url` (PayPal-style IPN)
5. If the customer cancels or the session expires (15 min), we redirect to `cancel_url`.

---

### What gets built

**1. Database (tables, all `vendx_` prefixed)**
- `vendx_merchants` — registered partner sites: `id`, `name`, `slug`, `api_key_hash`, `api_key_prefix`, `webhook_secret`, `allowed_return_domains[]`, `logo_url`, `is_active`, `fee_percent` (default 0)
- `vendx_merchant_payment_sessions` — one row per checkout attempt: `id`, `merchant_id`, `session_token` (public), `amount`, `currency`, `order_reference` (merchant's order ID), `description`, `customer_email`, `return_url`, `cancel_url`, `webhook_url`, `status` (`pending|paid|cancelled|expired|failed`), `user_id` (filled on pay), `wallet_transaction_id`, `expires_at`, `paid_at`, `metadata`
- `vendx_merchant_webhook_deliveries` — every webhook attempt: `session_id`, `attempt`, `status_code`, `response_body`, `delivered_at`, `next_retry_at`
- RLS: merchants table admin-only; sessions readable by the paying user; deliveries admin-only.

**2. Edge functions**
- `merchant-create-session` (auth: merchant API key in `X-VendX-Api-Key` header) — validates merchant + amount + return domain, creates session, returns `{ session_token, checkout_url, expires_at }`.
- `merchant-get-session` (public, by token) — returns session details for the checkout page.
- `merchant-pay-session` (auth: customer JWT) — debits the wallet, marks session paid, fires webhook, returns redirect URL.
- `merchant-webhook-deliver` (internal) — signs payload with HMAC-SHA256 using merchant's `webhook_secret`, headers: `X-VendX-Signature`, `X-VendX-Timestamp`. Retries with backoff (1m, 5m, 30m, 2h, 12h) on non-2xx.
- `merchant-cancel-session` (public, by token) — marks session cancelled, redirects to `cancel_url`.

**3. Cron**
- Expire stale `pending` sessions (every 5 min).
- Retry failed webhook deliveries (every 5 min).

**4. Customer checkout page**
- New route `/pay/checkout/:token` — shows merchant logo, order ref, description, amount, wallet balance, and **Confirm Payment** button. Requires sign-in (redirects to `/auth?redirect=/pay/checkout/:token`).
- Insufficient balance → inline "Add funds" link to wallet load dialog.
- Success → redirect to merchant `return_url?vendx_session={token}&status=paid`.

**5. Admin dashboard tab**
- New `/dashboard` tab **"Merchant API"** (super admin + finance roles):
  - List/create merchants, view + rotate API key, view + rotate webhook secret, edit allowed return domains.
  - Recent sessions table with status filter.
  - Webhook delivery log with manual retry button.

**6. Integration docs page**
- Public `/docs/wallet-pay` page with code samples:
  - `POST /functions/v1/merchant-create-session` request/response
  - Webhook payload shape + HMAC signature verification example (Node + PHP)
  - Test mode notes

---

### Webhook payload (sent to merchant `webhook_url`)
```json
{
  "event": "payment.completed",
  "session_token": "vxs_...",
  "order_reference": "MERCHANT-ORDER-123",
  "amount": 49.99,
  "currency": "USD",
  "paid_at": "2026-05-23T...",
  "customer_email": "user@example.com",
  "metadata": { ... }
}
```
Signed with: `HMAC-SHA256(webhook_secret, timestamp + "." + body)` → `X-VendX-Signature: t={ts},v1={sig}`

---

### What you'll get to give your other sites
Per merchant: an **API key** (`vxm_live_...`) + **webhook secret** (`whsec_...`) + the **checkout base URL**. Drop-in JS snippet and PHP/Node webhook verifier included in the docs page.

---

### Out of scope (ask if you want these later)
- Refund API endpoint (can add — would call existing wallet refund logic).
- Customer-saved merchants / one-click pay.
- Subscriptions/recurring billing through wallet (wallet is one-time only today).
- Currency conversion (USD only for now).

Approve and I'll build it end-to-end.