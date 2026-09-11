import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchZettlePurchases, minorUnits, purchaseId, purchaseRegisterId, type ZettlePurchase } from "../_shared/zettle.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function savePurchase(supabase: any, purchase: ZettlePurchase) {
  const externalId = purchaseId(purchase);
  if (!externalId) return { skipped: "missing purchase ID" };

  const { data: existing } = await supabase.from("vendx_pos_receipts")
    .select("id").eq("external_id", externalId).maybeSingle();
  if (existing) return { external_id: externalId, duplicate: true };

  const products = Array.isArray(purchase.products) ? purchase.products : [];
  const payments = Array.isArray(purchase.payments) ? purchase.payments : [];
  const totalAmount = minorUnits(purchase.amount);
  const taxTotal = minorUnits(purchase.vatAmount);
  const discountTotal = products.reduce((sum, item: any) => sum + minorUnits(item.discountAmount), 0);
  const tipTotal = payments.reduce((sum, payment: any) => sum + minorUnits(payment.tipAmount), 0);
  const posStoreId = purchaseRegisterId(purchase);

  let locationId: string | null = null;
  let standId: string | null = null;
  let storeName: string | null = null;
  if (posStoreId) {
    const { data: mapping } = await supabase.from("vendx_pos_stores")
      .select("display_name, location_id, stand_id")
      .eq("source", "paypal_zettle")
      .eq("pos_store_id", posStoreId)
      .eq("is_active", true)
      .maybeSingle();
    locationId = mapping?.location_id || null;
    standId = mapping?.stand_id || null;
    storeName = mapping?.display_name || null;
  }

  const paymentMethod = payments.length
    ? String((payments[0] as any).type || (payments[0] as any).paymentType || "Zettle")
    : "Zettle";
  const receiptNumber = purchase.purchaseNumber ?? purchase.globalPurchaseNumber ?? null;
  const { data: receipt, error } = await supabase.from("vendx_pos_receipts").insert({
    user_id: null,
    external_id: externalId,
    receipt_number: receiptNumber == null ? null : String(receiptNumber),
    source: "paypal_zettle",
    store_name: storeName,
    pos_store_id: posStoreId,
    location_id: locationId,
    stand_id: standId,
    pos_customer_id: null,
    pos_customer_email: null,
    pos_customer_phone: null,
    pos_customer_name: null,
    matched_by: null,
    subtotal: totalAmount - taxTotal,
    tax_total: taxTotal,
    discount_total: discountTotal,
    tip_total: tipTotal,
    total_amount: totalAmount,
    currency: typeof purchase.currency === "string" ? purchase.currency : "USD",
    payment_method: paymentMethod,
    receipt_date: typeof purchase.timestamp === "string" ? purchase.timestamp : new Date().toISOString(),
    raw_payload: purchase,
  }).select("id").single();
  if (error) throw error;

  if (products.length) {
    const { error: itemError } = await supabase.from("vendx_pos_receipt_items").insert(
      products.map((item: any) => {
        const quantity = Number(item.quantity ?? 1);
        const lineTotal = minorUnits(item.amount ?? item.grossValue ?? item.totalAmount);
        return {
          receipt_id: receipt.id,
          item_name: item.name || item.productName || "Zettle item",
          sku: item.sku || item.variantUuid || null,
          quantity,
          unit_price: quantity ? lineTotal / quantity : lineTotal,
          line_total: lineTotal,
        };
      }),
    );
    if (itemError) throw itemError;
  }

  const { data: matchResult } = await supabase.rpc("match_and_award_pos_receipt", { p_receipt_id: receipt.id });
  return {
    external_id: externalId,
    matched: Boolean(matchResult?.matched),
    points: Number(matchResult?.points ?? 0),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { data: state } = await supabase.from("vendx_integration_state")
      .select("value").eq("key", "zettle_last_sync").maybeSingle();
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* no body */ }
    const startDate = typeof body.since === "string"
      ? body.since
      : state?.value || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const endDate = typeof body.until === "string" ? body.until : new Date().toISOString();
    const limit = Math.min(Math.max(Number(body.limit ?? 100), 1), 1000);
    const results: unknown[] = [];
    let lastPurchaseHash: string | undefined;
    let pages = 0;
    let newestDate = startDate;

    do {
      const page = await fetchZettlePurchases({ startDate, endDate, limit, lastPurchaseHash });
      pages += 1;
      for (const purchase of page.purchases) {
        try {
          results.push(await savePurchase(supabase, purchase));
          if (typeof purchase.timestamp === "string" && purchase.timestamp > newestDate) newestDate = purchase.timestamp;
        } catch (error: any) {
          console.error("Zettle purchase import failed", error);
          results.push({ external_id: purchaseId(purchase), error: error?.message || "Import failed" });
        }
      }
      lastPurchaseHash = page.lastPurchaseHash;
      if (!page.purchases.length) break;
    } while (lastPurchaseHash && pages < 10);

    await supabase.from("vendx_integration_state").upsert({
      key: "zettle_last_sync",
      value: newestDate,
      updated_at: new Date().toISOString(),
    });
    return json({ ok: true, processed: results.length, pages, since: startDate, next_since: newestDate, results });
  } catch (error: any) {
    console.error("zettle-sync error", error);
    return json({ error: error?.message || "Zettle sync failed" }, 500);
  }
});
