// Partner posts a completed order (paid on their site) — we record it and pay commission.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, authPartner } from "../_shared/partner-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await authPartner(req);
  if (auth.error) return auth.error;
  const { partner, supabase } = auth;

  if (partner.mode === "inbound") {
    return json({ error: "This partner is inbound-only" }, 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const {
    external_order_id,
    customer_email,
    customer_name,
    items = [],
    subtotal,
    total,
    currency = "USD",
    payment_status = "paid",
    payment_reference,
    shipping_address,
    notes,
  } = body;

  if (!external_order_id) return json({ error: "external_order_id is required" }, 400);
  if (!Array.isArray(items) || items.length === 0) return json({ error: "items must be a non-empty array" }, 400);
  if (typeof total !== "number" || total <= 0) return json({ error: "total must be a positive number" }, 400);

  // Idempotency: dedupe by (partner, external_order_id)
  const { data: existing } = await supabase
    .from("vendx_partner_orders")
    .select("id, vendx_order_id, status")
    .eq("partner_id", partner.id)
    .eq("external_order_id", external_order_id)
    .maybeSingle();

  if (existing) {
    return json({ ok: true, duplicate: true, partner_order_id: existing.id, vendx_order_id: existing.vendx_order_id });
  }

  // Create a store_orders row for fulfillment tracking
  const { data: order, error: orderErr } = await supabase
    .from("store_orders")
    .insert({
      customer_email,
      customer_name,
      subtotal: subtotal ?? total,
      total,
      status: "paid",
      payment_method: `partner:${partner.slug}`,
      payment_reference,
      shipping_address: shipping_address ?? null,
      notes: notes ? `[Partner ${partner.name}] ${notes}` : `[Partner ${partner.name}] External order ${external_order_id}`,
    })
    .select()
    .single();
  if (orderErr) return json({ error: `Order create failed: ${orderErr.message}` }, 500);

  // Insert line items
  for (const it of items) {
    await supabase.from("store_order_items").insert({
      order_id: order.id,
      product_id: it.product_id ?? null,
      product_name: it.name ?? it.product_name ?? "Item",
      quantity: it.quantity ?? 1,
      unit_price: it.unit_price ?? it.price ?? 0,
      total_price: (it.unit_price ?? it.price ?? 0) * (it.quantity ?? 1),
    });
  }

  const commission = Number(((total * (partner.commission_pct || 0)) / 100).toFixed(2));

  const { data: partnerOrder, error: poErr } = await supabase
    .from("vendx_partner_orders")
    .insert({
      partner_id: partner.id,
      direction: "outbound",
      external_order_id,
      vendx_order_id: order.id,
      customer_email,
      customer_name,
      items,
      subtotal: subtotal ?? total,
      total,
      currency,
      status: "received",
      payment_status,
      commission_amount: commission,
      payload: body,
    })
    .select()
    .single();
  if (poErr) return json({ error: `Partner order log failed: ${poErr.message}` }, 500);

  // Record finance income (gross) — quietly skip if it fails
  try {
    await supabase.from("finance_income").insert({
      income_date: new Date().toISOString().slice(0, 10),
      source: `Partner: ${partner.name}`,
      category: "store_sales",
      description: `External order ${external_order_id}`,
      amount: total,
      reference_type: "partner_order",
      reference_id: partnerOrder.id,
      external_reference: external_order_id,
      payment_method: `partner:${partner.slug}`,
    });
    if (commission > 0) {
      await supabase.from("finance_expenses").insert({
        expense_date: new Date().toISOString().slice(0, 10),
        vendor: partner.name,
        category: "commission",
        description: `Commission for partner order ${external_order_id}`,
        amount: commission,
        external_reference: `commission-${partnerOrder.id}`,
        status: "recorded",
      });
    }
  } catch (e) {
    console.error("finance log:", e);
  }

  return json({
    ok: true,
    partner_order_id: partnerOrder.id,
    vendx_order_id: order.id,
    order_number: order.order_number,
    commission_amount: commission,
  });
});
