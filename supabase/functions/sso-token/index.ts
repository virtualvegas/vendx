// VendX SSO — Token endpoint
// Supports grant_type = "authorization_code" and "refresh_token"
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
function randomToken(len = 32): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function pkceMatches(verifier: string, challenge: string, method: string | null): Promise<boolean> {
  if (!method || method.toUpperCase() === "PLAIN") return verifier === challenge;
  if (method.toUpperCase() === "S256") {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const b64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return b64 === challenge;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { grant_type, client_id, client_secret, code, redirect_uri, code_verifier, refresh_token } = body ?? {};
    if (!grant_type || !client_id) {
      return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: app } = await admin
      .from("vendx_sso_apps")
      .select("id, client_secret_hash, is_active")
      .eq("client_id", client_id)
      .maybeSingle();
    if (!app || !app.is_active) {
      return new Response(JSON.stringify({ error: "invalid_client" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Confidential clients must present client_secret. PKCE-only public clients can skip.
    let confidentialOK = false;
    if (client_secret) {
      const hashed = await sha256Hex(client_secret);
      confidentialOK = hashed === app.client_secret_hash;
      if (!confidentialOK) {
        return new Response(JSON.stringify({ error: "invalid_client" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    let userId: string;
    let scopes: string[];
    let appId = app.id;

    if (grant_type === "authorization_code") {
      if (!code || !redirect_uri) {
        return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const codeHash = await sha256Hex(code);
      const { data: ac } = await admin
        .from("vendx_sso_auth_codes")
        .select("*")
        .eq("code_hash", codeHash)
        .eq("app_id", app.id)
        .maybeSingle();
      if (!ac || ac.used_at || new Date(ac.expires_at) < new Date() || ac.redirect_uri !== redirect_uri) {
        return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!confidentialOK) {
        // Require PKCE
        if (!ac.code_challenge || !code_verifier || !(await pkceMatches(code_verifier, ac.code_challenge, ac.code_challenge_method))) {
          return new Response(JSON.stringify({ error: "invalid_grant", error_description: "PKCE failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      await admin.from("vendx_sso_auth_codes").update({ used_at: new Date().toISOString() }).eq("id", ac.id);
      userId = ac.user_id;
      scopes = ac.scopes;
    } else if (grant_type === "refresh_token") {
      if (!refresh_token) {
        return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const refreshHash = await sha256Hex(refresh_token);
      const { data: tok } = await admin
        .from("vendx_sso_tokens")
        .select("*")
        .eq("refresh_token_hash", refreshHash)
        .eq("app_id", app.id)
        .maybeSingle();
      if (!tok || tok.revoked_at || !tok.refresh_expires_at || new Date(tok.refresh_expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Rotate: revoke old, issue new below
      await admin.from("vendx_sso_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", tok.id);
      userId = tok.user_id;
      scopes = tok.scopes;
    } else {
      return new Response(JSON.stringify({ error: "unsupported_grant_type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const accessToken = "vxat_" + randomToken(32);
    const refreshTokenNew = "vxrt_" + randomToken(32);
    const accessHash = await sha256Hex(accessToken);
    const refreshHashNew = await sha256Hex(refreshTokenNew);
    const expiresIn = 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    await admin.from("vendx_sso_tokens").insert({
      access_token_hash: accessHash,
      refresh_token_hash: refreshHashNew,
      app_id: appId,
      user_id: userId,
      scopes,
      expires_at: expiresAt,
      refresh_expires_at: refreshExpiresAt,
      ip_address: req.headers.get("x-forwarded-for") ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
    });

    // Upsert linked account (touch last_used_at)
    await admin.from("vendx_sso_linked_accounts").upsert({
      user_id: userId,
      app_id: appId,
      scopes_granted: scopes,
      last_used_at: new Date().toISOString(),
      revoked_at: null,
    }, { onConflict: "user_id,app_id" });

    return new Response(JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshTokenNew,
      token_type: "Bearer",
      expires_in: expiresIn,
      scope: scopes.join(" "),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
