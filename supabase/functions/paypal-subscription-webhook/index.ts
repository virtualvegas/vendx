import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paypal-transmission-id, paypal-transmission-time, paypal-transmission-sig, paypal-cert-url, paypal-auth-algo",
};

const PAYPAL_API_URL = Deno.env.get("PAYPAL_API_URL") || "https://api-m.paypal.com";

async function paypalToken(): Promise<string> {
  const id = Deno.env.get("PAYPAL_CLIENT_ID")!;
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
  const res = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  return (await res.json()).access_token;
}

async function verifyWebhook(req: Request, body: string): Promise<boolean> {
  const webhookId = Deno.env.get("PAYPAL_SUBSCRIPTION_WEBHOOK_ID");
  if (!webhookId) {
    console.warn("[paypal-sub-webhook] PAYPAL_SUBSCRIPTION_WEBHOOK_ID not set — skipping verification");
    return true;
  }
  const token = await paypalToken();
  const res = await fetch(`${PAYPAL_API_URL}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: req.headers.get("paypal-auth-algo"),
      cert_url: req.headers.get("paypal-cert-url"),
      transmission_id: req.headers.get("paypal-transmission-id"),
      transmission_sig: req.headers.get("paypal-transmission-sig"),
      transmission_time: req.headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
    }),
  });
  const verification = await res.json();
  return verification.verification_status === "SUCCESS";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const body = await req.text();
  const valid = await verifyWebhook(req, body);
  if (!valid) {
    console.error("[paypal-sub-webhook] signature verification failed");
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  let event: any;
  try { event = JSON.parse(body); } catch { return new Response("bad json", { status: 400, headers: corsHeaders }); }

  const eventType: string = event.event_type || "";
  const resource = event.resource || {};
  console.log("[paypal-sub-webhook]", eventType, resource.id);

  // Determine PayPal subscription id from resource
  const paypalSubId: string | undefined =
    resource.id?.startsWith?.("I-") ? resource.id :
    resource.billing_agreement_id || resource.subscription_id || resource.custom?.subscription_id;

  if (!paypalSubId) {
    console.warn("[paypal-sub-webhook] no subscription id resolvable");
    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: sub } = await supabase
    .from("store_subscriptions")
    .select("*")
    .eq("paypal_subscription_id", paypalSubId)
    .maybeSingle();

  if (!sub) {
    console.warn("[paypal-sub-webhook] no local subscription for", paypalSubId);
    return new Response(JSON.stringify({ received: true, unknown: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  let logEventType = eventType.toLowerCase().replace(/^billing\./, "").replace(/^payment\./, "");
  let message = eventType;

  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.RE-ACTIVATED": {
      updates.status = "active";
      updates.pause_collection = false;
      updates.cancel_at_period_end = false;
      if (resource.billing_info?.next_billing_time) updates.current_period_end = resource.billing_info.next_billing_time;
      if (resource.start_time) updates.current_period_start = resource.start_time;
      message = "Subscription activated";
      break;
    }
    case "BILLING.SUBSCRIPTION.UPDATED": {
      if (resource.billing_info?.next_billing_time) updates.current_period_end = resource.billing_info.next_billing_time;
      break;
    }
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED": {
      updates.status = "cancelled";
      updates.canceled_at = new Date().toISOString();
      message = "Subscription cancelled";
      break;
    }
    case "BILLING.SUBSCRIPTION.SUSPENDED": {
      updates.status = "paused";
      updates.pause_collection = true;
      message = "Subscription suspended";
      break;
    }
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
    case "PAYMENT.SALE.DENIED": {
      updates.failed_payment_count = (sub.failed_payment_count || 0) + 1;
      updates.last_payment_failure_at = new Date().toISOString();
      updates.last_payment_failure_reason = resource.status_change_note || resource.reason_code || "payment_failed";
      // Retry in 3 days
      const retry = new Date(); retry.setDate(retry.getDate() + 3);
      updates.next_retry_at = retry.toISOString();
      if (updates.failed_payment_count >= 3) {
        updates.status = "past_due";
      }
      message = `Payment failed (${updates.failed_payment_count}/3)`;
      break;
    }
    case "PAYMENT.SALE.COMPLETED": {
      updates.last_payment_at = new Date().toISOString();
      updates.failed_payment_count = 0;
      updates.last_payment_failure_reason = null;
      updates.next_retry_at = null;
      if (sub.status === "past_due" || sub.status === "pending") updates.status = "active";
      message = "Payment received";
      break;
    }
  }

  await supabase.from("store_subscriptions").update(updates).eq("id", sub.id);
  await supabase.from("store_subscription_events").insert({
    subscription_id: sub.id,
    event_type: logEventType,
    source: "webhook",
    message,
    payload: event,
  });

  return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
