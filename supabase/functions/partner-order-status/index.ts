import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, authPartner } from "../_shared/partner-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const auth = await authPartner(req);
  if (auth.error) return auth.error;
  const { partner, supabase } = auth;

  const url = new URL(req.url);
  const externalOrderId = url.searchParams.get("external_order_id");
  const partnerOrderId = url.searchParams.get("partner_order_id");
  if (!externalOrderId && !partnerOrderId) return json({ error: "external_order_id or partner_order_id required" }, 400);

  let q = supabase
    .from("vendx_partner_orders")
    .select("id, direction, external_order_id, vendx_order_id, status, payment_status, fulfillment_status, total, currency, created_at")
    .eq("partner_id", partner.id)
    .limit(1);
  if (externalOrderId) q = q.eq("external_order_id", externalOrderId);
  else if (partnerOrderId) q = q.eq("id", partnerOrderId);

  const { data, error } = await q.maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "Not found" }, 404);
  return json({ order: data });
});
