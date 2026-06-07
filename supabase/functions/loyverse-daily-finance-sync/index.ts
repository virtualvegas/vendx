// Loyverse Daily Finance Sync — aggregates POS receipts for a given day,
// grouped per POS store, and posts one revenue + one COGS entry per store
// (attributed to the store's mapped location / stand when configured).
// Idempotent: re-running for the same day replaces existing entries for that store.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    let bodyOverride: any = {};
    try { bodyOverride = await req.json(); } catch { /* noop */ }

    let dates: string[] = [];
    if (bodyOverride.date) {
      dates = [String(bodyOverride.date)];
    } else if (bodyOverride.from && bodyOverride.to) {
      const start = new Date(String(bodyOverride.from));
      const end = new Date(String(bodyOverride.to));
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(ymd(d));
      }
    } else {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      dates = [ymd(y)];
    }

    // Global default config
    const { data: cfg } = await supabase
      .from("vendx_pos_revenue_config")
      .select("*")
      .eq("source", "loyverse")
      .maybeSingle();

    const gDeposit: string | null = cfg?.deposit_account_id ?? null;
    const gExpense: string | null = cfg?.expense_account_id ?? null;
    const gRevCat: string = cfg?.revenue_category ?? "pos_revenue";
    const gRevSub: string = cfg?.revenue_subcategory ?? "loyverse";
    const gExpCat: string = cfg?.expense_category ?? "cogs";
    const gExpSub: string = cfg?.expense_subcategory ?? "loyverse";
    const gPay: string = cfg?.payment_method ?? "pos";
    const gCogsPay: string = cfg?.cogs_payment_method ?? "internal";

    // Per-store mappings
    const { data: storeRows } = await supabase
      .from("vendx_pos_stores")
      .select("*")
      .eq("source", "loyverse");
    const storeMap = new Map<string, any>();
    (storeRows || []).forEach((s: any) => storeMap.set(String(s.pos_store_id), s));

    const results: any[] = [];

    for (const date of dates) {
      const dayStart = `${date}T00:00:00.000Z`;
      const dayEnd = `${date}T23:59:59.999Z`;

      const { data: receipts, error: rErr } = await supabase
        .from("vendx_pos_receipts")
        .select("id, total_amount, tax_total, discount_total, tip_total, raw_payload, pos_store_id, location_id, stand_id, store_name")
        .eq("source", "loyverse")
        .gte("receipt_date", dayStart)
        .lte("receipt_date", dayEnd);
      if (rErr) throw rErr;

      // Group by pos_store_id (fallback "__none__")
      const groups = new Map<string, any[]>();
      for (const r of receipts || []) {
        const k = String(r.pos_store_id || r.store_name || "__none__");
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(r);
      }

      // Wipe all existing daily entries for this date (across all stores) then reinsert per group
      const incomePrefix = `loyverse_daily_${date}`;
      const expensePrefix = `loyverse_cogs_${date}`;

      const { data: existingIncome } = await supabase
        .from("finance_income")
        .select("id, external_reference")
        .eq("reference_type", "loyverse_daily_revenue")
        .like("external_reference", `${incomePrefix}%`);
      if (existingIncome?.length) {
        const ids = existingIncome.map((x: any) => x.id);
        await supabase.from("finance_account_transactions").delete()
          .eq("reference_type", "income").in("reference_id", ids.map(String));
        await supabase.from("finance_income").delete().in("id", ids);
      }
      const { data: existingExpense } = await supabase
        .from("finance_expenses")
        .select("id, external_reference")
        .like("external_reference", `${expensePrefix}%`);
      if (existingExpense?.length) {
        const ids = existingExpense.map((x: any) => x.id);
        await supabase.from("finance_account_transactions").delete()
          .eq("reference_type", "expense").in("reference_id", ids.map(String));
        await supabase.from("finance_expenses").delete().in("id", ids);
      }

      const perStore: any[] = [];

      for (const [storeKey, list] of groups) {
        let gross = 0, tax = 0, discount = 0, tips = 0, cogs = 0;
        for (const r of list) {
          gross += Number(r.total_amount || 0);
          tax += Number(r.tax_total || 0);
          discount += Number(r.discount_total || 0);
          tips += Number(r.tip_total || 0);
          const rp: any = r.raw_payload || {};
          const lines = Array.isArray(rp.line_items) ? rp.line_items : [];
          for (const li of lines) {
            const qty = Number(li.quantity ?? 1);
            const cost = Number(li.cost ?? li.cost_total ?? 0);
            cogs += li.cost_total != null ? Number(li.cost_total) : cost * qty;
          }
        }
        const netRevenue = gross - tax;
        const m = storeKey !== "__none__" ? storeMap.get(storeKey) : null;
        const depositAccountId = m?.deposit_account_id || gDeposit;
        const expenseAccountId = m?.expense_account_id || gExpense;
        const revSub = m?.revenue_subcategory || gRevSub;
        const expSub = m?.expense_subcategory || gExpSub;
        const payMethod = m?.payment_method || gPay;
        const cogsPay = m?.cogs_payment_method || gCogsPay;
        const locationId = list.find((x: any) => x.location_id)?.location_id || m?.location_id || null;
        const standId = list.find((x: any) => x.stand_id)?.stand_id || m?.stand_id || null;
        const displayName = m?.display_name || (storeKey !== "__none__" ? `POS Store ${storeKey}` : "Loyverse POS (unassigned)");
        const suffix = storeKey === "__none__" ? "_unassigned" : `_${storeKey}`;
        const incomeRef = `${incomePrefix}${suffix}`;
        const expenseRef = `${expensePrefix}${suffix}`;

        let incomeId: string | null = null;
        if (netRevenue > 0) {
          const { data: ins, error: incErr } = await supabase
            .from("finance_income")
            .insert({
              income_date: date,
              source: displayName,
              category: gRevCat,
              subcategory: revSub,
              description: `Loyverse POS daily sales — ${list.length} receipt(s)`,
              amount: netRevenue,
              tax_collected: tax,
              payment_method: payMethod,
              deposited_to_account_id: depositAccountId,
              location_id: locationId,
              stand_id: standId,
              external_reference: incomeRef,
              reference_type: "loyverse_daily_revenue",
              reference_id: null,
              notes: `Store: ${storeKey} | Gross: $${gross.toFixed(2)} | Tax: $${tax.toFixed(2)} | Discounts: $${discount.toFixed(2)} | Tips: $${tips.toFixed(2)}`,
            })
            .select("id").single();
          if (incErr) throw incErr;
          incomeId = ins?.id || null;
        }

        let expenseId: string | null = null;
        if (cogs > 0) {
          const { data: exp, error: expErr } = await supabase
            .from("finance_expenses")
            .insert({
              expense_date: date,
              vendor: `${displayName} (COGS)`,
              category: gExpCat,
              subcategory: expSub,
              description: `Cost of goods sold — ${displayName} daily`,
              amount: cogs,
              payment_method: cogsPay,
              paid_from_account_id: expenseAccountId,
              status: "recorded",
              external_reference: expenseRef,
              notes: `Store: ${storeKey} | ${list.length} receipt(s).`,
            })
            .select("id").single();
          if (expErr) throw expErr;
          expenseId = exp?.id || null;
        }

        perStore.push({
          pos_store_id: storeKey, display_name: displayName,
          receipts: list.length, gross, tax, net_revenue: netRevenue, cogs,
          profit: netRevenue - cogs, location_id: locationId, stand_id: standId,
          income_id: incomeId, expense_id: expenseId,
        });
      }

      const totals = perStore.reduce((acc, s) => ({
        receipts: acc.receipts + s.receipts,
        gross: acc.gross + s.gross,
        tax: acc.tax + s.tax,
        net_revenue: acc.net_revenue + s.net_revenue,
        cogs: acc.cogs + s.cogs,
        profit: acc.profit + s.profit,
      }), { receipts: 0, gross: 0, tax: 0, net_revenue: 0, cogs: 0, profit: 0 });

      results.push({ date, ...totals, stores: perStore });
    }

    return new Response(JSON.stringify({ ok: true, days: results.length, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("loyverse-daily-finance-sync error", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Sync error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
