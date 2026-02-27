import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DollarSign, MapPin, Monitor, AlertTriangle, 
  TrendingUp, Package, ShoppingCart, Gamepad2, Leaf
} from "lucide-react";
import { MachineStatsCards, BaseMachine } from "@/components/machines";
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

  // Fetch synced transactions (all revenue sources)
  const { data: syncedTransactions } = useQuery({
    queryKey: ["dashboard-synced-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("synced_transactions")
        .select("amount, created_at, transaction_type, provider, metadata, description")
        .eq("status", "completed")
        .eq("transaction_type", "revenue")
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
        .select("id, name, machine_code, machine_type, status, location_id, last_seen, current_period_revenue, lifetime_revenue, vendx_pay_enabled, accepts_cash, accepts_coins, accepts_cards");
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

  // Calculate combined revenue from all sources (no double counting)
  const revenue = useMemo(() => {
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Use synced_transactions as primary unified source
    // Plus machine_transactions for VendX Pay vending (not in synced)
    const allRevenue: { amount: number; created_at: string; source: string }[] = [];
    
    // Add machine_transactions (VendX Pay vending purchases)
    transactions?.forEach(t => allRevenue.push({ amount: Number(t.amount), created_at: t.created_at, source: "vending" }));
    
    // Add synced_transactions (Stripe/PayPal - EcoSnack, Store, etc.)
    syncedTransactions?.forEach(t => {
      if (Number(t.amount) > 0) {
        allRevenue.push({ amount: Number(t.amount), created_at: t.created_at, source: "synced" });
      }
    });

    return {
      today: allRevenue
        .filter(t => new Date(t.created_at) >= todayStart)
        .reduce((sum, t) => sum + t.amount, 0),
      week: allRevenue
        .filter(t => new Date(t.created_at) >= weekStart)
        .reduce((sum, t) => sum + t.amount, 0),
      month: allRevenue
        .filter(t => new Date(t.created_at) >= monthStart)
        .reduce((sum, t) => sum + t.amount, 0),
    };
  }, [transactions, syncedTransactions]);

  // Revenue by source for the summary cards
  const revenueBySource = useMemo(() => {
    if (!syncedTransactions) return { ecosnack: 0, store: 0, arcade: 0, wallet: 0, other: 0 };
    
    let ecosnack = 0, store = 0, arcade = 0, wallet = 0, other = 0;
    syncedTransactions.forEach(t => {
      const amt = Number(t.amount);
      if (amt <= 0) return;
      const meta = t.metadata as any;
      const source = (meta?.source || "").toLowerCase();
      const desc = (t.description || "").toLowerCase();
      if (source === "ecosnack" || desc.includes("ecosnack")) ecosnack += amt;
      else if (source === "store" || source === "shopify" || desc.includes("store")) store += amt;
      else if (source === "arcade" || desc.includes("arcade")) arcade += amt;
      else if (source === "wallet" || desc.includes("wallet") || desc.includes("vendx pay")) wallet += amt;
      else other += amt;
    });
    return { ecosnack, store, arcade, wallet, other };
  }, [syncedTransactions]);

  // Daily revenue trend chart data - all 30 days, broken down by source
  const dailyRevenueTrend = useMemo(() => {
    const dayMap = new Map<string, { date: string; vending: number; arcade: number; ecosnack: number; store: number; wallet: number; other: number }>();
    
    // Pre-fill all 30 days so there are no gaps
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = format(d, "yyyy-MM-dd");
      dayMap.set(key, { date: key, vending: 0, arcade: 0, ecosnack: 0, store: 0, wallet: 0, other: 0 });
    }
    
    // Machine transactions → vending
    transactions?.forEach(t => {
      const key = format(new Date(t.created_at), "yyyy-MM-dd");
      const entry = dayMap.get(key);
      if (entry) entry.vending += Number(t.amount);
    });
    
    // Synced transactions → categorized by source
    syncedTransactions?.forEach(t => {
      const amt = Number(t.amount);
      if (amt <= 0) return;
      const key = format(new Date(t.created_at), "yyyy-MM-dd");
      const entry = dayMap.get(key);
      if (!entry) return;
      const meta = t.metadata as any;
      const source = (meta?.source || "").toLowerCase();
      const desc = (t.description || "").toLowerCase();
      if (source === "ecosnack" || desc.includes("ecosnack")) entry.ecosnack += amt;
      else if (source === "store" || source === "shopify" || desc.includes("store")) entry.store += amt;
      else if (source === "arcade" || desc.includes("arcade")) entry.arcade += amt;
      else if (source === "wallet" || desc.includes("wallet") || desc.includes("vendx pay")) entry.wallet += amt;
      else entry.other += amt;
    });

    return Array.from(dayMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        day: format(new Date(d.date + "T12:00:00"), "MM/dd"),
        vending: Math.round(d.vending * 100) / 100,
        arcade: Math.round(d.arcade * 100) / 100,
        ecosnack: Math.round(d.ecosnack * 100) / 100,
        store: Math.round(d.store * 100) / 100,
        wallet: Math.round(d.wallet * 100) / 100,
        other: Math.round(d.other * 100) / 100,
        total: Math.round((d.vending + d.arcade + d.ecosnack + d.store + d.wallet + d.other) * 100) / 100,
      }));
  }, [transactions, syncedTransactions]);

  // Compute actual machine counts per location from machine data
  const locationsWithActualCounts = useMemo(() => {
    if (!locations || !machines) return locations || [];
    
    const countMap = new Map<string, number>();
    machines.forEach(m => {
      if (m.location_id) {
        countMap.set(m.location_id, (countMap.get(m.location_id) || 0) + 1);
      }
    });
    
    return locations.map(loc => ({
      ...loc,
      machine_count: countMap.get(loc.id) || loc.machine_count || 0,
    }));
  }, [locations, machines]);

  // Top machines by revenue (computed from transactions, not stale counters)
  const topMachines = useMemo(() => {
    if (!machines) return [];
    
    // Build revenue map from machine_transactions
    const revenueMap = new Map<string, number>();
    transactions?.forEach(t => {
      revenueMap.set(t.machine_id, (revenueMap.get(t.machine_id) || 0) + Number(t.amount));
    });
    
    // Also match synced_transactions by machine_code
    syncedTransactions?.forEach(t => {
      if (Number(t.amount) <= 0) return;
      const meta = t.metadata as any;
      const machineCode = meta?.machine_code;
      if (machineCode) {
        const machine = machines.find(m => m.machine_code === machineCode);
        if (machine) {
          revenueMap.set(machine.id, (revenueMap.get(machine.id) || 0) + Number(t.amount));
        }
      }
    });
    
    return [...machines]
      .map(m => ({ ...m, computed_revenue: revenueMap.get(m.id) || Number(m.lifetime_revenue || 0) }))
      .sort((a, b) => b.computed_revenue - a.computed_revenue)
      .slice(0, 5);
  }, [machines, transactions, syncedTransactions]);

  // Revenue by location (from machine lifetime_revenue + synced transactions matched by machine_code)
  const revenueByLocation = useMemo(() => {
    if (!machines || !locationsWithActualCounts) return [];

    const locationRevenue: Record<string, { name: string; revenue: number; machineCount: number }> = {};

    locationsWithActualCounts.forEach(loc => {
      locationRevenue[loc.id] = {
        name: loc.name || `${loc.city}, ${loc.country}`,
        revenue: 0,
        machineCount: loc.machine_count,
      };
    });

    // Add machine_transactions revenue to locations
    transactions?.forEach(t => {
      const machine = machines.find(m => m.id === t.machine_id);
      if (machine?.location_id && locationRevenue[machine.location_id]) {
        locationRevenue[machine.location_id].revenue += Number(t.amount);
      }
    });

    // Add synced transaction revenue - all of it goes to locations if machine_code matched
    syncedTransactions?.forEach(t => {
      if (Number(t.amount) <= 0) return;
      const meta = t.metadata as any;
      const machineCode = meta?.machine_code;
      if (machineCode) {
        const machine = machines.find(m => m.machine_code === machineCode);
        if (machine?.location_id && locationRevenue[machine.location_id]) {
          locationRevenue[machine.location_id].revenue += Number(t.amount);
        }
      }
    });

    // For synced revenue without machine_code, distribute to first location as general revenue
    const unmatched = syncedTransactions?.filter(t => {
      const meta = t.metadata as any;
      return Number(t.amount) > 0 && !meta?.machine_code;
    }).reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    
    const firstLoc = Object.keys(locationRevenue)[0];
    if (firstLoc && unmatched > 0) {
      locationRevenue[firstLoc].revenue += unmatched;
    }

    return Object.entries(locationRevenue)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [machines, locationsWithActualCounts, syncedTransactions]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Dashboard Overview</h2>
        <p className="text-muted-foreground">Real-time performance snapshot across all locations</p>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Today's Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">${revenue.today.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">${revenue.week.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">${revenue.month.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Source */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vending</p>
                <p className="text-xl font-bold">${(transactions?.reduce((s, t) => s + Number(t.amount), 0) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <Package className="w-6 h-6 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Arcade</p>
                <p className="text-xl font-bold">${revenueBySource.arcade.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <Gamepad2 className="w-6 h-6 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">EcoSnack</p>
                <p className="text-xl font-bold">${revenueBySource.ecosnack.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <Leaf className="w-6 h-6 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Store</p>
                <p className="text-xl font-bold">${revenueBySource.store.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <ShoppingCart className="w-6 h-6 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Locations</p>
                <p className="text-xl font-bold">{locationsWithActualCounts?.filter(l => l.status === "active").length || 0}</p>
              </div>
              <MapPin className="w-6 h-6 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            30-Day Revenue Trend (All Sources)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            {dailyRevenueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyRevenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" interval={2} />
                  <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    formatter={(v: number, name: string) => [`$${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, name]} 
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} 
                  />
                  <Area type="monotone" dataKey="vending" stackId="1" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" fillOpacity={0.5} name="Vending" />
                  <Area type="monotone" dataKey="arcade" stackId="1" fill="#8b5cf6" stroke="#8b5cf6" fillOpacity={0.5} name="Arcade" />
                  <Area type="monotone" dataKey="ecosnack" stackId="1" fill="#10b981" stroke="#10b981" fillOpacity={0.5} name="EcoSnack" />
                  <Area type="monotone" dataKey="store" stackId="1" fill="#f59e0b" stroke="#f59e0b" fillOpacity={0.5} name="Store" />
                  <Area type="monotone" dataKey="wallet" stackId="1" fill="#06b6d4" stroke="#06b6d4" fillOpacity={0.5} name="Wallet Loads" />
                  <Area type="monotone" dataKey="other" stackId="1" fill="#6b7280" stroke="#6b7280" fillOpacity={0.3} name="Other" />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No transaction data for this period</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Machine Status Cards */}
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
                    <span className="font-bold text-primary">
                      ${((machine as any).computed_revenue || Number(machine.current_period_revenue || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                    <span className="font-bold text-primary">${loc.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
              <AlertTriangle className="w-5 h-5 text-destructive" />
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
                    <div key={item.id} className="flex items-center justify-between p-2 bg-destructive/10 rounded-lg">
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
