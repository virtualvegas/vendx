// Admin-triggered manual redelivery
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { deliverWebhook } from "../_shared/merchant-webhook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: c } = await authed.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = c?.claims?.sub as string;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Role check
    const { data: roles } = await admin.from("user_roles")
      .select("role").eq("user_id", userId);
    const allowed = (roles || []).some(r => r.role === "super_admin" || r.role === "finance_accounting");
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session } = await admin
      .from("vendx_merchant_payment_sessions")
      .select("*, vendx_merchants(slug, webhook_secret)")
      .eq("id", session_id).single();

    if (!session || session.status !== "paid" || !session.webhook_url) {
      return new Response(JSON.stringify({ error: "Session not eligible for redelivery" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count } = await admin.from("vendx_merchant_webhook_deliveries")
      .select("*", { count: "exact", head: true }).eq("session_id", session_id);

    const payload = {
      event: "payment.completed",
      session_token: session.session_token,
      order_reference: session.order_reference,
      amount: Number(session.amount),
      currency: session.currency,
      paid_at: session.paid_at,
      customer_email: session.customer_email,
      merchant_slug: (session as any).vendx_merchants.slug,
      metadata: session.metadata,
    };

    await deliverWebhook(
      admin, session.id, session.webhook_url,
      (session as any).vendx_merchants.webhook_secret, payload, (count || 0) + 1,
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
