// Loyverse POS webhook receiver
// Configure in Loyverse: Settings → Integrations → Webhooks
// URL: https://<project>.supabase.co/functions/v1/loyverse-webhook
// Events: receipts.update
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-loyverse-signature",
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

  try {
    const raw = await req.text();

    // Optional shared-secret verification
    const expectedSecret = Deno.env.get("LOYVERSE_WEBHOOK_SECRET");
    if (expectedSecret) {
      const provided = req.headers.get("x-loyverse-signature") || req.headers.get("authorization")?.replace("Bearer ", "");
      if (provided !== expectedSecret) {
        console.warn("Loyverse webhook: invalid signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = JSON.parse(raw || "{}");
    // Loyverse sends { type, receipts: [...] } OR a single receipt
    const receipts: any[] = Array.isArray(body?.receipts)
      ? body.receipts
      : Array.isArray(body) ? body : [body];

    const results = [];
    for (const r of receipts) {
      try {
        const externalId = r.receipt_number || r.id || r.receipt_id;
        if (!externalId) { results.push({ skipped: "no id" }); continue; }

        // Skip refunds / voids
        if (r.receipt_type && String(r.receipt_type).toLowerCase() !== "sale") {
          results.push({ external_id: externalId, skipped: r.receipt_type });
          continue;
        }

        // Idempotency
        const { data: existing } = await supabase
          .from("vendx_pos_receipts")
          .select("id")
          .eq("external_id", String(externalId))
          .maybeSingle();
        if (existing) { results.push({ external_id: externalId, duplicate: true }); continue; }

        // Customer match
        const email = r.customer?.email || r.customer_email || null;
        const phoneRaw = r.customer?.phone_number || r.customer_phone || null;
        const phoneNorm = normalizePhone(phoneRaw);
        let userId: string | null = null;
        let matchedBy: string | null = null;

        if (email) {
          const { data: byEmail } = await supabase
            .from("profiles").select("id").ilike("email", email).maybeSingle();
          if (byEmail?.id) { userId = byEmail.id; matchedBy = "email"; }
        }
        if (!userId && phoneNorm) {
          const { data: profs } = await supabase
            .from("profiles").select("id, phone");
          const match = profs?.find((p: any) => normalizePhone(p.phone) === phoneNorm);
          if (match) { userId = match.id; matchedBy = "phone"; }
        }

        // Totals
        const subtotal = Number(r.total_money ?? r.subtotal ?? 0) - Number(r.total_tax ?? 0);
        const taxTotal = Number(r.total_tax ?? 0);
        const discountTotal = Number(r.total_discount ?? 0);
        const tipTotal = Number(r.tip ?? 0);
        const totalAmount = Number(r.total_money ?? r.total ?? (subtotal + taxTotal + tipTotal - discountTotal));
        const paymentMethod = Array.isArray(r.payments) && r.payments[0]?.payment_type_id
          ? (r.payments[0].name || r.payments[0].payment_type_id) : (r.payment_method || null);

        // Insert receipt
        const { data: receipt, error: insErr } = await supabase
          .from("vendx_pos_receipts").insert({
            user_id: userId,
            external_id: String(externalId),
            receipt_number: r.receipt_number || null,
            source: "loyverse",
            store_name: r.store_name || r.store_id || null,
            pos_customer_id: r.customer?.id || r.customer_id || null,
            pos_customer_email: email,
            pos_customer_phone: phoneRaw,
            pos_customer_name: r.customer?.name || r.customer_name || null,
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
        const items = Array.isArray(r.line_items) ? r.line_items : Array.isArray(r.items) ? r.items : [];
        if (items.length) {
          await supabase.from("vendx_pos_receipt_items").insert(
            items.map((it: any) => ({
              receipt_id: receipt.id,
              item_name: it.item_name || it.name || "Item",
              sku: it.sku || it.variant_sku || null,
              quantity: Number(it.quantity ?? 1),
              unit_price: Number(it.price ?? it.unit_price ?? 0),
              line_total: Number(it.total_money ?? it.line_total ?? (Number(it.price ?? 0) * Number(it.quantity ?? 1))),
            }))
          );
        }

        // Award points (uses pos config + tier multiplier)
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

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("loyverse-webhook error", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Webhook error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
