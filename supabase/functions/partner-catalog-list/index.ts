import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, authPartner } from "../_shared/partner-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const auth = await authPartner(req);
  if (auth.error) return auth.error;
  const { partner, supabase } = auth;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const category = url.searchParams.get("category");
  const subscription = url.searchParams.get("subscription");

  if (partner.mode === "inbound") {
    return json({ error: "This partner is inbound-only and cannot list our catalog" }, 403);
  }

  let q = supabase
    .from("store_products")
    .select(
      "id,name,slug,short_description,description,price,compare_at_price,subscription_price,subscription_interval,category,images,stock,is_subscription,is_active",
      { count: "exact" },
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const allowed: string[] = partner.allowed_outbound_categories || [];
  if (allowed.length > 0) q = q.in("category", allowed);
  if (category) q = q.eq("category", category);
  if (subscription === "true") q = q.eq("is_subscription", true);
  if (subscription === "false") q = q.eq("is_subscription", false);

  const { data, error, count } = await q;
  if (error) return json({ error: error.message }, 500);

  return json({
    partner: { id: partner.id, name: partner.name },
    products: data,
    pagination: { limit, offset, total: count ?? data?.length ?? 0 },
  });
});
