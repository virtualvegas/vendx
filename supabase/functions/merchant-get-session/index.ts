import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token");
    if (!token && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      token = body.token;
    }
    if (!token) {
      return new Response(JSON.stringify({ error: "token required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: session } = await supabase
      .from("vendx_merchant_payment_sessions")
      .select("id, session_token, amount, currency, order_reference, description, customer_email, status, expires_at, paid_at, return_url, cancel_url, merchant_id")
      .eq("session_token", token)
      .maybeSingle();

    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: merchant } = await supabase
      .from("vendx_merchants")
      .select("name, slug, logo_url")
      .eq("id", session.merchant_id)
      .maybeSingle();

    // Auto-expire if needed
    let status = session.status;
    if (status === "pending" && new Date(session.expires_at) < new Date()) {
      await supabase.from("vendx_merchant_payment_sessions")
        .update({ status: "expired" }).eq("id", session.id);
      status = "expired";
    }

    return new Response(JSON.stringify({
      session_token: session.session_token,
      amount: Number(session.amount),
      currency: session.currency,
      order_reference: session.order_reference,
      description: session.description,
      customer_email: session.customer_email,
      status,
      expires_at: session.expires_at,
      paid_at: session.paid_at,
      return_url: session.return_url,
      cancel_url: session.cancel_url,
      merchant: merchant ? { name: merchant.name, slug: merchant.slug, logo_url: merchant.logo_url } : null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
