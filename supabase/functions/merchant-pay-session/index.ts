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

    const authedClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: authErr } = await authedClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "token required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: result, error: payErr } = await admin.rpc("merchant_pay_with_wallet", {
      p_session_token: token,
      p_user_id: userId,
    });
    if (payErr) throw payErr;
    const row = Array.isArray(result) ? result[0] : result;

    if (!row?.success) {
      return new Response(JSON.stringify({
        success: false,
        error: row?.message ?? "Payment failed",
        new_balance: row?.new_balance ?? 0,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch full session + merchant for webhook
    const { data: session } = await admin
      .from("vendx_merchant_payment_sessions")
      .select("*, vendx_merchants(name, slug, webhook_secret)")
      .eq("id", row.session_id)
      .single();

    // Fire webhook async (don't block return)
    if (session?.webhook_url && (session as any).vendx_merchants?.webhook_secret) {
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
      // fire-and-forget
      deliverWebhook(
        admin,
        session.id,
        session.webhook_url,
        (session as any).vendx_merchants.webhook_secret,
        payload,
      ).catch(e => console.error("webhook delivery error:", e));
    }

    const ret = new URL(row.return_url);
    ret.searchParams.set("vendx_session", token);
    ret.searchParams.set("status", "paid");

    return new Response(JSON.stringify({
      success: true,
      redirect_url: ret.toString(),
      new_balance: Number(row.new_balance),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    const msg = e?.message || e?.error_description || e?.hint || (typeof e === "string" ? e : JSON.stringify(e));
    console.error("pay-session error:", msg, e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
