import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, authPartner } from "../_shared/partner-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const auth = await authPartner(req);
  if (auth.error) return auth.error;
  const { partner, supabase } = auth;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const slug = url.searchParams.get("slug");
  if (!id && !slug) return json({ error: "id or slug required" }, 400);

  let q = supabase.from("store_products").select("*").eq("is_active", true).limit(1);
  if (id) q = q.eq("id", id);
  else if (slug) q = q.eq("slug", slug);

  const { data, error } = await q.maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "Not found" }, 404);

  const allowed: string[] = partner.allowed_outbound_categories || [];
  if (allowed.length > 0 && !allowed.includes(data.category)) {
    return json({ error: "Product not available to this partner" }, 403);
  }

  return json({ product: data });
});
