import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Download, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";

const toCSV = (rows: any[], filename: string) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
};

export const ReportsTab = () => {
  const [from, setFrom] = useState(format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const pnl = useQuery({
    queryKey: ["pnl", from, to],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_pnl_report" as any, { p_from: from, p_to: to });
      return (data || []) as any[];
    },
  });

  const cash = useQuery({
    queryKey: ["cashflow", from, to],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_cash_flow_report" as any, { p_from: from, p_to: to });
      return (data || []) as any[];
    },
  });

  const bs = useQuery({
    queryKey: ["balance-sheet", to],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_balance_sheet_report" as any, { p_as_of: to });
      return (data || []) as any[];
    },
  });

  const income = (pnl.data || []).filter(r => r.kind === "income");
  const expense = (pnl.data || []).filter(r => r.kind === "expense");
  const totalInc = income.reduce((s, r) => s + Number(r.total), 0);
  const totalExp = expense.reduce((s, r) => s + Number(r.total), 0);
  const netProfit = totalInc - totalExp;

  const bsBy = (section: string) => (bs.data || []).filter((r: any) => r.section === section);
  const bsSum = (section: string) => bsBy(section).reduce((s: number, r: any) => s + Number(r.amount), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <Button variant="outline" onClick={() => window.print()}><FileText className="h-4 w-4 mr-1" />Print / PDF</Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="pnl">
        <TabsList>
          <TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="cash">Cash Flow</TabsTrigger>
          <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Revenue</div><div className="text-2xl font-bold text-green-500">${totalInc.toLocaleString()}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Expenses</div><div className="text-2xl font-bold text-red-500">${totalExp.toLocaleString()}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Net Profit</div><div className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-500" : "text-red-500"}`}>${netProfit.toLocaleString()}</div></CardContent></Card>
          </div>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-green-500" />Income</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => toCSV(income, `income_${from}_${to}.csv`)}><Download className="h-4 w-4 mr-1" />CSV</Button>
            </CardHeader>
            <CardContent>
              {pnl.isLoading ? <Loader2 className="animate-spin" /> :
                <table className="w-full text-sm">
                  <thead className="border-b"><tr><th className="text-left py-1">Category</th><th className="text-left">Subcategory</th><th className="text-right">Total</th></tr></thead>
                  <tbody>
                    {income.map((r, i) => <tr key={i} className="border-b border-border/30"><td className="py-1">{r.category}</td><td>{r.subcategory || "—"}</td><td className="text-right">${Number(r.total).toLocaleString()}</td></tr>)}
                  </tbody>
                </table>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-red-500" />Expenses</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => toCSV(expense, `expenses_${from}_${to}.csv`)}><Download className="h-4 w-4 mr-1" />CSV</Button>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="border-b"><tr><th className="text-left py-1">Category</th><th className="text-left">Subcategory</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {expense.map((r, i) => <tr key={i} className="border-b border-border/30"><td className="py-1">{r.category}</td><td>{r.subcategory || "—"}</td><td className="text-right">${Number(r.total).toLocaleString()}</td></tr>)}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Monthly Cash Flow</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => toCSV(cash.data || [], `cashflow_${from}_${to}.csv`)}><Download className="h-4 w-4 mr-1" />CSV</Button>
            </CardHeader>
            <CardContent>
              {cash.isLoading ? <Loader2 className="animate-spin" /> :
                <table className="w-full text-sm">
                  <thead className="border-b"><tr><th className="text-left py-1">Month</th><th className="text-right">Inflow</th><th className="text-right">Outflow</th><th className="text-right">Net</th></tr></thead>
                  <tbody>
                    {(cash.data || []).map((r: any, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-1">{format(new Date(r.month), "MMM yyyy")}</td>
                        <td className="text-right text-green-500">${Number(r.inflow).toLocaleString()}</td>
                        <td className="text-right text-red-500">${Number(r.outflow).toLocaleString()}</td>
                        <td className={`text-right font-medium ${Number(r.net) >= 0 ? "text-green-500" : "text-red-500"}`}>${Number(r.net).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bs" className="space-y-3">
          {["assets", "liabilities", "receivables"].map(section => (
            <Card key={section}>
              <CardHeader><CardTitle className="capitalize">{section} — ${bsSum(section).toLocaleString()}</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody>
                    {bsBy(section).map((r: any, i: number) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-1">{r.label}</td>
                        <td className="text-right">${Number(r.amount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};
