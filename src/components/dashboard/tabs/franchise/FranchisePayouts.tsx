import { useMyFranchise } from "@/hooks/useMyFranchise";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, TrendingUp } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

const FranchisePayouts = () => {
  const { data: franchise } = useMyFranchise();
  const now = new Date();
  const pStart = format(startOfMonth(now), "yyyy-MM-dd");
  const pEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const { data: payouts, isLoading } = useQuery({
    queryKey: ["franchise-payouts", franchise?.id],
    enabled: !!franchise?.id,
    queryFn: async () => {
      const { data } = await supabase.from("vendx_franchise_payouts" as any).select("*").eq("franchise_id", franchise.id).order("period_end", { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: live, isLoading: liveLoading } = useQuery({
    queryKey: ["franchise-live-period", franchise?.id, pStart, pEnd],
    enabled: !!franchise?.id,
    queryFn: async () => {
      const { data } = await supabase.rpc("calculate_franchise_period_revenue" as any, {
        p_franchise_id: franchise.id, p_start: pStart, p_end: pEnd,
      });
      return (data as any[])?.[0] || null;
    },
  });

  if (!franchise) return <div className="p-6 text-muted-foreground">No franchise on file.</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Sales & Payouts</h2>
        <p className="text-sm text-muted-foreground">VendX takes {franchise.commission_pct}% of gross route sales. Net payout is transferred each period.</p>
      </div>

      <Card className="border-primary/40">
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Current Period — {format(now, "MMMM yyyy")}</CardTitle></CardHeader>
        <CardContent>
          {liveLoading ? <Loader2 className="animate-spin" /> : !live ? <p className="text-sm text-muted-foreground">No revenue data yet.</p> :
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><div className="text-xs text-muted-foreground">Machine Sales</div><div className="text-lg font-bold">${Number(live.machine_sales).toLocaleString()}</div></div>
              <div><div className="text-xs text-muted-foreground">Arcade Sales</div><div className="text-lg font-bold">${Number(live.arcade_sales).toLocaleString()}</div></div>
              <div><div className="text-xs text-muted-foreground">POS Sales</div><div className="text-lg font-bold">${Number(live.pos_sales).toLocaleString()}</div></div>
              <div><div className="text-xs text-muted-foreground">Gross Total</div><div className="text-lg font-bold text-primary">${Number(live.total_gross).toLocaleString()}</div></div>
              <div><div className="text-xs text-muted-foreground">VendX {franchise.commission_pct}%</div><div className="text-lg font-bold text-orange-500">${Number(live.commission_amount).toLocaleString()}</div></div>
              <div><div className="text-xs text-muted-foreground">Est. Net Payout</div><div className="text-lg font-bold text-green-500">${Number(live.net_payout).toLocaleString()}</div></div>
              <div><div className="text-xs text-muted-foreground">Transactions</div><div className="text-lg font-bold">{live.txn_count}</div></div>
            </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Payout History</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Loader2 className="animate-spin" /> :
            !payouts?.length ? <p className="text-sm text-muted-foreground">No payout periods yet.</p> :
              <div className="space-y-2">
                {payouts.map((p: any) => (
                  <div key={p.id} className="p-3 border rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{format(new Date(p.period_start), "PP")} – {format(new Date(p.period_end), "PP")}</div>
                      <Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div><span className="text-muted-foreground">Gross:</span> ${Number(p.gross_sales).toLocaleString()}</div>
                      <div><span className="text-muted-foreground">VendX {p.commission_pct}%:</span> <span className="text-orange-500">${Number(p.commission_amount).toLocaleString()}</span></div>
                      <div><span className="text-muted-foreground">Net to you:</span> <span className="text-green-500 font-medium">${Number(p.net_payout).toLocaleString()}</span></div>
                    </div>
                    {p.paid_at && <div className="text-xs text-muted-foreground">Paid {format(new Date(p.paid_at), "PPP")} {p.payment_reference && `• Ref: ${p.payment_reference}`}</div>}
                  </div>
                ))}
              </div>
          }
        </CardContent>
      </Card>
    </div>
  );
};

export default FranchisePayouts;
