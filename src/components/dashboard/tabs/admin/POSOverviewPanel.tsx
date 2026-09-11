import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Receipt, Store, CreditCard, RefreshCw, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDisplayDate } from "@/lib/dateUtils";

interface Row {
  id: string;
  total_amount: number;
  tax_total: number;
  tip_total: number;
  discount_total: number;
  payment_method: string | null;
  store_name: string | null;
  pos_store_id: string | null;
  user_id: string | null;
  points_earned: number;
  receipt_date: string;
}

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const POSOverviewPanel = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [range, setRange] = useState("30");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [storeNames, setStoreNames] = useState<Record<string, string>>({});
  const [postedTotal, setPostedTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000).toISOString();
    const [{ data }, { data: state }, { data: stores }, { data: incomeRows }] = await Promise.all([
      supabase
        .from("vendx_pos_receipts")
        .select("id,total_amount,tax_total,tip_total,discount_total,payment_method,store_name,pos_store_id,user_id,points_earned,receipt_date")
        .gte("receipt_date", since)
        .order("receipt_date", { ascending: false }),
      supabase.from("vendx_integration_state").select("value").eq("key", "loyverse_last_sync").maybeSingle(),
      supabase.from("vendx_pos_stores").select("pos_store_id,display_name"),
      supabase
        .from("finance_income")
        .select("amount")
        .eq("reference_type", "loyverse_daily_revenue")
        .gte("income_date", since.slice(0, 10)),
    ]);
    setRows((data as Row[]) || []);
    setPostedTotal(((incomeRows as any[]) || []).reduce((s, r) => s + Number(r.amount || 0), 0));
    setLastSync((state as any)?.value ?? null);
    const map: Record<string, string> = {};
    (stores || []).forEach((s: any) => { map[String(s.pos_store_id)] = s.display_name; });
    setStoreNames(map);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range]);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("loyverse-sync", { body: {} });
      if (error) throw error;
      toast.success(`Synced ${data?.processed ?? 0} receipt(s)`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const stats = useMemo(() => {
    const gross = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const tax = rows.reduce((s, r) => s + Number(r.tax_total || 0), 0);
    const tips = rows.reduce((s, r) => s + Number(r.tip_total || 0), 0);
    const discounts = rows.reduce((s, r) => s + Number(r.discount_total || 0), 0);
    const matched = rows.filter((r) => r.user_id).length;
    const points = rows.reduce((s, r) => s + Number(r.points_earned || 0), 0);

    const byMethod: Record<string, { count: number; total: number }> = {};
    const byStore: Record<string, { count: number; total: number }> = {};
    rows.forEach((r) => {
      const m = r.payment_method || "Unknown";
      byMethod[m] = { count: (byMethod[m]?.count || 0) + 1, total: (byMethod[m]?.total || 0) + Number(r.total_amount || 0) };
      const key = String(r.pos_store_id || r.store_name || "unassigned");
      const label = storeNames[key] || (key === "unassigned" ? "Unassigned" : `Store ${key.slice(0, 8)}`);
      byStore[label] = { count: (byStore[label]?.count || 0) + 1, total: (byStore[label]?.total || 0) + Number(r.total_amount || 0) };
    });

    return {
      gross, tax, tips, discounts, matched, points,
      net: gross - tax,
      count: rows.length,
      avg: rows.length ? gross / rows.length : 0,
      byMethod: Object.entries(byMethod).sort((a, b) => b[1].total - a[1].total),
      byStore: Object.entries(byStore).sort((a, b) => b[1].total - a[1].total),
    };
  }, [rows, storeNames]);

  const kpis = [
    { label: "Gross Sales", value: money(stats.gross), icon: DollarSign, sub: `${stats.count} receipts` },
    { label: "Net Revenue", value: money(stats.net), icon: TrendingUp, sub: `${money(stats.tax)} tax collected` },
    { label: "Average Ticket", value: money(stats.avg), icon: Receipt, sub: `${money(stats.tips)} tips` },
    { label: "Matched Customers", value: `${stats.matched}/${stats.count}`, icon: Users, sub: `${stats.points} points awarded` },
    { label: "Posted to Finance", value: money(postedTotal), icon: DollarSign, sub: "shown on the financial tabs" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> PayPal Zettle POS
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                All in-person sales in one place. Sales flow in through the connected PayPal Zettle register feed, so each
                sale is counted only once.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Last sync: {lastSync ? formatDisplayDate(lastSync) : "never"} · auto-syncs every 5 minutes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={syncNow} disabled={syncing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <k.icon className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold mt-1">{loading ? "—" : k.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-4 h-4" /> Payment Methods</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.byMethod.length === 0 && <p className="text-sm text-muted-foreground">No sales in this period.</p>}
            {stats.byMethod.map(([method, v]) => (
              <div key={method} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{method}</Badge>
                  <span className="text-muted-foreground text-xs">{v.count} sales</span>
                </div>
                <span className="font-semibold">{money(v.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Store className="w-4 h-4" /> Store Performance</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.byStore.length === 0 && <p className="text-sm text-muted-foreground">No sales in this period.</p>}
            {stats.byStore.map(([store, v]) => (
              <div key={store} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                <div>
                  <p className="font-medium">{store}</p>
                  <p className="text-xs text-muted-foreground">{v.count} receipts · avg {money(v.total / v.count)}</p>
                </div>
                <span className="font-semibold">{money(v.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default POSOverviewPanel;
