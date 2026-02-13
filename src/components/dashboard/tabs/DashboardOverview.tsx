import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DollarSign, MapPin, Monitor, AlertTriangle, 
  TrendingUp, Package
} from "lucide-react";
import { MachineStatsCards, calculateMachineStats, BaseMachine } from "@/components/machines";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format } from "date-fns";

const DashboardOverview = () => {
  // Fetch machine transactions for revenue
  const { data: transactions } = useQuery({
    queryKey: ["dashboard-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machine_transactions")
        .select("amount, created_at, machine_id")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch machines with status
  const { data: machines } = useQuery({
    queryKey: ["dashboard-machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, name, machine_code, status, location_id, last_seen, current_period_revenue, lifetime_revenue");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ["dashboard-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, city, country, status, machine_count");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch low inventory alerts
  const { data: lowInventory } = useQuery({
    queryKey: ["dashboard-low-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machine_inventory")
        .select("*, machine:machine_id(name, machine_code)")
        .lt("quantity", 5);
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate revenue metrics
  const revenue = useMemo(() => {
    if (!transactions) return { today: 0, week: 0, month: 0 };

    const now = Date.now();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const weekStart = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now - 30 * 24 * 60 * 60 * 1000);

    return {
      today: transactions
        .filter(t => new Date(t.created_at) >= todayStart)
        .reduce((sum, t) => sum + Number(t.amount), 0),
      week: transactions
        .filter(t => new Date(t.created_at) >= weekStart)
        .reduce((sum, t) => sum + Number(t.amount), 0),
      month: transactions
        .filter(t => new Date(t.created_at) >= monthStart)
        .reduce((sum, t) => sum + Number(t.amount), 0),
    };
  }, [transactions]);

  // Daily revenue trend chart data
  const dailyRevenueTrend = useMemo(() => {
    if (!transactions) return [];
    const dayMap = new Map<string, number>();
    transactions.forEach(t => {
      const day = format(new Date(t.created_at), "MM/dd");
      dayMap.set(day, (dayMap.get(day) || 0) + Number(t.amount));
    });
    return Array.from(dayMap.entries())
      .map(([day, revenue]) => ({ day, revenue }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [transactions]);

  // Machine status counts using universal utility
  const machineStatus = useMemo(() => {
    if (!machines) return { online: 0, offline: 0, maintenance: 0, total: 0 };
    return calculateMachineStats(machines as BaseMachine[]);
  }, [machines]);

  // Top machines by revenue
  const topMachines = useMemo(() => {
    if (!machines) return [];
    return [...machines]
      .sort((a, b) => Number(b.current_period_revenue || 0) - Number(a.current_period_revenue || 0))
      .slice(0, 5);
  }, [machines]);

  // Revenue by location
  const revenueByLocation = useMemo(() => {
    if (!machines || !locations) return [];

    const locationRevenue: Record<string, { name: string; revenue: number; machineCount: number }> = {};

    locations.forEach(loc => {
      locationRevenue[loc.id] = {
        name: loc.name || `${loc.city}, ${loc.country}`,
        revenue: 0,
        machineCount: 0,
      };
    });

    machines.forEach(m => {
      if (m.location_id && locationRevenue[m.location_id]) {
        locationRevenue[m.location_id].revenue += Number(m.current_period_revenue || 0);
        locationRevenue[m.location_id].machineCount += 1;
      }
    });

    return Object.entries(locationRevenue)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [machines, locations]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Dashboard Overview</h2>
        <p className="text-muted-foreground">Real-time performance snapshot across all locations</p>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Today's Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">${revenue.today.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-500">${revenue.week.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-500">${revenue.month.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            30-Day Revenue Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            {dailyRevenueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyRevenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} 
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} 
                  />
                  <Area type="monotone" dataKey="revenue" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" fillOpacity={0.3} name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No transaction data for this period</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Machine Status Cards - Using Universal Component */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Locations</p>
                <p className="text-2xl font-bold">{locations?.filter(l => l.status === "active").length || 0}</p>
              </div>
              <MapPin className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      <MachineStatsCards 
        machines={(machines || []) as BaseMachine[]} 
        showVendxPay={true}
        compact
      />

      {/* Bottom Grids */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Top Machines */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Top Machines by Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topMachines.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No data</p>
              ) : (
                topMachines.map((machine, idx) => (
                  <div key={machine.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-muted-foreground w-5">{idx + 1}</span>
                      <div>
                        <p className="font-medium text-sm">{machine.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{machine.machine_code}</p>
                      </div>
                    </div>
                    <span className="font-bold text-green-500">
                      ${Number(machine.current_period_revenue || 0).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Location */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Revenue by Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {revenueByLocation.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No data</p>
              ) : (
                revenueByLocation.map((loc) => (
                  <div key={loc.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{loc.name}</p>
                      <p className="text-xs text-muted-foreground">{loc.machineCount} machines</p>
                    </div>
                    <span className="font-bold text-primary">${loc.revenue.toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Inventory Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {(lowInventory?.length || 0) === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No low stock items</p>
                ) : (
                  lowInventory?.slice(0, 10).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-yellow-500/10 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.machine?.name || "Unknown"} - Slot {item.slot_number}
                        </p>
                      </div>
                      <Badge variant={item.quantity === 0 ? "destructive" : "secondary"}>
                        {item.quantity === 0 ? "Empty" : `${item.quantity} left`}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardOverview;
