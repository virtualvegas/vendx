// Public — initiates a partner-hosted checkout for an inbound partner product.
// Creates a pending vendx_partner_orders row + a one-time checkout_token, builds the partner's
// hosted checkout URL by interpolating their `checkout_url_template`, and returns the redirect URL.
// The partner completes payment, then calls partner-order-create with the same token (or with
// the order id we returned) to confirm — VendX flips the order to paid and runs fulfillment.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, svc } from "../_shared/partner-auth.ts";

function interpolate(tpl: string, vars: Record<string, string | number | undefined>) {
  return tpl.replace(/\{(\w+)\}/g, (_m, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : encodeURIComponent(String(v));
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const { partner_product_id, quantity = 1, customer_email, customer_name, notes, return_url } = body;
  if (!partner_product_id) return json({ error: "partner_product_id required" }, 400);
  if (!customer_email) return json({ error: "customer_email required" }, 400);

  const supabase = svc();

  const { data: product, error: pErr } = await supabase
    .from("vendx_partner_products")
    .select("*, vendx_catalog_partners(id, name, slug, mode, checkout_url_template, website_url)")
    .eq("id", partner_product_id)
    .eq("is_active", true)
    .maybeSingle();
  if (pErr || !product) return json({ error: "Product not found" }, 404);

  const partner = (product as any).vendx_catalog_partners;
  if (!partner) return json({ error: "Partner not configured" }, 400);
  if (partner.mode === "outbound") return json({ error: "Partner is outbound-only" }, 400);
  if (!partner.checkout_url_template) {
    return json({ error: "Partner has no checkout_url_template configured" }, 400);
  }

  const qty = Math.max(1, Math.min(Number(quantity) || 1, 999));
  const unitPrice = Number(product.price);
  const total = Number((unitPrice * qty).toFixed(2));
  const currency = product.currency || "USD";

  // Generate a high-entropy token
  const tokenBytes = new Uint8Array(24);
  crypto.getRandomValues(tokenBytes);
  const token = "vxct_" + Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const expires = new Date(Date.now() + 60 * 60_000).toISOString(); // 60 minutes

  const { data: order, error: oErr } = await supabase
    .from("vendx_partner_orders")
    .insert({
      partner_id: partner.id,
      direction: "inbound",
      customer_email,
      customer_name: customer_name ?? null,
      items: [{
        external_product_id: product.external_product_id,
        partner_product_id: product.id,
        name: product.name,
        quantity: qty,
        unit_price: unitPrice,
      }],
      subtotal: total,
      total,
      currency,
      status: "awaiting_payment",
      payment_status: "pending",
      checkout_token: token,
      checkout_expires_at: expires,
      payload: { notes: notes ?? null, return_url: return_url ?? null },
    })
    .select()
    .single();
  if (oErr) return json({ error: `Order create failed: ${oErr.message}` }, 500);

  const redirectUrl = interpolate(partner.checkout_url_template, {
    token,
    order_id: order.id,
    external_product_id: product.external_product_id,
    quantity: qty,
    email: customer_email,
    amount: total,
    currency,
    return_url: return_url || "",
  });

  await supabase
    .from("vendx_partner_orders")
    .update({ checkout_redirect_url: redirectUrl })
    .eq("id", order.id);

  return json({
    ok: true,
    partner_order_id: order.id,
    checkout_token: token,
    expires_at: expires,
    redirect_url: redirectUrl,
    partner: { id: partner.id, name: partner.name },
  });
});
