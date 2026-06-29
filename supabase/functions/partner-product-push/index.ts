// Partner upserts a product into VendX storefront
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, authPartner } from "../_shared/partner-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "PUT") return json({ error: "Method not allowed" }, 405);

  const auth = await authPartner(req);
  if (auth.error) return auth.error;
  const { partner, supabase } = auth;

  if (partner.mode === "outbound") {
    return json({ error: "This partner is outbound-only" }, 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const products = Array.isArray(body.products) ? body.products : [body];
  const results: Array<Record<string, unknown>> = [];

  for (const p of products) {
    if (!p.external_product_id || !p.name || typeof p.price !== "number") {
      results.push({ ok: false, external_product_id: p.external_product_id, error: "external_product_id, name, price required" });
      continue;
    }
    const slug = (p.slug || `${partner.slug}-${p.external_product_id}`).toString().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const row = {
      partner_id: partner.id,
      external_product_id: String(p.external_product_id),
      name: p.name,
      slug,
      description: p.description ?? null,
      short_description: p.short_description ?? null,
      price: p.price,
      currency: p.currency ?? "USD",
      image_url: p.image_url ?? (Array.isArray(p.images) ? p.images[0] : null),
      images: Array.isArray(p.images) ? p.images : (p.image_url ? [p.image_url] : []),
      category: p.category ?? null,
      sku: p.sku ?? null,
      stock: p.stock ?? null,
      is_subscription: !!p.is_subscription,
      subscription_interval: p.subscription_interval ?? null,
      product_url: p.product_url ?? null,
      metadata: p.metadata ?? {},
      is_active: p.is_active !== false,
      last_synced_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("vendx_partner_products")
      .upsert(row, { onConflict: "partner_id,external_product_id" })
      .select("id, slug, is_active")
      .single();
    if (error) results.push({ ok: false, external_product_id: p.external_product_id, error: error.message });
    else results.push({ ok: true, external_product_id: p.external_product_id, id: data.id, slug: data.slug });
  }

  return json({ ok: true, results });
});
