// Cron: retries past_due subscriptions for both Stripe and PayPal, escalates after N failures,
// and sends dunning email notifications. Invoke with no body; uses service role.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYPAL_API_URL = Deno.env.get("PAYPAL_API_URL") || "https://api-m.paypal.com";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("DUNNING_FROM_EMAIL") || "billing@vendx.space";
const MAX_FAILURES = Number(Deno.env.get("SUBSCRIPTION_MAX_FAILURES") || "4");
// Exponential backoff schedule in hours per attempt index
const RETRY_BACKOFF_HOURS = [24, 72, 120, 168];

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

async function paypalCapture(subId: string, amount: string, note: string) {
  const token = await paypalToken();
  const res = await fetch(`${PAYPAL_API_URL}/v1/billing/subscriptions/${subId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      note: note.substring(0, 127),
      capture_type: "OUTSTANDING_BALANCE",
      amount: { currency_code: "USD", value: amount },
    }),
  });
  if (!res.ok) throw new Error(`PayPal capture failed: ${await res.text()}`);
}

async function paypalCancel(subId: string, reason: string) {
  const token = await paypalToken();
  await fetch(`${PAYPAL_API_URL}/v1/billing/subscriptions/${subId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reason: reason.substring(0, 127) }),
  });
}

async function sendDunningEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
  } catch (e) {
    console.error("[dunning email failed]", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2024-06-20" });
  const nowIso = new Date().toISOString();

  // Find past_due subscriptions whose next_retry_at is due (or null = first run)
  const { data: subs, error } = await supabase
    .from("store_subscriptions")
    .select("id, user_id, provider, status, stripe_subscription_id, paypal_subscription_id, failed_payment_count, next_retry_at, product_id")
    .eq("status", "past_due")
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let retried = 0, cancelled = 0, succeededLogs = 0;

  for (const sub of subs || []) {
    const attempt = Number(sub.failed_payment_count || 0);
    const updates: Record<string, any> = { updated_at: nowIso };
    let eventType = "retry_attempted";
    let message = "";
    let success = false;
    let errMsg = "";

    try {
      if (sub.provider === "stripe" && sub.stripe_subscription_id) {
        const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, { expand: ["latest_invoice"] });
        const invoice = subscription.latest_invoice as any;
        if (invoice?.id && invoice.status === "open") {
          const paid = await stripe.invoices.pay(invoice.id);
          if (paid.status === "paid") success = true;
        } else if (subscription.status === "active") {
          success = true;
        }
      } else if (sub.provider === "paypal" && sub.paypal_subscription_id) {
        const { data: prod } = await supabase.from("store_products").select("subscription_price, price").eq("id", sub.product_id).maybeSingle();
        const amount = Number(prod?.subscription_price || prod?.price || 0).toFixed(2);
        await paypalCapture(sub.paypal_subscription_id, amount, `Auto retry #${attempt + 1}`);
        success = true;
      }
    } catch (e) {
      errMsg = e instanceof Error ? e.message : String(e);
    }

    retried++;

    if (success) {
      updates.status = "active";
      updates.failed_payment_count = 0;
      updates.next_retry_at = null;
      updates.last_payment_failure_reason = null;
      eventType = "retry_succeeded";
      message = "Automatic retry succeeded; subscription reactivated.";
      succeededLogs++;
    } else {
      const newCount = attempt + 1;
      updates.failed_payment_count = newCount;
      updates.last_payment_failure_reason = errMsg || "Retry failed";

      if (newCount >= MAX_FAILURES) {
        // Give up: cancel
        try {
          if (sub.provider === "stripe" && sub.stripe_subscription_id) {
            await stripe.subscriptions.cancel(sub.stripe_subscription_id);
          } else if (sub.provider === "paypal" && sub.paypal_subscription_id) {
            await paypalCancel(sub.paypal_subscription_id, "Max retry attempts reached");
          }
        } catch (e) {
          console.error("[auto-cancel failed]", e);
        }
        updates.status = "cancelled";
        updates.canceled_at = nowIso;
        updates.next_retry_at = null;
        eventType = "auto_cancelled";
        message = `Subscription auto-cancelled after ${newCount} failed payment attempts.`;
        cancelled++;
      } else {
        const hours = RETRY_BACKOFF_HOURS[Math.min(newCount - 1, RETRY_BACKOFF_HOURS.length - 1)];
        updates.next_retry_at = new Date(Date.now() + hours * 3600 * 1000).toISOString();
        eventType = "retry_failed";
        message = `Retry #${newCount} failed: ${errMsg || "unknown error"}. Next attempt in ${hours}h.`;
      }
    }

    await supabase.from("store_subscriptions").update(updates).eq("id", sub.id);
    await supabase.from("store_subscription_events").insert({
      subscription_id: sub.id,
      event_type: eventType,
      source: "system",
      message,
      payload: { attempt: attempt + 1, provider: sub.provider, error: errMsg || null },
    });

    // Dunning email
    try {
      const { data: prof } = await supabase.from("profiles").select("email, full_name").eq("id", sub.user_id).maybeSingle();
      const email = (prof as any)?.email;
      if (email) {
        if (success) {
          await sendDunningEmail(email, "Payment recovered — your subscription is active",
            `<p>Hi ${(prof as any)?.full_name || "there"},</p><p>Good news — we were able to process your subscription payment. Your plan is active again.</p><p>— Vendx Billing</p>`);
        } else if (updates.status === "cancelled") {
          await sendDunningEmail(email, "Your subscription has been cancelled",
            `<p>Hi ${(prof as any)?.full_name || "there"},</p><p>After several failed attempts to charge your payment method, your subscription has been cancelled. You can resubscribe anytime from your dashboard.</p><p>— Vendx Billing</p>`);
        } else {
          await sendDunningEmail(email, "Action needed — payment failed",
            `<p>Hi ${(prof as any)?.full_name || "there"},</p><p>We weren't able to charge your payment method (attempt ${attempt + 1} of ${MAX_FAILURES}). We'll retry automatically, but you can update your payment method anytime from your dashboard to avoid interruption.</p><p>— Vendx Billing</p>`);
        }
      }
    } catch (e) {
      console.error("[dunning lookup failed]", e);
    }
  }

  return new Response(JSON.stringify({
    processed: subs?.length || 0,
    retried,
    succeeded: succeededLogs,
    cancelled,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
