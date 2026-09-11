// Lists PayPal Zettle registers available for linking.
// Uses the native Zettle API when Zettle credentials are configured,
// otherwise falls back to the connected register feed API token.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchZettlePurchases, purchaseRegisterId, purchaseRegisterName } from "../_shared/zettle.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Register = {
  kind: "store" | "device" | "register";
  id: string;
  name: string;
  store_id: string | null;
  store_name: string | null;
  address: string | null;
  activated: boolean;
  linked: boolean;
  linked_name: string | null;
  receipts: number;
  total: number;
  last_sale_at: string | null;
  last_receipt_number: string | null;
  sample_items: string[];
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // --- auth: must be a signed-in privileged user ---
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "").trim();
  if (!jwt) return json({ error: "Unauthorized" }, 401);

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  const allowed = new Set([
    "super_admin",
    "global_operations_manager",
    "finance_accounting",
    "regional_manager",
  ]);
  if (!(roles || []).some((r: any) => allowed.has(r.role))) {
    return json({ error: "Forbidden" }, 403);
  }

  // ---- what we already know locally (used to identify each register) ----
  const { data: linkedRows } = await admin
    .from("vendx_pos_stores")
    .select("pos_store_id, display_name, is_active");
  const linkedMap = new Map<string, string>();
  (linkedRows || []).forEach((l: any) =>
    linkedMap.set(String(l.pos_store_id), l.display_name || "")
  );

  const { data: receiptRows } = await admin
    .from("vendx_pos_receipts")
    .select("pos_store_id, store_name, total_amount, receipt_date, receipt_number, id")
    .not("pos_store_id", "is", null)
    .order("receipt_date", { ascending: false })
    .limit(5000);

  type Stat = {
    receipts: number; total: number; last_sale_at: string | null;
    last_receipt_number: string | null; store_name: string | null; recent_ids: string[];
  };
  const stats = new Map<string, Stat>();
  (receiptRows || []).forEach((r: any) => {
    const k = String(r.pos_store_id);
    const cur = stats.get(k) || {
      receipts: 0, total: 0, last_sale_at: null, last_receipt_number: null,
      store_name: null, recent_ids: [],
    };
    cur.receipts += 1;
    cur.total += Number(r.total_amount || 0);
    if (!cur.last_sale_at || (r.receipt_date && r.receipt_date > cur.last_sale_at)) {
      cur.last_sale_at = r.receipt_date;
      cur.last_receipt_number = r.receipt_number || null;
      cur.store_name = r.store_name || cur.store_name;
    }
    if (cur.recent_ids.length < 3) cur.recent_ids.push(r.id);
    stats.set(k, cur);
  });

  // A few item names per register make it obvious which counter it is
  const allRecent = Array.from(stats.values()).flatMap((s) => s.recent_ids);
  const itemsByRegister = new Map<string, string[]>();
  if (allRecent.length) {
    const { data: items } = await admin
      .from("vendx_pos_receipt_items")
      .select("receipt_id, item_name")
      .in("receipt_id", allRecent.slice(0, 300));
    const receiptToRegister = new Map<string, string>();
    stats.forEach((s, k) => s.recent_ids.forEach((id) => receiptToRegister.set(id, k)));
    (items || []).forEach((it: any) => {
      const k = receiptToRegister.get(it.receipt_id);
      if (!k) return;
      const arr = itemsByRegister.get(k) || [];
      if (arr.length < 4 && it.item_name && !arr.includes(it.item_name)) arr.push(it.item_name);
      itemsByRegister.set(k, arr);
    });
  }

  const decorate = (r: Omit<Register, "linked" | "linked_name" | "receipts" | "total" | "last_sale_at" | "last_receipt_number" | "sample_items">): Register => {
    const s = stats.get(r.id);
    return {
      ...r,
      store_name: r.store_name || s?.store_name || null,
      linked: linkedMap.has(r.id),
      linked_name: linkedMap.get(r.id) || null,
      receipts: s?.receipts || 0,
      total: Number((s?.total || 0).toFixed(2)),
      last_sale_at: s?.last_sale_at || null,
      last_receipt_number: s?.last_receipt_number || null,
      sample_items: itemsByRegister.get(r.id) || [],
    };
  };

  try {
    const page = await fetchZettlePurchases({
      startDate: new Date(Date.now() - 90 * 86400000).toISOString(),
      endDate: new Date().toISOString(),
      limit: 1000,
    });
    const discovered = new Map<string, { count: number; last: string | null; name: string | null }>();
    for (const purchase of page.purchases) {
      const id = purchaseRegisterId(purchase);
      if (!id) continue;
      const current = discovered.get(id) || { count: 0, last: null, name: purchaseRegisterName(purchase) };
      current.count += 1;
      current.name = current.name || purchaseRegisterName(purchase);
      if (typeof purchase.timestamp === "string" && (!current.last || purchase.timestamp > current.last)) {
        current.last = purchase.timestamp;
      }
      discovered.set(id, current);
    }

    const registers: Register[] = Array.from(discovered.entries()).map(([id, activity]) =>
      decorate({
        kind: "register",
        id,
        name: linkedMap.get(id) || activity.name || `Zettle register ${id.slice(0, 8)}`,
        store_id: null,
        store_name: null,
        address: activity.last ? `Last Zettle sale ${new Date(activity.last).toLocaleDateString()}` : null,
        activated: true,
      })
    );

    const known = new Set(registers.map((register) => register.id));
    stats.forEach((stat, id) => {
      if (known.has(id)) return;
      registers.push(decorate({
        kind: "register",
        id,
        name: linkedMap.get(id) || stat.store_name || `Zettle source ${id}`,
        store_id: null,
        store_name: stat.store_name,
        address: null,
        activated: true,
      }));
    });

    registers.sort((a, b) => b.receipts - a.receipts || a.name.localeCompare(b.name));
    return json({ provider: "zettle", registers });
  } catch (e: any) {
    return json({ error: e?.message || "Failed to load registers" }, 500);
  }
});
