import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, authPartner } from "../_shared/partner-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "DELETE" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await authPartner(req);
  if (auth.error) return auth.error;
  const { partner, supabase } = auth;

  const url = new URL(req.url);
  const externalId = url.searchParams.get("external_product_id")
    || (req.method === "POST" ? ((await req.json().catch(() => ({}))).external_product_id) : null);
  if (!externalId) return json({ error: "external_product_id required" }, 400);

  const { error } = await supabase
    .from("vendx_partner_products")
    .delete()
    .eq("partner_id", partner.id)
    .eq("external_product_id", String(externalId));
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
