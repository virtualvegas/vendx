import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle, Clock, FileText, Gamepad2, ShoppingBag, Wrench, Music,
  Megaphone, Banknote, Package, CreditCard, Download,
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

type Kind =
  | "ext_invoice" | "custom_arcade" | "store_order" | "income_pending"
  | "beat_purchase" | "ad_booking" | "payout" | "ecosnack" | "branded_game" | "merchant_session";

type Row = {
  id: string;
  kind: Kind;
  reference: string;
  party: string;
  description: string;
  amount: number;
  due_date: string | null;
  created_at: string;
  status: string;
};

const kindMeta: Record<Kind, { label: string; color: string; icon: any }> = {
  ext_invoice:    { label: "External Invoice",  color: "bg-blue-500/20 text-blue-300 border-blue-500/40",       icon: Wrench },
  custom_arcade:  { label: "Custom Arcade",     color: "bg-purple-500/20 text-purple-300 border-purple-500/40", icon: Gamepad2 },
  store_order:    { label: "Store Order",       color: "bg-amber-500/20 text-amber-300 border-amber-500/40",    icon: ShoppingBag },
  income_pending: { label: "Pending Income",    color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", icon: FileText },
  beat_purchase:  { label: "Beat Purchase",     color: "bg-pink-500/20 text-pink-300 border-pink-500/40",       icon: Music },
  ad_booking:     { label: "Ad Booking",        color: "bg-orange-500/20 text-orange-300 border-orange-500/40", icon: Megaphone },
  payout:         { label: "Payout (owed)",     color: "bg-red-500/20 text-red-300 border-red-500/40",          icon: Banknote },
  ecosnack:       { label: "EcoSnack Locker",   color: "bg-teal-500/20 text-teal-300 border-teal-500/40",       icon: Package },
  branded_game:   { label: "Branded Game",      color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40", icon: Gamepad2 },
  merchant_session:{label: "Merchant Session",  color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",       icon: CreditCard },
};

const PENDING_STORE_ORDER_STATUSES = ["pending", "awaiting_payment", "payment_pending", "processing"];
const PENDING_AD_STATUSES = ["pending", "pending_payment", "awaiting_payment"];
const PENDING_BRANDED_GAME_STATUSES = ["pending", "quoted", "approved", "in_production"];

export const PendingPaymentsTab = () => {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");

  const { data: extInvoices = [] } = useQuery({
    queryKey: ["pending-ext-invoices"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase
        .from("vendx_external_service_invoices" as any)
        .select("id, invoice_number, total, status, due_date, created_at, client:vendx_external_clients(company_name)")
        .in("status", ["draft", "sent", "overdue", "partial"])
        .order("created_at", { ascending: false });
      return (data as any) || [];
    },
  });

  const { data: customArcade = [] } = useQuery({
    queryKey: ["pending-custom-arcade"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase
        .from("vendx_custom_arcade_requests" as any)
        .select("id, request_number, full_name, email, quoted_price, status, payment_status, invoice_due_date, created_at")
        .gt("quoted_price", 0)
        .neq("payment_status", "paid")
        .in("status", ["quoted", "accepted"])
        .order("created_at", { ascending: false });
      return (data as any) || [];
    },
  });

  const { data: storeOrders = [] } = useQuery({
    queryKey: ["pending-store-orders"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase
        .from("store_orders" as any)
        .select("id, order_number, customer_email, customer_name, total, status, created_at")
        .in("status", PENDING_STORE_ORDER_STATUSES)
        .order("created_at", { ascending: false })
        .limit(500);
      return (data as any) || [];
    },
  });

  const { data: pendingIncome = [] } = useQuery({
    queryKey: ["pending-finance-income"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase
        .from("finance_income" as any)
        .select("id, source, description, amount, status, income_date, external_reference, created_at")
        .in("status", ["pending", "awaiting"])
        .order("income_date", { ascending: false })
        .limit(500);
      return (data as any) || [];
    },
  });

  const { data: beatPurchases = [] } = useQuery({
    queryKey: ["pending-beat-purchases"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase
        .from("beat_purchases" as any)
        .select("id, amount, payment_status, buyer_email, beat_id, created_at, beat_tracks(title)")
        .in("payment_status", ["pending", "processing", "awaiting"])
        .order("created_at", { ascending: false })
        .limit(500);
      return (data as any) || [];
    },
  });

  const { data: adBookings = [] } = useQuery({
    queryKey: ["pending-ad-bookings"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase
        .from("ad_bookings" as any)
        .select("id, total_amount, status, advertiser_email, advertiser_name, created_at, ad_locations(name)")
        .in("status", PENDING_AD_STATUSES)
        .order("created_at", { ascending: false })
        .limit(500);
      return (data as any) || [];
    },
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["pending-payouts"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase
        .from("payouts" as any)
        .select("id, amount, status, period_start, period_end, scheduled_date, recipient_id, recipient_type, created_at")
        .in("status", ["pending", "scheduled", "processing", "approved"])
        .order("created_at", { ascending: false })
        .limit(500);
      return (data as any) || [];
    },
  });

  const { data: ecosnack = [] } = useQuery({
    queryKey: ["pending-ecosnack"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase
        .from("ecosnack_locker_purchases" as any)
        .select("id, amount, payment_status, customer_email, locker_number, machine_code, item_name, created_at")
        .in("payment_status", ["pending", "processing", "awaiting"])
        .order("created_at", { ascending: false })
        .limit(500);
      return (data as any) || [];
    },
  });

  const { data: brandedGames = [] } = useQuery({
    queryKey: ["pending-branded-games"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase
        .from("branded_game_requests" as any)
        .select("id, company_name, contact_email, status, quoted_price, target_launch_date, created_at")
        .in("status", PENDING_BRANDED_GAME_STATUSES)
        .order("created_at", { ascending: false })
        .limit(500);
      return (data as any) || [];
    },
  });

  const { data: merchantSessions = [] } = useQuery({
    queryKey: ["pending-merchant-sessions"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase
        .from("vendx_merchant_payment_sessions" as any)
        .select("id, session_token, amount, status, customer_email, description, expires_at, created_at, merchant:vendx_merchants(name)")
        .in("status", ["pending", "open", "awaiting_payment"])
        .order("created_at", { ascending: false })
        .limit(500);
      return (data as any) || [];
    },
  });

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const i of extInvoices) out.push({
      id: i.id, kind: "ext_invoice", reference: i.invoice_number || i.id.slice(0, 8),
      party: i.client?.company_name || "—", description: `Invoice (${i.status})`,
      amount: Number(i.total) || 0, due_date: i.due_date, created_at: i.created_at, status: i.status,
    });
    for (const c of customArcade) out.push({
      id: c.id, kind: "custom_arcade", reference: c.request_number,
      party: c.full_name || c.email || "—", description: `Custom arcade — ${c.status}`,
      amount: Number(c.quoted_price) || 0, due_date: c.invoice_due_date, created_at: c.created_at, status: c.payment_status || "unpaid",
    });
    for (const o of storeOrders) out.push({
      id: o.id, kind: "store_order", reference: o.order_number || o.id.slice(0, 8),
      party: o.customer_name || o.customer_email || "—", description: `Store order (${o.status})`,
      amount: Number(o.total) || 0, due_date: null, created_at: o.created_at, status: o.status,
    });
    for (const p of pendingIncome) out.push({
      id: p.id, kind: "income_pending", reference: p.external_reference || p.id.slice(0, 8),
      party: p.source || "—", description: p.description || "Pending income",
      amount: Number(p.amount) || 0, due_date: p.income_date, created_at: p.created_at, status: p.status || "pending",
    });
    for (const b of beatPurchases) out.push({
      id: b.id, kind: "beat_purchase", reference: b.id.slice(0, 8),
      party: b.buyer_email || "—", description: b.beat_tracks?.title || "Beat purchase",
      amount: Number(b.amount) || 0, due_date: null, created_at: b.created_at, status: b.payment_status,
    });
    for (const a of adBookings) out.push({
      id: a.id, kind: "ad_booking", reference: a.id.slice(0, 8),
      party: a.advertiser_name || a.advertiser_email || "—",
      description: `Ad: ${a.ad_locations?.name || "Location"}`,
      amount: Number(a.total_amount) || 0, due_date: null, created_at: a.created_at, status: a.status,
    });
    for (const p of payouts) out.push({
      id: p.id, kind: "payout", reference: p.id.slice(0, 8),
      party: p.recipient_type ? `${p.recipient_type} payout` : "Payout",
      description: `${p.period_start || ""} → ${p.period_end || ""}`.trim(),
      amount: Number(p.amount) || 0, due_date: p.scheduled_date, created_at: p.created_at, status: p.status,
    });
    for (const e of ecosnack) out.push({
      id: e.id, kind: "ecosnack", reference: `${e.machine_code || "?"}#${e.locker_number ?? "?"}`,
      party: e.customer_email || "—", description: e.item_name || "Locker purchase",
      amount: Number(e.amount) || 0, due_date: null, created_at: e.created_at, status: e.payment_status,
    });
    for (const g of brandedGames) out.push({
      id: g.id, kind: "branded_game", reference: g.id.slice(0, 8),
      party: g.company_name || g.contact_email || "—",
      description: `Branded game — ${g.status}`,
      amount: Number(g.quoted_price) || 0, due_date: g.target_launch_date, created_at: g.created_at, status: g.status,
    });
    for (const m of merchantSessions) out.push({
      id: m.id, kind: "merchant_session", reference: (m.session_token || m.id).toString().slice(0, 12),
      party: m.merchant?.name || m.customer_email || "—",
      description: m.description || "Merchant payment",
      amount: Number(m.amount) || 0, due_date: m.expires_at, created_at: m.created_at, status: m.status,
    });
    return out.sort((a, b) => {
      const ad = a.due_date || a.created_at;
      const bd = b.due_date || b.created_at;
      return ad.localeCompare(bd);
    });
  }, [extInvoices, customArcade, storeOrders, pendingIncome, beatPurchases, adBookings, payouts, ecosnack, brandedGames, merchantSessions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        r.reference.toLowerCase().includes(q) ||
        r.party.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    });
  }, [rows, search, kindFilter]);

  const totals = useMemo(() => {
    const byKind: Record<string, { count: number; amount: number }> = {};
    let overdueAmount = 0;
    const today = new Date();
    for (const r of rows) {
      byKind[r.kind] = byKind[r.kind] || { count: 0, amount: 0 };
      byKind[r.kind].count += 1;
      byKind[r.kind].amount += r.amount;
      if (r.due_date && new Date(r.due_date) < today) overdueAmount += r.amount;
    }
    return { total: rows.reduce((s, r) => s + r.amount, 0), byKind, overdueAmount, count: rows.length };
  }, [rows]);

  const exportCsv = () => {
    const header = ["Type", "Reference", "Party", "Description", "Amount", "Due Date", "Status", "Created"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push([
        kindMeta[r.kind].label,
        r.reference,
        r.party.replace(/,/g, ";"),
        r.description.replace(/,/g, ";"),
        r.amount.toFixed(2),
        r.due_date || "",
        r.status,
        r.created_at,
      ].map(x => `"${String(x).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pending-payments-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> Pending Invoices & Payments</h2>
          <p className="text-sm text-muted-foreground">All outstanding amounts across every service, awaiting payment or settlement.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5"><Download className="w-3.5 h-3.5" /> Export CSV</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Outstanding</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-400">${totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Overdue</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-400">${totals.overdueAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Open Items</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals.count}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Payouts Owed</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-300">${(totals.byKind.payout?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {(Object.keys(kindMeta) as Kind[]).map(k => {
          const t = totals.byKind[k];
          const meta = kindMeta[k];
          const Icon = meta.icon;
          return (
            <button
              key={k}
              onClick={() => setKindFilter(kindFilter === k ? "all" : k)}
              className={`text-left p-2.5 rounded-md border transition-colors ${kindFilter === k ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground truncate">{meta.label}</span>
              </div>
              <div className="text-sm font-bold">${(t?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <div className="text-[10px] text-muted-foreground">{t?.count || 0} item{t?.count === 1 ? "" : "s"}</div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">All Open Invoices & Payments</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="Search ref, party, description..." value={search} onChange={e => setSearch(e.target.value)} className="w-64 h-9" />
              <Select value={kindFilter} onValueChange={setKindFilter}>
                <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {(Object.keys(kindMeta) as Kind[]).map(k => (
                    <SelectItem key={k} value={k}>{kindMeta[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {rows.length === 0 ? "Nothing pending. All invoices are paid 🎉" : "No matches for current filters."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => {
                    const meta = kindMeta[r.kind];
                    const Icon = meta.icon;
                    const overdue = r.due_date && new Date(r.due_date) < new Date();
                    const daysUntil = r.due_date ? differenceInDays(parseISO(r.due_date), new Date()) : null;
                    return (
                      <TableRow key={`${r.kind}-${r.id}`}>
                        <TableCell><Badge className={meta.color}><Icon className="w-3 h-3 mr-1" />{meta.label}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                        <TableCell>{r.party}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{r.description}</TableCell>
                        <TableCell className="text-right font-semibold">${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-xs">
                          {r.due_date ? (
                            <span className={overdue ? "text-red-400 font-semibold" : ""}>
                              {format(parseISO(r.due_date), "MMM d, yyyy")}
                              {daysUntil !== null && (
                                <span className="block text-[10px] opacity-70">
                                  {overdue ? `${Math.abs(daysUntil!)}d overdue` : `in ${daysUntil}d`}
                                </span>
                              )}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell><Badge variant="outline" className="capitalize text-xs">{r.status}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingPaymentsTab;
