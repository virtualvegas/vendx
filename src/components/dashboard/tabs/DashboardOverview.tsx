import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DollarSign, MapPin, Monitor, AlertTriangle, 
  TrendingUp, Package, CheckCircle, XCircle, Wrench 
} from "lucide-react";

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
        .select("id, name, city, country, status, machine_count")
        .eq("is_visible", true);
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

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

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

  // Machine status counts
  const machineStatus = useMemo(() => {
    if (!machines) return { online: 0, offline: 0, maintenance: 0, total: 0 };

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    return {
      total: machines.length,
      online: machines.filter(m => 
        m.status === "active" && m.last_seen && new Date(m.last_seen).getTime() > fiveMinutesAgo
      ).length,
      offline: machines.filter(m => 
        m.status === "active" && (!m.last_seen || new Date(m.last_seen).getTime() <= fiveMinutesAgo)
      ).length,
      maintenance: machines.filter(m => m.status === "maintenance").length,
    };
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

      {/* Status Cards */}
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
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Online Machines</p>
                <p className="text-2xl font-bold text-green-500">{machineStatus.online}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Offline Machines</p>
                <p className="text-2xl font-bold text-red-500">{machineStatus.offline}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Maintenance</p>
                <p className="text-2xl font-bold text-yellow-500">{machineStatus.maintenance}</p>
              </div>
              <Wrench className="w-8 h-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

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
