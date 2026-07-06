import { useMyFranchise } from "@/hooks/useMyFranchise";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor, MapPin, DollarSign, Package, Loader2, AlertCircle } from "lucide-react";

const FranchiseOverview = () => {
  const { data: franchise, isLoading } = useMyFranchise();

  const { data: stats } = useQuery({
    queryKey: ["franchise-stats", franchise?.id],
    enabled: !!franchise?.id,
    queryFn: async () => {
      const [m, t, o, p] = await Promise.all([
        supabase.from("vendx_franchise_machines" as any).select("id", { count: "exact", head: true }).eq("franchise_id", franchise.id),
        supabase.from("vendx_franchise_territories" as any).select("id", { count: "exact", head: true }).eq("franchise_id", franchise.id),
        supabase.from("vendx_franchise_orders" as any).select("id", { count: "exact", head: true }).eq("franchise_id", franchise.id),
        supabase.from("vendx_franchise_payouts" as any).select("gross_sales,commission_amount,net_payout").eq("franchise_id", franchise.id),
      ]);
      const payouts = (p.data || []) as any[];
      return {
        machines: m.count || 0,
        territories: t.count || 0,
        orders: o.count || 0,
        gross: payouts.reduce((s, x) => s + Number(x.gross_sales || 0), 0),
        commission: payouts.reduce((s, x) => s + Number(x.commission_amount || 0), 0),
        net: payouts.reduce((s, x) => s + Number(x.net_payout || 0), 0),
      };
    },
  });

  if (isLoading) return <div className="p-6"><Loader2 className="animate-spin" /></div>;

  if (!franchise) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground" />
            <p>No franchise application on file.</p>
            <p className="text-sm text-muted-foreground">Head to <strong>Onboarding</strong> to apply.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{franchise.business_name}</h2>
          <p className="text-sm text-muted-foreground">Franchise overview</p>
        </div>
        <Badge variant={franchise.status === "active" ? "default" : "secondary"}>{franchise.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Monitor className="h-4 w-4" />Machines</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.machines ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><MapPin className="h-4 w-4" />Territories</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.territories ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Package className="h-4 w-4" />Orders Placed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.orders ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" />Lifetime Gross Sales</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">${(stats?.gross ?? 0).toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">VendX Commission ({franchise.commission_pct}%)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-orange-500">${(stats?.commission ?? 0).toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Net To You</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">${(stats?.net ?? 0).toLocaleString()}</div></CardContent></Card>
      </div>
    </div>
  );
};

export default FranchiseOverview;
