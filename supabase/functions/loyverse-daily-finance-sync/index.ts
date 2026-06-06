// Loyverse Daily Finance Sync — aggregates POS receipts for a given day
// and posts one revenue (finance_income) + one COGS (finance_expenses) entry.
// Idempotent: re-running for the same day replaces the existing entries.
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
    // Determine target date(s)
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
      // default: yesterday
      const y = new Date();
      y.setDate(y.getDate() - 1);
      dates = [ymd(y)];
    }

    // Load POS revenue config (deposit account, expense account, categories) for loyverse
    const { data: cfg } = await supabase
      .from("vendx_pos_revenue_config")
      .select("*")
      .eq("source", "loyverse")
      .maybeSingle();

    const depositAccountId: string | null = cfg?.deposit_account_id ?? null;
    const expenseAccountId: string | null = cfg?.expense_account_id ?? null;
    const revenueCategory: string = cfg?.revenue_category ?? "pos_revenue";
    const revenueSubcategory: string = cfg?.revenue_subcategory ?? "loyverse";
    const expenseCategory: string = cfg?.expense_category ?? "cogs";
    const expenseSubcategory: string = cfg?.expense_subcategory ?? "loyverse";
    const paymentMethod: string = cfg?.payment_method ?? "pos";

    const results: any[] = [];

    for (const date of dates) {
      const dayStart = `${date}T00:00:00.000Z`;
      const dayEnd = `${date}T23:59:59.999Z`;

      // Pull all receipts for the date
      const { data: receipts, error: rErr } = await supabase
        .from("vendx_pos_receipts")
        .select("id, total_amount, tax_total, discount_total, tip_total, raw_payload")
        .eq("source", "loyverse")
        .gte("receipt_date", dayStart)
        .lte("receipt_date", dayEnd);

      if (rErr) throw rErr;

      const count = receipts?.length ?? 0;
      let gross = 0;
      let tax = 0;
      let discount = 0;
      let tips = 0;
      let cogs = 0;

      for (const r of receipts || []) {
        gross += Number(r.total_amount || 0);
        tax += Number(r.tax_total || 0);
        discount += Number(r.discount_total || 0);
        tips += Number(r.tip_total || 0);

        // Sum line-item cost from raw payload (Loyverse provides `cost` per line item)
        const rp: any = r.raw_payload || {};
        const lines = Array.isArray(rp.line_items) ? rp.line_items : [];
        for (const li of lines) {
          const qty = Number(li.quantity ?? 1);
          const cost = Number(li.cost ?? li.cost_total ?? 0);
          // If only unit cost is provided, multiply by quantity
          cogs += li.cost_total != null ? Number(li.cost_total) : cost * qty;
        }
      }

      const netRevenue = gross - tax; // exclude sales tax from income

      const incomeRef = `loyverse_daily_${date}`;
      const expenseRef = `loyverse_cogs_${date}`;

      // --- Revenue (finance_income) ---
      // Remove any existing daily entries (and their auto-posted account txn)
      const { data: existingIncome } = await supabase
        .from("finance_income")
        .select("id")
        .eq("reference_type", "loyverse_daily_revenue")
        .eq("external_reference", incomeRef);

      if (existingIncome && existingIncome.length) {
        const ids = existingIncome.map((x: any) => x.id);
        await supabase
          .from("finance_account_transactions")
          .delete()
          .eq("reference_type", "income")
          .in("reference_id", ids.map(String));
        await supabase.from("finance_income").delete().in("id", ids);
      }

      let incomeId: string | null = null;
      if (netRevenue > 0) {
        const { data: ins, error: incErr } = await supabase
          .from("finance_income")
          .insert({
            income_date: date,
            source: "Loyverse POS",
            category: revenueCategory,
            subcategory: revenueSubcategory,
            description: `Loyverse POS daily sales — ${count} receipt(s)`,
            amount: netRevenue,
            tax_collected: tax,
            payment_method: paymentMethod,
            deposited_to_account_id: depositAccountId,
            external_reference: incomeRef,
            reference_type: "loyverse_daily_revenue",
            reference_id: null,
            notes: `Gross: $${gross.toFixed(2)} | Tax: $${tax.toFixed(2)} | Discounts: $${discount.toFixed(2)} | Tips: $${tips.toFixed(2)}`,
          })
          .select("id")
          .single();
        if (incErr) throw incErr;
        incomeId = ins?.id || null;
      }

      // --- COGS (finance_expenses) ---
      // Lookup existing by external_reference and delete (trigger blocks duplicate insert)
      const { data: existingExpense } = await supabase
        .from("finance_expenses")
        .select("id")
        .eq("external_reference", expenseRef);

      if (existingExpense && existingExpense.length) {
        const ids = existingExpense.map((x: any) => x.id);
        await supabase
          .from("finance_account_transactions")
          .delete()
          .eq("reference_type", "expense")
          .in("reference_id", ids.map(String));
        await supabase.from("finance_expenses").delete().in("id", ids);
      }

      let expenseId: string | null = null;
      if (cogs > 0) {
        const { data: exp, error: expErr } = await supabase
          .from("finance_expenses")
          .insert({
            expense_date: date,
            vendor: "Loyverse POS (COGS)",
            category: expenseCategory,
            subcategory: expenseSubcategory,
            description: `Cost of goods sold — Loyverse POS daily`,
            amount: cogs,
            payment_method: "internal",
            paid_from_account_id: expenseAccountId,
            status: "recorded",
            external_reference: expenseRef,
            notes: `Auto-generated from ${count} Loyverse receipt(s).`,
          })
          .select("id")
          .single();
        if (expErr) throw expErr;
        expenseId = exp?.id || null;
      }

      const profit = netRevenue - cogs;
      results.push({
        date, receipts: count,
        gross, tax, discount, tips,
        net_revenue: netRevenue, cogs, profit,
        income_id: incomeId, expense_id: expenseId,
      });
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
