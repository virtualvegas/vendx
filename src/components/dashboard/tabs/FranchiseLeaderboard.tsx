import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const FranchiseLeaderboard = () => {
  const now = new Date();
  const [start, setStart] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [end, setEnd] = useState(format(endOfMonth(now), "yyyy-MM-dd"));

  const prevStart = format(startOfMonth(subMonths(new Date(start), 1)), "yyyy-MM-dd");
  const prevEnd = format(endOfMonth(subMonths(new Date(start), 1)), "yyyy-MM-dd");

  const franchises = useQuery({
    queryKey: ["leaderboard-franchises"],
    queryFn: async () => {
      const { data } = await supabase.from("vendx_franchises" as any)
        .select("id, business_name, status, commission_pct").eq("status", "active");
      return (data || []) as any[];
    },
  });

  const revenue = useQuery({
    queryKey: ["leaderboard-revenue", start, end, franchises.data?.map(f => f.id).join(",")],
    enabled: !!franchises.data?.length,
    queryFn: async () => {
      const results = await Promise.all((franchises.data || []).map(async (f: any) => {
        const [cur, prev] = await Promise.all([
          supabase.rpc("calculate_franchise_period_revenue" as any, { p_franchise_id: f.id, p_start: start, p_end: end }),
          supabase.rpc("calculate_franchise_period_revenue" as any, { p_franchise_id: f.id, p_start: prevStart, p_end: prevEnd }),
        ]);
        return {
          franchise: f,
          current: (cur.data as any[])?.[0] || { total_gross: 0, net_payout: 0, commission_amount: 0, txn_count: 0 },
          previous: (prev.data as any[])?.[0] || { total_gross: 0 },
        };
      }));
      return results.sort((a, b) => Number(b.current.total_gross) - Number(a.current.total_gross));
    },
  });

  const grandTotal = (revenue.data || []).reduce((s, r) => s + Number(r.current.total_gross), 0);
  const grandCommission = (revenue.data || []).reduce((s, r) => s + Number(r.current.commission_amount), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Trophy className="h-7 w-7 text-yellow-500" />Franchise Leaderboard</h1>
        <p className="text-sm text-muted-foreground">Rank active franchises by real-time route revenue.</p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div><Label>From</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Route Revenue</div><div className="text-2xl font-bold text-primary">${grandTotal.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">VendX Commission</div><div className="text-2xl font-bold text-orange-500">${grandCommission.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Active Franchises</div><div className="text-2xl font-bold">{franchises.data?.length || 0}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Rankings</CardTitle></CardHeader>
        <CardContent>
          {revenue.isLoading || franchises.isLoading ? <Loader2 className="animate-spin" /> :
            !revenue.data?.length ? <p className="text-sm text-muted-foreground">No active franchises.</p> :
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr><th className="text-left py-2">#</th><th className="text-left">Franchise</th><th className="text-right">Machine</th><th className="text-right">Arcade</th><th className="text-right">POS</th><th className="text-right">Gross</th><th className="text-right">Δ vs Prev</th><th className="text-right">Net Payout</th></tr>
                </thead>
                <tbody>
                  {revenue.data.map((r, i) => {
                    const delta = Number(r.previous.total_gross) === 0 ? null : ((Number(r.current.total_gross) - Number(r.previous.total_gross)) / Number(r.previous.total_gross)) * 100;
                    return (
                      <tr key={r.franchise.id} className="border-b border-border/30">
                        <td className="py-2 font-bold">{i + 1 <= 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</td>
                        <td className="font-medium">{r.franchise.business_name}</td>
                        <td className="text-right">${Number(r.current.machine_sales || 0).toLocaleString()}</td>
                        <td className="text-right">${Number(r.current.arcade_sales || 0).toLocaleString()}</td>
                        <td className="text-right">${Number(r.current.pos_sales || 0).toLocaleString()}</td>
                        <td className="text-right font-bold">${Number(r.current.total_gross).toLocaleString()}</td>
                        <td className="text-right">
                          {delta === null ? <Badge variant="outline">new</Badge> :
                            <span className={`inline-flex items-center gap-1 ${delta > 5 ? "text-green-500" : delta < -5 ? "text-red-500" : "text-muted-foreground"}`}>
                              {delta > 5 ? <TrendingUp className="h-3 w-3" /> : delta < -5 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                              {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                            </span>}
                        </td>
                        <td className="text-right text-green-500 font-medium">${Number(r.current.net_payout).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>}
        </CardContent>
      </Card>
    </div>
  );
};

export default FranchiseLeaderboard;
