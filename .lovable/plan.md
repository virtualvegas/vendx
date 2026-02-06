
# Shopify Headless Integration Plan for VendX Store

## Overview
This plan integrates Shopify as a headless product catalog and checkout system while preserving VendX's existing account system, order history, VendX Pay wallet integration, and rewards points functionality.

## Architecture Summary

```text
+------------------+     +-------------------+     +------------------+
|   VendX Frontend |---->|  Shopify Storefront|---->|  Shopify Checkout|
|   (React/Vite)   |     |  API (Products)   |     |  (Hosted)        |
+------------------+     +-------------------+     +------------------+
         |                                                    |
         v                                                    v
+------------------+                              +------------------+
|  Lovable Cloud   |<-----------------------------|  Shopify Webhook |
|  (Supabase)      |  (Order Sync Edge Function)  |  (order.created) |
|  - Wallets       |                              +------------------+
|  - Orders        |
|  - Rewards       |
|  - Auth          |
+------------------+
```

---

## Phase 1: Shopify Store Connection

### Prerequisites
To connect your existing Shopify store, you need to:
1. Go to your Shopify Admin -> Settings -> Users and permissions
2. Either:
   - Change the store owner email to match your Lovable account (`nate.northeast.amusements@gmail.com`), OR
   - Log into Lovable with the `info@vendx.space` account

### After Email Match
Once emails match, I'll:
1. Enable Shopify integration via the Lovable connector
2. Obtain Storefront API access token for product fetching
3. Configure webhook endpoints for order synchronization

---

## Phase 2: Edge Function - Shopify Product Fetcher

### New Function: `shopify-products`
Create an edge function to fetch products from Shopify's Storefront API:

```text
Purpose: Proxy requests to Shopify Storefront GraphQL API
Features:
- Fetch all products with variants, images, pricing
- Category/collection filtering
- Search functionality
- Price formatting and inventory status
```

This replaces direct `store_products` table queries with Shopify API calls.

---

## Phase 3: Edge Function - Shopify Checkout Creator

### New Function: `shopify-create-checkout`
Handles checkout creation with VendX Pay integration:

```text
Flow:
1. Receive cart items from frontend
2. Check VendX Pay wallet balance (if selected)
3. Reserve wallet funds in "pending" status
4. Create Shopify checkout with line items
5. Apply discount code for wallet credit (if applicable)
6. Return Shopify checkout URL with metadata
```

Key consideration: Shopify doesn't natively support external wallet credits, so we'll:
- Apply wallet credit as a discount code (created dynamically), OR
- Reduce the cart total server-side and track the difference

---

## Phase 4: Edge Function - Shopify Order Webhook

### New Function: `shopify-order-webhook`
Receives Shopify webhooks when orders complete:

```text
Webhook Events to Handle:
- orders/create: Sync order to store_orders table
- orders/paid: Confirm payment, finalize wallet transaction
- orders/cancelled: Refund wallet credit if applicable

Data Sync:
- Map Shopify order to VendX store_orders schema
- Create store_order_items from line items
- Award VendX reward points (10 pts per dollar)
- Clear user's local cart
```

---

## Phase 5: Frontend Updates

### StorePage.tsx Changes
- Replace `supabase.from("store_products")` queries with `shopify-products` edge function calls
- Map Shopify product data to existing component interfaces
- Preserve existing UI, filtering, sorting, and view modes

### ProductPage.tsx Changes
- Fetch individual product from Shopify by handle/ID
- Map variants to addon-like UI for size/color selection
- Keep existing SEO hooks and cart functionality

### useCart.tsx Changes
- Store cart locally (localStorage) or continue using `store_carts` table
- When checking out, send cart to `shopify-create-checkout` function
- Receive Shopify checkout URL and redirect user

### CartPage.tsx Changes
- Preserve VendX Pay payment method selection
- Pass wallet credit preference to checkout function
- Handle Shopify checkout redirect

---

## Phase 6: Products Manager Dashboard

### Two Options for Admin:
1. **Shopify-Only Management**: Remove Products Manager tab; all products managed in Shopify Admin
2. **Hybrid Display**: Keep Products Manager as read-only view synced from Shopify

Recommended: Option 1 (Shopify-Only) since Shopify provides robust product management with variants, inventory, and images.

---

## Phase 7: Order & Account Integration

### Order Sync Strategy
- Shopify webhook writes to `store_orders` and `store_order_items`
- Add `shopify_order_id` column to `store_orders` for linking
- CustomerOrders dashboard continues reading from local tables (no changes needed)

### Rewards Integration
- Webhook calculates points: `Math.floor(orderTotal * 10)`
- Awards to `rewards_points` table
- Creates `point_transactions` record

### VendX Pay Wallet
- Wallet credit handled via Shopify discount codes OR pre-deducted totals
- Pending transactions confirmed/refunded based on order status

---

## Database Migrations Required

```sql
-- Add Shopify tracking columns
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS shopify_order_id TEXT;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS shopify_order_number TEXT;

-- Index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_store_orders_shopify_id ON store_orders(shopify_order_id);
```

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `supabase/functions/shopify-products/index.ts` | Fetch products from Shopify Storefront API |
| `supabase/functions/shopify-create-checkout/index.ts` | Create Shopify checkout with VendX Pay support |
| `supabase/functions/shopify-order-webhook/index.ts` | Sync completed orders to VendX database |
| `src/hooks/useShopifyProducts.tsx` | React Query hook for Shopify product data |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/StorePage.tsx` | Use Shopify products hook instead of direct Supabase queries |
| `src/pages/ProductPage.tsx` | Fetch from Shopify, handle variants |
| `src/pages/CartPage.tsx` | Redirect to Shopify checkout |
| `src/hooks/useCart.tsx` | Adapt cart for Shopify checkout flow |
| `src/components/dashboard/tabs/ProductsManager.tsx` | Either remove or make read-only |

---

## Secrets Required
- `SHOPIFY_STOREFRONT_ACCESS_TOKEN` - For product API access
- `SHOPIFY_ADMIN_ACCESS_TOKEN` - For discount code creation (wallet credits)
- `SHOPIFY_WEBHOOK_SECRET` - For webhook signature verification

---

## What Stays the Same
- User authentication (Lovable Cloud/Supabase)
- VendX Pay wallet system
- Reward points system
- Order history in customer dashboard
- All non-store pages and features

## What Changes
- Product data source: Supabase -> Shopify
- Checkout flow: Stripe/PayPal direct -> Shopify Checkout
- Product management: Dashboard tab -> Shopify Admin

---

## Next Steps
1. **Resolve email mismatch** between Shopify store and Lovable account
2. **Enable Shopify integration** via Lovable connector
3. **Implement edge functions** in order listed
4. **Update frontend components** to use new hooks
5. **Test end-to-end** checkout flow with VendX Pay
