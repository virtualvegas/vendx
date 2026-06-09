## Goal
Make `store_products` the single source of truth for the shop. Strip Shopify product/cart/checkout flows from the public store and admin, and round out the admin store system with add-ons, inventory alerts, advanced order tracking, and a smooth customer/business order view. Wire all three checkout methods (Stripe, PayPal, VendX Pay) for regular products.

## 1. Strip Shopify from the public store
- `StorePage.tsx`: remove `useShopifyProducts`, image overlay map, Shopify badge filtering. Show only `store_products`.
- `ProductPage.tsx`: remove `useShopifyProduct`, `shopifyCartStore`, `isShopifyLinked` branch. Always use local `addToCart`.
- `StoreProductCard.tsx`: drop `shopifyImages` prop and "Buy Online"/Shopify badge.
- `CartPage.tsx`: remove Shopify cart drawer/branch if present; route checkout through new edge function selection.
- Delete `ShopifyCartDrawer.tsx`, `ShopifyProductCard.tsx`, `ShopifyProductPage.tsx` page + route, `useShopifyCartSync.tsx`, `shopifyCartStore.ts`, `useShopifyProducts.tsx`.
- Hide Shopify-linking UI in `StoreManager.tsx` add/edit dialog (keep DB columns for now to avoid breaking sync history; just remove from forms and lists).

## 2. Admin shop system polish (`StoreManager.tsx`)
- **Multi-image gallery**: replace single image input with list (add/remove/reorder, drag-handle), saves to `images text[]`.
- **Inventory & low-stock**:
  - Add `low_stock_threshold` column to `store_products` (default 5).
  - Badge "Low Stock" / "Out of Stock" on product rows.
  - New "Inventory" sub-tab: list products sorted by stock asc, inline quick-adjust (+/- N), reason note, writes to a new `store_inventory_adjustments` log table.
  - Dashboard stat card: "Low Stock Items" count.
- **Advanced order tracking**: 
  - Add columns `carrier`, `fulfillment_status`, `customer_notified_at`, plus `store_order_events` table (status, note, actor_id, created_at) for full timeline.
  - In order detail: timeline view, carrier dropdown (UPS/USPS/FedEx/DHL/Other), tracking number+URL, ETA, internal notes, customer-visible note. Saving any status change writes an event.
  - "Notify customer" button (records timestamp; email integration left for later).
- **Add-ons manager**: new sub-tab "Add-ons" — CRUD over `store_product_addons` scoped per product, with name/price/active/required.

## 3. Customer & business order views
- New `CustomerOrders` (extend existing): order list with status pill, tracking link, timeline accordion, contact-support button.
- Business owner dashboard: add "Store Orders" panel listing orders for products they own (if applicable) — read-only with same timeline view; if scope unclear, skip and just show role-gated full list to business_owner role.
- Public order tracking page `/orders/track?email=&order=` (no login) showing status + timeline.

## 4. Checkout (PayPal + VendX Pay + existing Stripe)
- Confirm `store-create-checkout` (Stripe), `store-paypal-checkout`, `store-vendx-pay-checkout` exist and accept the new cart payload (no Shopify variants). Patch where needed.
- `CartPage.tsx`: payment method selector (Stripe / PayPal / VendX Pay wallet) — use existing `PaymentMethodSelector` pattern. Wire each button to its edge function.

## 5. Cleanup
- Remove Shopify nav/Footer hooks if any, Shopify-specific routes from `App.tsx`.
- Leave `shopify-order-webhook` edge function in place (still ingests legacy orders into `store_orders`) but mark admin column "Shopify" badge as legacy.

## Technical notes
- New tables (migration): `store_inventory_adjustments` (product_id, delta, reason, actor_id), `store_order_events` (order_id, status, note, customer_visible bool, actor_id). New columns on `store_products` (`low_stock_threshold`), on `store_orders` (`carrier`, `fulfillment_status`, `customer_notified_at`). All public-schema tables get GRANTs + RLS (authenticated admin writes via has_role; customers read events for their own orders where `customer_visible=true`).
- Image gallery uses simple URL list with up/down buttons (no drag lib).
- Order timeline auto-seeded by a trigger on `store_orders` status changes.

## Out of scope (call out, don't build)
- Customer email notifications (timestamp only).
- Inventory forecasting / reorder suggestions.
- Returns/RMA flow.
