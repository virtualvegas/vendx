import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

async function paypalAction(subId: string, action: "cancel" | "suspend" | "activate", reason: string) {
  const token = await paypalToken();
  const res = await fetch(`${PAYPAL_API_URL}/v1/billing/subscriptions/${subId}/${action}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reason: reason.substring(0, 127) }),
  });
  if (!res.ok && res.status !== 204) {
    const txt = await res.text();
    throw new Error(`PayPal ${action} failed: ${txt}`);
  }
}

async function paypalCaptureNow(subId: string, amount: string, note: string) {
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (roleRows || []).map((r: any) => r.role);
    const isStaff = roles.includes("super_admin") || roles.includes("finance_accounting") || roles.includes("support");
    const isFinanceAdmin = roles.includes("super_admin") || roles.includes("finance_accounting");

    const { subscriptionId, action, reason, compAmount } = await req.json();
    if (!subscriptionId || !action) throw new Error("subscriptionId and action required");

    const { data: sub, error: subErr } = await supabase.from("store_subscriptions").select("*").eq("id", subscriptionId).maybeSingle();
    if (subErr || !sub) throw new Error("Subscription not found");

    const isOwner = sub.user_id === user.id;
    if (!isOwner && !isStaff) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "comp_credit" && !isFinanceAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const source = isOwner && !isStaff ? "customer" : "admin";
    const reasonText = reason || (source === "customer" ? "Requested by customer" : "Performed by support");
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    let message = "";

    if (action === "cancel" || action === "cancel_immediate") {
      if (sub.provider === "paypal" && sub.paypal_subscription_id) {
        await paypalAction(sub.paypal_subscription_id, "cancel", reasonText);
      } else if (sub.provider === "stripe" && sub.stripe_subscription_id) {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
        if (action === "cancel_immediate") {
          await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        } else {
          await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
          updates.cancel_at_period_end = true;
          message = "Cancellation scheduled at period end";
        }
      }
      if (action === "cancel_immediate" || sub.provider === "paypal") {
        updates.status = "cancelled";
        updates.canceled_at = new Date().toISOString();
        message = message || "Subscription cancelled";
      }
    } else if (action === "pause") {
      if (sub.provider === "paypal" && sub.paypal_subscription_id) {
        await paypalAction(sub.paypal_subscription_id, "suspend", reasonText);
      } else if (sub.provider === "stripe" && sub.stripe_subscription_id) {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
        await stripe.subscriptions.update(sub.stripe_subscription_id, { pause_collection: { behavior: "void" } });
      }
      updates.status = "paused";
      updates.pause_collection = true;
      message = "Subscription paused";
    } else if (action === "resume") {
      if (sub.provider === "paypal" && sub.paypal_subscription_id) {
        await paypalAction(sub.paypal_subscription_id, "activate", reasonText);
      } else if (sub.provider === "stripe" && sub.stripe_subscription_id) {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
        await stripe.subscriptions.update(sub.stripe_subscription_id, { pause_collection: null, cancel_at_period_end: false });
      }
      updates.status = "active";
      updates.pause_collection = false;
      updates.cancel_at_period_end = false;
      message = "Subscription resumed";
    } else if (action === "retry_payment") {
      if (sub.provider === "stripe" && sub.stripe_subscription_id) {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
        const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, { expand: ["latest_invoice"] });
        const invoice = subscription.latest_invoice as any;
        if (invoice?.id && invoice.status === "open") {
          await stripe.invoices.pay(invoice.id);
        }
      } else if (sub.provider === "paypal" && sub.paypal_subscription_id) {
        const { data: prod } = await supabase.from("store_products").select("subscription_price, price").eq("id", sub.product_id).maybeSingle();
        const amount = Number(prod?.subscription_price || prod?.price || 0).toFixed(2);
        await paypalCaptureNow(sub.paypal_subscription_id, amount, "Manual retry by " + source);
      }
      updates.next_retry_at = null;
      message = "Payment retry requested";
    } else if (action === "comp_credit") {
      const amt = Number(compAmount || 0);
      if (amt <= 0) throw new Error("compAmount must be positive");
      updates.comp_credits_remaining = Number(sub.comp_credits_remaining || 0) + amt;
      message = `Added $${amt.toFixed(2)} complimentary credit`;
    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    await supabase.from("store_subscriptions").update(updates).eq("id", sub.id);
    await supabase.from("store_subscription_events").insert({
      subscription_id: sub.id,
      event_type: action,
      source,
      message,
      payload: { reason: reasonText, comp_amount: compAmount || null, performed_by: user.id },
      created_by: user.id,
    });

    return new Response(JSON.stringify({ success: true, message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[subscription-manage]", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
