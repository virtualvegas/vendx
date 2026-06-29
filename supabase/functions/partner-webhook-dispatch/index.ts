// Internal helper: dispatch an HMAC-signed webhook to a partner's inbound_fulfillment_url
// for any event type — order.created, order.cancelled, subscription.created, subscription.renewed,
// subscription.cancelled, subscription.payment_failed, subscription.payment_succeeded, product.updated.
//
// Body: { partner_id: string, event: string, payload: object, partner_order_id?, partner_subscription_id? }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, svc, hmacSign } from "../_shared/partner-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = svc();
  const body = await req.json().catch(() => null);
  if (!body?.partner_id || !body?.event || !body?.payload) {
    return json({ error: "partner_id, event and payload required" }, 400);
  }

  const { data: partner } = await supabase
    .from("vendx_catalog_partners")
    .select("*")
    .eq("id", body.partner_id)
    .maybeSingle();
  if (!partner) return json({ error: "Partner not found" }, 404);
  if (!partner.inbound_fulfillment_url) return json({ error: "Partner has no inbound_fulfillment_url" }, 400);

  const payload = { event: body.event, ...body.payload, sent_at: new Date().toISOString() };
  const payloadStr = JSON.stringify(payload);
  const signature = await hmacSign(partner.webhook_secret, payloadStr);

  const refColumn = body.partner_subscription_id ? "partner_subscription_id" : "partner_order_id";
  const refId = body.partner_subscription_id ?? body.partner_order_id ?? null;
  let attempt = 1;
  if (refId) {
    const { count } = await supabase
      .from("vendx_partner_webhook_deliveries")
      .select("id", { count: "exact", head: true })
      .eq(refColumn, refId)
      .eq("event", body.event);
    attempt = (count ?? 0) + 1;
  }

  let status = 0;
  let respBody = "";
  let err: string | null = null;
  try {
    const resp = await fetch(partner.inbound_fulfillment_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VendX-Signature": signature,
        "X-VendX-Event": body.event,
      },
      body: payloadStr,
    });
    status = resp.status;
    respBody = (await resp.text()).slice(0, 4000);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  const delivered = status >= 200 && status < 300;

  const row: Record<string, unknown> = {
    partner_id: partner.id,
    event: body.event,
    url: partner.inbound_fulfillment_url,
    request_body: payload,
    status_code: status || null,
    response_body: respBody,
    attempt,
    delivered,
    error_message: err,
    next_retry_at: delivered ? null : new Date(Date.now() + Math.min(attempt * 60_000, 24 * 60 * 60_000)).toISOString(),
  };
  if (body.partner_order_id) row.partner_order_id = body.partner_order_id;
  if (body.partner_subscription_id) row.partner_subscription_id = body.partner_subscription_id;
  await supabase.from("vendx_partner_webhook_deliveries").insert(row).then(({ error }) => {
    if (error) console.error("delivery log:", error.message);
  });

  return json({ ok: delivered, status, attempt });
});
