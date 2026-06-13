// VendX SSO — Authorization Code issuer (called by the consent page after user approves)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomCode(len = 48): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const { client_id, redirect_uri, scopes, state, code_challenge, code_challenge_method } = body ?? {};
    if (!client_id || !redirect_uri) {
      return new Response(JSON.stringify({ error: "client_id and redirect_uri required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: app, error: appErr } = await admin
      .from("vendx_sso_apps")
      .select("id, redirect_uris, allowed_scopes, is_active")
      .eq("client_id", client_id)
      .maybeSingle();
    if (appErr || !app) {
      return new Response(JSON.stringify({ error: "Unknown client_id" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!app.is_active) {
      return new Response(JSON.stringify({ error: "App is disabled" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!app.redirect_uris.includes(redirect_uri)) {
      return new Response(JSON.stringify({ error: "redirect_uri not whitelisted" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const requested: string[] = Array.isArray(scopes) ? scopes : [];
    const granted = requested.filter((s) => app.allowed_scopes.includes(s));
    if (granted.length === 0) granted.push("profile");

    const code = randomCode(32);
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insErr } = await admin.from("vendx_sso_auth_codes").insert({
      code_hash: codeHash,
      app_id: app.id,
      user_id: userId,
      redirect_uri,
      scopes: granted,
      code_challenge: code_challenge ?? null,
      code_challenge_method: code_challenge_method ?? null,
      state: state ?? null,
      expires_at: expiresAt,
    });
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ code, state: state ?? null, scopes: granted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
