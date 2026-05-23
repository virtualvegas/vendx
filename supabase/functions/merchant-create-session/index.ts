import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vendx-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_BASE = "https://vendx.space";

async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "vxs_" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function domainOf(url: string): string | null {
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = req.headers.get("x-vendx-api-key") || req.headers.get("X-VendX-Api-Key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing X-VendX-Api-Key header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { amount, currency = "USD", order_reference, description, customer_email,
      return_url, cancel_url, webhook_url, metadata = {} } = body;

    if (typeof amount !== "number" || amount <= 0) {
      return new Response(JSON.stringify({ error: "amount must be a positive number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!return_url || typeof return_url !== "string") {
      return new Response(JSON.stringify({ error: "return_url is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const keyHash = await hashKey(apiKey);
    const { data: merchant } = await supabase
      .from("vendx_merchants")
      .select("*")
      .eq("api_key_hash", keyHash)
      .eq("is_active", true)
      .maybeSingle();

    if (!merchant) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Domain whitelist check
    const allowed: string[] = merchant.allowed_return_domains || [];
    if (allowed.length > 0) {
      const rd = domainOf(return_url);
      const ok = rd && allowed.some(d => rd === d.toLowerCase() || rd.endsWith("." + d.toLowerCase()));
      if (!ok) {
        return new Response(JSON.stringify({ error: `return_url domain not allowed for this merchant` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();

    const { data: session, error } = await supabase
      .from("vendx_merchant_payment_sessions")
      .insert({
        merchant_id: merchant.id,
        session_token: token,
        amount: Number(amount.toFixed(2)),
        currency,
        order_reference,
        description,
        customer_email,
        return_url,
        cancel_url,
        webhook_url,
        expires_at: expiresAt,
        metadata,
      })
      .select("id, session_token, expires_at")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({
      session_token: session.session_token,
      checkout_url: `${APP_BASE}/pay/checkout/${session.session_token}`,
      expires_at: session.expires_at,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("create-session error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
