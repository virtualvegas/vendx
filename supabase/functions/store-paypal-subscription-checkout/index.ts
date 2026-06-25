import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYPAL_API_URL = Deno.env.get("PAYPAL_API_URL") || "https://api-m.paypal.com";

async function paypalToken(): Promise<string> {
  const id = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!id || !secret) throw new Error("PayPal credentials not configured");
  const res = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

const intervalToPayPal = (i: string | null): { unit: string; count: number } => {
  switch ((i || "month").toLowerCase()) {
    case "week": case "weekly": return { unit: "WEEK", count: 1 };
    case "year": case "yearly": case "annual": return { unit: "YEAR", count: 1 };
    case "quarter": case "quarterly": return { unit: "MONTH", count: 3 };
    default: return { unit: "MONTH", count: 1 };
  }
};

async function ensurePayPalPlan(token: string, supabase: any, product: any): Promise<{ planId: string; productId: string }> {
  if (product.paypal_plan_id && product.paypal_product_id) {
    return { planId: product.paypal_plan_id, productId: product.paypal_product_id };
  }

  // Create PayPal Product
  let productId = product.paypal_product_id;
  if (!productId) {
    const pRes = await fetch(`${PAYPAL_API_URL}/v1/catalogs/products`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `vendx-prod-${product.id}` },
      body: JSON.stringify({
        name: product.name.substring(0, 127),
        description: (product.short_description || product.name).substring(0, 256),
        type: "DIGITAL",
        category: "GENERAL",
      }),
    });
    if (!pRes.ok) throw new Error(`PayPal product create failed: ${await pRes.text()}`);
    productId = (await pRes.json()).id;
  }

  // Create PayPal Plan
  const price = Number(product.subscription_price || product.price).toFixed(2);
  const freq = intervalToPayPal(product.subscription_interval);
  const planRes = await fetch(`${PAYPAL_API_URL}/v1/billing/plans`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `vendx-plan-${product.id}` },
    body: JSON.stringify({
      product_id: productId,
      name: `${product.name} (${freq.unit.toLowerCase()})`,
      status: "ACTIVE",
      billing_cycles: [{
        frequency: { interval_unit: freq.unit, interval_count: freq.count },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: price, currency_code: "USD" } },
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: "0", currency_code: "USD" },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
    }),
  });
  if (!planRes.ok) throw new Error(`PayPal plan create failed: ${await planRes.text()}`);
  const planId = (await planRes.json()).id;

  await supabase.from("store_products").update({
    paypal_product_id: productId,
    paypal_plan_id: planId,
  }).eq("id", product.id);

  return { planId, productId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const user = userData.user;

    const { productId, addonIds, shippingAddressId } = await req.json();
    if (!productId) throw new Error("productId required");

    const { data: product } = await supabase.from("store_products").select("*").eq("id", productId).maybeSingle();
    if (!product || !product.is_subscription || !product.is_active) throw new Error("Subscription product not found");

    const token = await paypalToken();
    const { planId } = await ensurePayPalPlan(token, supabase, product);

    const origin = req.headers.get("origin") || "https://vendx.space";
    const subRes = await fetch(`${PAYPAL_API_URL}/v1/billing/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `vendx-sub-${user.id}-${Date.now()}` },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: JSON.stringify({ user_id: user.id, product_id: product.id, addon_ids: addonIds || [], shipping_address_id: shippingAddressId || null }),
        subscriber: {
          email_address: user.email,
          name: { given_name: (user.user_metadata?.full_name || user.email || "Customer").split(" ")[0], surname: (user.user_metadata?.full_name || "").split(" ").slice(1).join(" ") || "Member" },
        },
        application_context: {
          brand_name: "VendX",
          locale: "en-US",
          shipping_preference: shippingAddressId ? "SET_PROVIDED_ADDRESS" : "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          payment_method: { payer_selected: "PAYPAL", payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED" },
          return_url: `${origin}/store/order-success?paypal_sub=true`,
          cancel_url: `${origin}/store/cart?cancelled=true`,
        },
      }),
    });
    if (!subRes.ok) throw new Error(`PayPal subscription create failed: ${await subRes.text()}`);
    const sub = await subRes.json();

    // Pre-create a local subscription row so webhooks can resolve it
    const { data: localSub } = await supabase.from("store_subscriptions").insert({
      user_id: user.id,
      product_id: product.id,
      provider: "paypal",
      paypal_subscription_id: sub.id,
      paypal_plan_id: planId,
      status: "pending",
      addon_ids: addonIds || [],
      shipping_address_id: shippingAddressId || null,
    }).select().single();

    if (localSub) {
      await supabase.from("store_subscription_events").insert({
        subscription_id: localSub.id,
        event_type: "subscription.created",
        source: "customer",
        message: "PayPal subscription initiated",
        payload: { paypal_subscription_id: sub.id, plan_id: planId },
      });
    }

    const approve = sub.links?.find((l: any) => l.rel === "approve");
    if (!approve) throw new Error("No approval link in PayPal response");

    return new Response(JSON.stringify({ url: approve.href, subscriptionId: sub.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[paypal-sub-checkout]", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
