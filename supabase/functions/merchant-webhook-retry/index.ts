// Cron: retries failed webhook deliveries that are due, and expires stale sessions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { deliverWebhook } from "../_shared/merchant-webhook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Expire stale pending sessions
  const { data: expired } = await admin
    .from("vendx_merchant_payment_sessions")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  // Find due retries: latest non-succeeded delivery per session with next_retry_at <= now
  const { data: due } = await admin
    .from("vendx_merchant_webhook_deliveries")
    .select("id, session_id, attempt")
    .eq("succeeded", false)
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  let retried = 0;
  if (due && due.length) {
    for (const d of due) {
      const { data: session } = await admin
        .from("vendx_merchant_payment_sessions")
        .select("*, vendx_merchants(slug, webhook_secret)")
        .eq("id", d.session_id)
        .single();
      if (!session?.webhook_url || !(session as any).vendx_merchants?.webhook_secret) continue;
      if (session.status !== "paid") continue;

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
      // Mark previous as no-longer-due
      await admin.from("vendx_merchant_webhook_deliveries")
        .update({ next_retry_at: null }).eq("id", d.id);

      await deliverWebhook(
        admin, session.id, session.webhook_url,
        (session as any).vendx_merchants.webhook_secret, payload, d.attempt + 1,
      );
      retried++;
    }
  }

  return new Response(JSON.stringify({
    expired: expired?.length ?? 0,
    retried,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
