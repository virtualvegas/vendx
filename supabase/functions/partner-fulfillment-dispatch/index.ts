// Internal helper: when a VendX customer buys an inbound partner product,
// call this with the partner_order_id to dispatch the HMAC-signed webhook to
// the partner's inbound_fulfillment_url. Can also be invoked to retry.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, svc, hmacSign } from "../_shared/partner-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = svc();
  const body = await req.json().catch(() => null);
  if (!body?.partner_order_id) return json({ error: "partner_order_id required" }, 400);

  const { data: order, error: oerr } = await supabase
    .from("vendx_partner_orders")
    .select("*")
    .eq("id", body.partner_order_id)
    .maybeSingle();
  if (oerr || !order) return json({ error: "Partner order not found" }, 404);

  const { data: partner } = await supabase
    .from("vendx_catalog_partners")
    .select("*")
    .eq("id", order.partner_id)
    .maybeSingle();
  if (!partner) return json({ error: "Partner not found" }, 404);
  if (!partner.inbound_fulfillment_url) return json({ error: "Partner has no inbound_fulfillment_url" }, 400);

  const payload = {
    event: "order.created",
    partner_order_id: order.id,
    vendx_order_id: order.vendx_order_id,
    external_order_id: order.external_order_id,
    customer_email: order.customer_email,
    customer_name: order.customer_name,
    items: order.items,
    total: order.total,
    currency: order.currency,
    created_at: order.created_at,
  };
  const payloadStr = JSON.stringify(payload);
  const signature = await hmacSign(partner.webhook_secret, payloadStr);

  const { count } = await supabase
    .from("vendx_partner_webhook_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("partner_order_id", order.id);
  const attempt = (count ?? 0) + 1;

  let status = 0;
  let respBody = "";
  let err: string | null = null;
  try {
    const resp = await fetch(partner.inbound_fulfillment_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VendX-Signature": signature,
        "X-VendX-Event": "order.created",
      },
      body: payloadStr,
    });
    status = resp.status;
    respBody = (await resp.text()).slice(0, 4000);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  const delivered = status >= 200 && status < 300;

  await supabase.from("vendx_partner_webhook_deliveries").insert({
    partner_id: partner.id,
    partner_order_id: order.id,
    event: "order.created",
    url: partner.inbound_fulfillment_url,
    request_body: payload,
    status_code: status || null,
    response_body: respBody,
    attempt,
    delivered,
    error_message: err,
    next_retry_at: delivered ? null : new Date(Date.now() + Math.min(attempt * 60_000, 24 * 60 * 60_000)).toISOString(),
  });

  await supabase
    .from("vendx_partner_orders")
    .update({ fulfillment_status: delivered ? "dispatched" : "dispatch_failed" })
    .eq("id", order.id);

  return json({ ok: delivered, status, attempt });
});
