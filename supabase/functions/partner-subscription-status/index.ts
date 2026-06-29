// GET — partner queries a subscription record we hold for them.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, authPartner } from "../_shared/partner-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const auth = await authPartner(req);
  if (auth.error) return auth.error;
  const { partner, supabase } = auth;

  const url = new URL(req.url);
  const externalId = url.searchParams.get("external_subscription_id");
  const id = url.searchParams.get("id");
  if (!externalId && !id) return json({ error: "external_subscription_id or id required" }, 400);

  let q = supabase
    .from("vendx_partner_subscriptions")
    .select("id, direction, external_subscription_id, status, last_event, price, currency, interval, started_at, current_period_end, cancelled_at, last_payment_at, failed_payment_count, customer_email, created_at, updated_at")
    .eq("partner_id", partner.id)
    .limit(1);
  if (externalId) q = q.eq("external_subscription_id", externalId);
  else q = q.eq("id", id!);

  const { data, error } = await q.maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "Not found" }, 404);
  return json({ subscription: data });
});
