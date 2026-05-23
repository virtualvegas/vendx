// Loyverse POS sync — polls receipts via API token every few minutes
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(p?: string | null) {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const token = Deno.env.get("LOYVERSE_ACCESS_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "LOYVERSE_ACCESS_TOKEN not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Load last sync cursor
    const { data: cursorRow } = await supabase
      .from("vendx_integration_state")
      .select("value")
      .eq("key", "loyverse_last_sync")
      .maybeSingle();

    const since = cursorRow?.value
      || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // default: last 24h on first run

    // Allow manual override via body { since: ISO, limit: number }
    let bodyOverride: any = {};
    try { bodyOverride = await req.json(); } catch { /* noop */ }
    const sinceParam = bodyOverride.since || since;
    const limit = Math.min(Number(bodyOverride.limit ?? 250), 250);

    const results: any[] = [];
    let cursor: string | undefined = undefined;
    let newestDate = sinceParam;
    let pages = 0;

    do {
      const url = new URL("https://api.loyverse.com/v1.0/receipts");
      url.searchParams.set("created_at_min", sinceParam);
      url.searchParams.set("limit", String(limit));
      if (cursor) url.searchParams.set("cursor", cursor);

      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Loyverse API ${resp.status}: ${txt}`);
      }
      const data = await resp.json();
      const receipts: any[] = data.receipts || [];
      cursor = data.cursor;
      pages++;

      for (const r of receipts) {
        try {
          const externalId = r.receipt_number || r.id;
          if (!externalId) { results.push({ skipped: "no id" }); continue; }

          // Track newest receipt timestamp for cursor advance
          const rDate = r.created_at || r.receipt_date;
          if (rDate && rDate > newestDate) newestDate = rDate;

          // Skip refunds
          if (r.receipt_type && String(r.receipt_type).toUpperCase() !== "SALE") {
            results.push({ external_id: externalId, skipped: r.receipt_type });
            continue;
          }

          // Idempotency
          const { data: existing } = await supabase
            .from("vendx_pos_receipts").select("id")
            .eq("external_id", String(externalId)).maybeSingle();
          if (existing) { results.push({ external_id: externalId, duplicate: true }); continue; }

          // Customer lookup — Loyverse returns customer_id; fetch details if present
          let email: string | null = null;
          let phoneRaw: string | null = null;
          let customerName: string | null = null;
          if (r.customer_id) {
            try {
              const cResp = await fetch(`https://api.loyverse.com/v1.0/customers/${r.customer_id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (cResp.ok) {
                const c = await cResp.json();
                email = c.email || null;
                phoneRaw = c.phone_number || null;
                customerName = c.name || null;
              }
            } catch { /* ignore */ }
          }

          // Match customer
          const phoneNorm = normalizePhone(phoneRaw);
          let userId: string | null = null;
          let matchedBy: string | null = null;

          if (email) {
            const { data: byEmail } = await supabase
              .from("profiles").select("id").ilike("email", email).maybeSingle();
            if (byEmail?.id) { userId = byEmail.id; matchedBy = "email"; }
          }
          if (!userId && phoneNorm) {
            const { data: profs } = await supabase.from("profiles").select("id, phone");
            const match = profs?.find((p: any) => normalizePhone(p.phone) === phoneNorm);
            if (match) { userId = match.id; matchedBy = "phone"; }
          }

          // Totals — Loyverse fields
          const subtotal = Number(r.total_money ?? 0) - Number(r.total_tax ?? 0);
          const taxTotal = Number(r.total_tax ?? 0);
          const discountTotal = Number(r.total_discount ?? 0);
          const tipTotal = Number(r.tip ?? 0);
          const totalAmount = Number(r.total_money ?? (subtotal + taxTotal + tipTotal - discountTotal));
          const paymentMethod = Array.isArray(r.payments) && r.payments[0]
            ? (r.payments[0].name || r.payments[0].type || null) : null;

          const { data: receipt, error: insErr } = await supabase
            .from("vendx_pos_receipts").insert({
              user_id: userId,
              external_id: String(externalId),
              receipt_number: r.receipt_number || null,
              source: "loyverse",
              store_name: r.store_id || null,
              pos_customer_id: r.customer_id || null,
              pos_customer_email: email,
              pos_customer_phone: phoneRaw,
              pos_customer_name: customerName,
              matched_by: matchedBy,
              subtotal, tax_total: taxTotal, discount_total: discountTotal, tip_total: tipTotal,
              total_amount: totalAmount,
              currency: r.currency || "USD",
              payment_method: paymentMethod,
              receipt_date: r.receipt_date || r.created_at || new Date().toISOString(),
              raw_payload: r,
            }).select().single();
          if (insErr) throw insErr;

          // Line items
          const items = Array.isArray(r.line_items) ? r.line_items : [];
          if (items.length) {
            await supabase.from("vendx_pos_receipt_items").insert(
              items.map((it: any) => ({
                receipt_id: receipt.id,
                item_name: it.item_name || it.name || "Item",
                sku: it.sku || it.variant_sku || null,
                quantity: Number(it.quantity ?? 1),
                unit_price: Number(it.price ?? 0),
                line_total: Number(it.total_money ?? (Number(it.price ?? 0) * Number(it.quantity ?? 1))),
              }))
            );
          }

          // Award points
          let pointsEarned = 0;
          if (userId && totalAmount > 0) {
            const { data: pts } = await supabase.rpc("award_pos_points", {
              p_user_id: userId,
              p_source: "pos",
              p_amount: totalAmount,
              p_receipt_id: receipt.id,
              p_description: `Loyverse POS receipt ${r.receipt_number || externalId}`,
            });
            pointsEarned = Number(pts ?? 0);
            if (pointsEarned > 0) {
              await supabase.from("vendx_pos_receipts").update({ points_earned: pointsEarned }).eq("id", receipt.id);
            }
          }

          results.push({ external_id: externalId, matched: !!userId, points: pointsEarned });
        } catch (e: any) {
          console.error("receipt error", e);
          results.push({ error: e?.message ?? String(e) });
        }
      }
    } while (cursor && pages < 10); // safety cap

    // Advance cursor (bump 1ms to avoid re-fetching the same boundary record)
    const nextSince = new Date(new Date(newestDate).getTime() + 1).toISOString();
    await supabase.from("vendx_integration_state").upsert({
      key: "loyverse_last_sync",
      value: nextSince,
      updated_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      ok: true, processed: results.length, pages, since: sinceParam, next_since: nextSince, results,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("loyverse-sync error", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Sync error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
