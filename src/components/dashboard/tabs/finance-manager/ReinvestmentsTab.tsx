import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Package, Percent } from "lucide-react";
import { format, startOfYear, startOfMonth } from "date-fns";

export const ReinvestmentsTab = () => {
  const { data: reinvestments } = useQuery({
    queryKey: ["finance-reinvestments"],
    queryFn: async () => (await supabase.from("finance_inventory_reinvestments" as any).select("*").order("reinvestment_date", { ascending: false }).limit(200)).data || [],
  });

  const { data: yearRevenue } = useQuery({
    queryKey: ["reinvest-year-revenue"],
    queryFn: async () => {
      const yearStart = startOfYear(new Date()).toISOString();
      const { data } = await supabase.from("synced_transactions").select("amount").eq("status", "completed").eq("transaction_type", "revenue").gte("created_at", yearStart);
      return (data || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
    },
  });

  const stats = useMemo(() => {
    const ytd = (reinvestments || []).filter((r: any) => new Date(r.reinvestment_date) >= startOfYear(new Date())).reduce((s: number, r: any) => s + Number(r.amount), 0);
    const mtd = (reinvestments || []).filter((r: any) => new Date(r.reinvestment_date) >= startOfMonth(new Date())).reduce((s: number, r: any) => s + Number(r.amount), 0);
    const lifetime = (reinvestments || []).reduce((s: number, r: any) => s + Number(r.amount), 0);
    const pctOfRev = (yearRevenue || 0) > 0 ? (ytd / (yearRevenue || 1)) * 100 : 0;
    return { ytd, mtd, lifetime, pctOfRev };
  }, [reinvestments, yearRevenue]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">YTD Reinvestment</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${stats.ytd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">This Month</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${stats.mtd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">% of YTD Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold flex items-center gap-1"><Percent className="h-5 w-5" />{stats.pctOfRev.toFixed(1)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Lifetime</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${stats.lifetime.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Inventory Reinvestments</CardTitle>
          <p className="text-sm text-muted-foreground">Money cycled back into restocking inventory. Auto-tracked when expenses are flagged as "Inventory reinvestment".</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Units</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {(reinvestments || []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{format(new Date(r.reinvestment_date), "MMM d, yyyy")}</TableCell>
                  <TableCell>{r.description || "—"}</TableCell>
                  <TableCell>{r.units_purchased || "—"}</TableCell>
                  <TableCell className="font-mono">${Number(r.amount).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {(!reinvestments || reinvestments.length === 0) && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No reinvestments logged yet. Mark expenses as "Inventory reinvestment" to track them here.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
