import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Receipt, PiggyBank, Percent } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const KpiCard = ({ label, value, delta, icon: Icon, invert = false }: any) => {
  const positive = invert ? delta < 0 : delta > 0;
  const anomaly = Math.abs(delta) > 30;
  return (
    <Card className={anomaly ? "border-yellow-500/60" : ""}>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="h-3 w-3" />{label}</span>
          {anomaly && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
        </div>
        <div className="text-2xl font-bold">${Number(value).toLocaleString()}</div>
        {delta !== null && (
          <div className={`text-xs flex items-center gap-1 ${positive ? "text-green-500" : delta === 0 ? "text-muted-foreground" : "text-red-500"}`}>
            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : null}
            {delta > 0 ? "+" : ""}{delta.toFixed(1)}% vs prev period
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const FinanceKpiDashboard = () => {
  const now = new Date();
  const [from, setFrom] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(now), "yyyy-MM-dd"));

  const prevFrom = format(startOfMonth(subMonths(new Date(from), 1)), "yyyy-MM-dd");
  const prevTo = format(endOfMonth(subMonths(new Date(from), 1)), "yyyy-MM-dd");

  const pnl = useQuery({
    queryKey: ["kpi-pnl", from, to, prevFrom, prevTo],
    queryFn: async () => {
      const [cur, prev] = await Promise.all([
        supabase.rpc("get_pnl_report" as any, { p_from: from, p_to: to }),
        supabase.rpc("get_pnl_report" as any, { p_from: prevFrom, p_to: prevTo }),
      ]);
      return { current: (cur.data || []) as any[], previous: (prev.data || []) as any[] };
    },
  });

  const cash = useQuery({
    queryKey: ["kpi-cash", from, to],
    queryFn: async () => {
      const start = format(subMonths(new Date(from), 5), "yyyy-MM-dd");
      const { data } = await supabase.rpc("get_cash_flow_report" as any, { p_from: start, p_to: to });
      return (data || []) as any[];
    },
  });

  const sumBy = (rows: any[], kind: string) => rows.filter(r => r.kind === kind).reduce((s, r) => s + Number(r.total), 0);
  const curIncome = sumBy(pnl.data?.current || [], "income");
  const curExpense = sumBy(pnl.data?.current || [], "expense");
  const curProfit = curIncome - curExpense;
  const prevIncome = sumBy(pnl.data?.previous || [], "income");
  const prevExpense = sumBy(pnl.data?.previous || [], "expense");
  const prevProfit = prevIncome - prevExpense;

  const pctDelta = (cur: number, prev: number) => prev === 0 ? (cur === 0 ? 0 : 100) : ((cur - prev) / Math.abs(prev)) * 100;
  const margin = curIncome === 0 ? 0 : (curProfit / curIncome) * 100;
  const prevMargin = prevIncome === 0 ? 0 : (prevProfit / prevIncome) * 100;

  // Category anomalies: expense categories that jumped >50% vs prior
  const anomalies = (() => {
    const curCats: Record<string, number> = {};
    const prevCats: Record<string, number> = {};
    (pnl.data?.current || []).filter(r => r.kind === "expense").forEach(r => {
      curCats[r.category] = (curCats[r.category] || 0) + Number(r.total);
    });
    (pnl.data?.previous || []).filter(r => r.kind === "expense").forEach(r => {
      prevCats[r.category] = (prevCats[r.category] || 0) + Number(r.total);
    });
    return Object.entries(curCats).map(([cat, cur]) => {
      const prev = prevCats[cat] || 0;
      const delta = pctDelta(cur, prev);
      return { cat, cur, prev, delta };
    }).filter(a => Math.abs(a.delta) > 50 && a.cur > 100).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  })();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Financial KPI Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time performance with automatic anomaly detection vs prior period.</p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div className="text-xs text-muted-foreground ml-2">Compared to {format(new Date(prevFrom), "PP")} – {format(new Date(prevTo), "PP")}</div>
        </CardContent>
      </Card>

      {pnl.isLoading ? <Loader2 className="animate-spin" /> :
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Revenue" value={curIncome} delta={pctDelta(curIncome, prevIncome)} icon={DollarSign} />
          <KpiCard label="Expenses" value={curExpense} delta={pctDelta(curExpense, prevExpense)} icon={Receipt} invert />
          <KpiCard label="Net Profit" value={curProfit} delta={pctDelta(curProfit, prevProfit)} icon={PiggyBank} />
          <Card className={Math.abs(margin - prevMargin) > 10 ? "border-yellow-500/60" : ""}>
            <CardContent className="p-4 space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Percent className="h-3 w-3" />Profit Margin</span>
              <div className={`text-2xl font-bold ${margin >= 0 ? "text-green-500" : "text-red-500"}`}>{margin.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Prev: {prevMargin.toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>}

      <Card>
        <CardHeader><CardTitle>6-Month Cash Flow</CardTitle></CardHeader>
        <CardContent>
          {cash.isLoading ? <Loader2 className="animate-spin" /> :
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={(cash.data || []).map((r: any) => ({ month: format(new Date(r.month), "MMM"), inflow: Number(r.inflow), outflow: Number(r.outflow), net: Number(r.net) }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="inflow" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="outflow" stroke="hsl(var(--destructive))" strokeWidth={2} />
                  <Line type="monotone" dataKey="net" stroke="hsl(142 76% 45%)" strokeWidth={2} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-yellow-500" />Anomaly Detection</CardTitle>
        </CardHeader>
        <CardContent>
          {!anomalies.length ? <p className="text-sm text-muted-foreground">No significant expense anomalies detected.</p> :
            <div className="space-y-2">
              {anomalies.map(a => (
                <div key={a.cat} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium capitalize">{a.cat}</div>
                    <div className="text-xs text-muted-foreground">Prev: ${a.prev.toLocaleString()} → Current: ${a.cur.toLocaleString()}</div>
                  </div>
                  <Badge variant={a.delta > 0 ? "destructive" : "default"}>
                    {a.delta > 0 ? "+" : ""}{a.delta.toFixed(0)}%
                  </Badge>
                </div>
              ))}
            </div>}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceKpiDashboard;
