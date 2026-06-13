// VendX SSO — UserInfo endpoint. Returns scoped user data for a Bearer access token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = auth.replace("Bearer ", "").trim();
    if (!token.startsWith("vxat_")) {
      return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const hash = await sha256Hex(token);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tok } = await admin
      .from("vendx_sso_tokens")
      .select("id, app_id, user_id, scopes, expires_at, revoked_at")
      .eq("access_token_hash", hash)
      .maybeSingle();
    if (!tok || tok.revoked_at || new Date(tok.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("vendx_sso_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tok.id);

    const scopes: string[] = tok.scopes ?? [];
    const out: Record<string, unknown> = { sub: tok.user_id };

    // profile + email
    if (scopes.includes("profile") || scopes.includes("email")) {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name, email, avatar_url, job_title, department, phone, division_ids")
        .eq("id", tok.user_id)
        .maybeSingle();
      if (profile) {
        if (scopes.includes("profile")) {
          out.name = profile.full_name;
          out.picture = profile.avatar_url;
          out.job_title = profile.job_title;
          out.department = profile.department;
          out.phone = profile.phone;
          out.company = "VendX Global Corporation";
        }
        if (scopes.includes("email")) out.email = profile.email;
        if (scopes.includes("divisions:read") && profile.division_ids?.length) {
          const { data: divs } = await admin
            .from("divisions").select("id, name, slug").in("id", profile.division_ids);
          out.divisions = divs ?? [];
        }
      }
    }

    if (scopes.includes("wallet:read")) {
      const { data: wallet } = await admin
        .from("wallets")
        .select("balance, wallet_type, is_guest, status")
        .eq("user_id", tok.user_id)
        .eq("wallet_type", "standard")
        .maybeSingle();
      out.wallet = wallet ?? null;
    }
    if (scopes.includes("rewards:read")) {
      const { data: rp } = await admin
        .from("rewards_points").select("balance, lifetime_points, tier").eq("user_id", tok.user_id).maybeSingle();
      out.rewards = rp ?? null;
    }
    if (scopes.includes("tickets:read")) {
      const { data: t } = await admin
        .from("user_tickets").select("balance, lifetime_earned, lifetime_redeemed").eq("user_id", tok.user_id).maybeSingle();
      out.tickets = t ?? null;
    }
    if (scopes.includes("roles:read")) {
      const { data: roles } = await admin
        .from("user_roles").select("role").eq("user_id", tok.user_id);
      out.roles = (roles ?? []).map((r) => r.role);
    }

    return new Response(JSON.stringify(out), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
