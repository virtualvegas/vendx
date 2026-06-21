import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Clock, FileText, Gamepad2, ShoppingBag, Wrench } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

type Row = {
  id: string;
  kind: "ext_invoice" | "custom_arcade" | "store_order" | "income_pending";
  reference: string;
  party: string;
  description: string;
  amount: number;
  due_date: string | null;
  created_at: string;
  status: string;
};

const kindMeta: Record<Row["kind"], { label: string; color: string; icon: any }> = {
  ext_invoice: { label: "External Service Invoice", color: "bg-blue-500/20 text-blue-300 border-blue-500/40", icon: Wrench },
  custom_arcade: { label: "Custom Arcade", color: "bg-purple-500/20 text-purple-300 border-purple-500/40", icon: Gamepad2 },
  store_order: { label: "Store Order", color: "bg-amber-500/20 text-amber-300 border-amber-500/40", icon: ShoppingBag },
  income_pending: { label: "Pending Income", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", icon: FileText },
};

export const PendingPaymentsTab = () => {
  const { data: extInvoices = [] } = useQuery({
    queryKey: ["pending-ext-invoices"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase
        .from("vendx_external_service_invoices" as any)
        .select("id, invoice_number, total, status, due_date, created_at, client:vendx_external_clients(company_name)")
        .in("status", ["draft", "sent", "overdue"])
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
        .select("id, order_number, customer_email, customer_name, total, status, payment_status, created_at")
        .in("payment_status", ["pending", "awaiting", "processing"])
        .order("created_at", { ascending: false })
        .limit(200);
      return (data as any) || [];
    },
  });

  const { data: pendingIncome = [] } = useQuery({
    queryKey: ["pending-finance-income"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase
        .from("finance_income" as any)
        .select("id, source, description, amount, status, income_date, external_reference, created_at")
        .eq("status", "pending")
        .order("income_date", { ascending: false })
        .limit(200);
      return (data as any) || [];
    },
  });

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const i of extInvoices) out.push({
      id: i.id, kind: "ext_invoice", reference: i.invoice_number,
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
      party: o.customer_name || o.customer_email || "—", description: `Store order (${o.payment_status})`,
      amount: Number(o.total) || 0, due_date: null, created_at: o.created_at, status: o.payment_status,
    });
    for (const p of pendingIncome) out.push({
      id: p.id, kind: "income_pending", reference: p.external_reference || p.id.slice(0, 8),
      party: p.source || "—", description: p.description || "Pending income",
      amount: Number(p.amount) || 0, due_date: p.income_date, created_at: p.created_at, status: "pending",
    });
    return out.sort((a, b) => (a.due_date || a.created_at).localeCompare(b.due_date || b.created_at));
  }, [extInvoices, customArcade, storeOrders, pendingIncome]);

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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> Pending Invoices & Payments</h2>
        <p className="text-sm text-muted-foreground">All outstanding amounts awaiting payment across the business.</p>
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
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">External Invoices</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${(totals.byKind.ext_invoice?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Open Invoices & Payments</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Nothing pending. All invoices are paid 🎉</div>
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
                  {rows.map(r => {
                    const meta = kindMeta[r.kind];
                    const Icon = meta.icon;
                    const overdue = r.due_date && new Date(r.due_date) < new Date();
                    const daysUntil = r.due_date ? differenceInDays(parseISO(r.due_date), new Date()) : null;
                    return (
                      <TableRow key={`${r.kind}-${r.id}`}>
                        <TableCell><Badge className={meta.color}><Icon className="w-3 h-3 mr-1" />{meta.label}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                        <TableCell>{r.party}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.description}</TableCell>
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
