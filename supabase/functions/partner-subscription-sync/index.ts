// POST/PUT — partner reports a subscription lifecycle event.
// Use direction="outbound" when partner sold one of OUR subscriptions on their site.
// Use direction="inbound" to register a partner-owned subscription billed by them but
// listed on VendX (rare; usually inbound subs are billed by us and we dispatch events
// to the partner via partner-fulfillment-dispatch).
//
// Body:
// {
//   external_subscription_id: string (required, partner's id),
//   event: "created" | "renewed" | "cancelled" | "paused" | "resumed" | "payment_failed" | "payment_succeeded",
//   direction?: "outbound" | "inbound",          // default "outbound"
//   external_product_id?: string,                // partner product id (inbound)
//   product_ref?: string,                        // VendX product id or slug (outbound)
//   customer_email?: string,
//   customer_name?: string,
//   price?: number,
//   currency?: string,
//   interval?: "month" | "year" | string,
//   status?: "active" | "paused" | "cancelled" | "past_due",
//   started_at?: string,
//   current_period_end?: string,
//   metadata?: object
// }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, authPartner } from "../_shared/partner-auth.ts";

const EVENTS = new Set([
  "created", "renewed", "updated",
  "cancelled", "paused", "resumed",
  "payment_failed", "payment_succeeded",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "PUT") return json({ error: "Method not allowed" }, 405);

  const auth = await authPartner(req);
  if (auth.error) return auth.error;
  const { partner, supabase } = auth;

  const body = await req.json().catch(() => null);
  if (!body?.external_subscription_id) return json({ error: "external_subscription_id required" }, 400);
  if (!body?.event || !EVENTS.has(body.event)) {
    return json({ error: `event must be one of ${[...EVENTS].join(", ")}` }, 400);
  }

  const direction = body.direction === "inbound" ? "inbound" : "outbound";
  if (direction === "outbound" && partner.mode === "inbound") {
    return json({ error: "This partner is inbound-only" }, 403);
  }
  if (direction === "inbound" && partner.mode === "outbound") {
    return json({ error: "This partner is outbound-only" }, 403);
  }

  // Existing record?
  const { data: existing } = await supabase
    .from("vendx_partner_subscriptions")
    .select("*")
    .eq("partner_id", partner.id)
    .eq("external_subscription_id", String(body.external_subscription_id))
    .maybeSingle();

  // Derive new status from event when status not explicitly provided
  let derivedStatus = body.status as string | undefined;
  if (!derivedStatus) {
    switch (body.event) {
      case "created":
      case "renewed":
      case "resumed":
      case "payment_succeeded": derivedStatus = "active"; break;
      case "paused": derivedStatus = "paused"; break;
      case "cancelled": derivedStatus = "cancelled"; break;
      case "payment_failed": derivedStatus = "past_due"; break;
    }
  }

  const nowIso = new Date().toISOString();
  const row = {
    partner_id: partner.id,
    direction,
    external_subscription_id: String(body.external_subscription_id),
    external_product_id: body.external_product_id ?? existing?.external_product_id ?? null,
    product_ref: body.product_ref ?? existing?.product_ref ?? null,
    customer_email: body.customer_email ?? existing?.customer_email ?? null,
    customer_name: body.customer_name ?? existing?.customer_name ?? null,
    price: body.price ?? existing?.price ?? null,
    currency: body.currency ?? existing?.currency ?? "USD",
    interval: body.interval ?? existing?.interval ?? null,
    status: derivedStatus ?? existing?.status ?? "active",
    started_at: body.started_at ?? existing?.started_at ?? (body.event === "created" ? nowIso : null),
    current_period_end: body.current_period_end ?? existing?.current_period_end ?? null,
    cancelled_at: body.event === "cancelled" ? nowIso : (existing?.cancelled_at ?? null),
    last_payment_at: body.event === "payment_succeeded" || body.event === "renewed" ? nowIso : (existing?.last_payment_at ?? null),
    failed_payment_count: body.event === "payment_failed"
      ? (existing?.failed_payment_count ?? 0) + 1
      : (body.event === "payment_succeeded" ? 0 : (existing?.failed_payment_count ?? 0)),
    last_event: body.event,
    metadata: body.metadata ?? existing?.metadata ?? {},
    payload: body,
  };

  const { data: sub, error: serr } = await supabase
    .from("vendx_partner_subscriptions")
    .upsert(row, { onConflict: "partner_id,external_subscription_id" })
    .select()
    .single();
  if (serr) return json({ error: serr.message }, 500);

  // Finance side-effects for outbound subs we earn revenue on
  if (direction === "outbound" && (body.event === "created" || body.event === "renewed" || body.event === "payment_succeeded")) {
    const amount = Number(body.price ?? sub.price ?? 0);
    if (amount > 0) {
      const commission = Number(((amount * (partner.commission_pct || 0)) / 100).toFixed(2));
      try {
        await supabase.from("finance_income").insert({
          income_date: nowIso.slice(0, 10),
          source: `Partner: ${partner.name}`,
          category: "subscription",
          description: `Partner subscription ${body.event} (${body.external_subscription_id})`,
          amount,
          reference_type: "partner_subscription",
          reference_id: sub.id,
          external_reference: String(body.external_subscription_id),
          payment_method: `partner:${partner.slug}`,
        });
        if (commission > 0) {
          await supabase.from("finance_expenses").insert({
            expense_date: nowIso.slice(0, 10),
            vendor: partner.name,
            category: "commission",
            description: `Subscription commission ${body.external_subscription_id}`,
            amount: commission,
            external_reference: `commission-sub-${sub.id}`,
            status: "recorded",
          });
        }
      } catch (e) { console.error("finance log:", e); }
    }
  }

  return json({ ok: true, subscription: sub });
});
