import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { subDays, subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import {
  DollarSign, ShoppingCart, Gamepad2, Leaf, TrendingUp,
  Package, Users, BarChart3, Wallet,
} from "lucide-react";

const COLORS = ["hsl(var(--primary))", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];

const GlobalAnalytics = () => {
  const [dateRange, setDateRange] = useState("30d");

  const dateFilter = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case "7d": return { start: subDays(now, 7), end: now };
      case "30d": return { start: subDays(now, 30), end: now };
      case "90d": return { start: subDays(now, 90), end: now };
      case "month": return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last-month": {
        const lm = subMonths(now, 1);
        return { start: startOfMonth(lm), end: endOfMonth(lm) };
      }
      default: return { start: subDays(now, 30), end: now };
    }
  }, [dateRange]);

  // ========= UNIFIED SOURCE: synced_transactions =========
  const { data: syncedTransactions } = useQuery({
    queryKey: ["ga-synced-txns", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("synced_transactions")
        .select("id, amount, created_at, transaction_type, provider, status, metadata, description")
        .eq("status", "completed")
        .gte("created_at", dateFilter.start.toISOString())
        .lte("created_at", dateFilter.end.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  // Machine transactions (VendX Pay vending - separate from synced)
  const { data: machineTransactions } = useQuery({
    queryKey: ["ga-machine-txns", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machine_transactions")
        .select("id, amount, created_at, points_earned")
        .gte("created_at", dateFilter.start.toISOString())
        .lte("created_at", dateFilter.end.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  // Arcade sessions for play counts (non-financial metric)
  const { data: arcadeSessions } = useQuery({
    queryKey: ["ga-arcade-sessions", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arcade_play_sessions")
        .select("id, plays_purchased, created_at")
        .gte("created_at", dateFilter.start.toISOString())
        .lte("created_at", dateFilter.end.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  // Store orders for order counts and statuses
  const { data: storeOrders } = useQuery({
    queryKey: ["ga-store-orders", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_orders")
        .select("id, status, created_at")
        .gte("created_at", dateFilter.start.toISOString())
        .lte("created_at", dateFilter.end.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  // Wallet loads
  const { data: walletLoads } = useQuery({
    queryKey: ["ga-wallet-loads", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("id, amount, created_at")
        .eq("transaction_type", "load")
        .eq("status", "confirmed")
        .gte("created_at", dateFilter.start.toISOString())
        .lte("created_at", dateFilter.end.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  // Classify synced revenue by source using metadata
  const revenueBySource = useMemo(() => {
    let ecosnack = 0, store = 0, arcade = 0, paypal = 0, other = 0;
    
    syncedTransactions?.forEach(t => {
      if (t.transaction_type !== "revenue") return;
      const amt = Number(t.amount);
      if (amt <= 0) return;
      const meta = t.metadata as any;
      const source = meta?.source;
      if (source === "ecosnack") ecosnack += amt;
      else if (source === "store" || source === "shopify") store += amt;
      else if (source === "arcade") arcade += amt;
      else if (t.provider === "paypal") paypal += amt;
      else other += amt;
    });

    return { ecosnack, store, arcade, paypal, other };
  }, [syncedTransactions]);

  // Totals
  const totals = useMemo(() => {
    const vendingRevenue = machineTransactions?.reduce((s, t) => s + Number(t.amount), 0) || 0;
    const syncedRevenue = syncedTransactions
      ?.filter(t => t.transaction_type === "revenue" && Number(t.amount) > 0)
      .reduce((s, t) => s + Number(t.amount), 0) || 0;
    const walletLoadTotal = walletLoads?.reduce((s, w) => s + Number(w.amount), 0) || 0;
    const totalRevenue = vendingRevenue + syncedRevenue;
    const totalPlays = arcadeSessions?.reduce((s, a) => s + (a.plays_purchased || 0), 0) || 0;
    const totalPoints = machineTransactions?.reduce((s, t) => s + (t.points_earned || 0), 0) || 0;
    const totalTransactions = (machineTransactions?.length || 0) + 
      (syncedTransactions?.filter(t => t.transaction_type === "revenue").length || 0);

    return {
      vendingRevenue,
      storeRevenue: revenueBySource.store,
      arcadeRevenue: revenueBySource.arcade,
      ecosnackRevenue: revenueBySource.ecosnack,
      walletLoadTotal,
      totalRevenue,
      totalTransactions,
      totalPlays,
      totalPoints,
    };
  }, [syncedTransactions, machineTransactions, walletLoads, arcadeSessions, revenueBySource]);

  // Revenue breakdown for pie chart
  const revenueBreakdown = useMemo(() => [
    { name: "Store", value: totals.storeRevenue },
    { name: "Vending", value: totals.vendingRevenue },
    { name: "Arcade", value: totals.arcadeRevenue },
    { name: "EcoVend", value: totals.ecosnackRevenue },
    { name: "PayPal (Other)", value: revenueBySource.paypal },
    { name: "Other", value: revenueBySource.other },
  ].filter(d => d.value > 0), [totals, revenueBySource]);

  // Daily revenue trend from synced + machine_transactions
  const dailyRevenue = useMemo(() => {
    const dayMap = new Map<string, { store: number; vending: number; arcade: number; ecosnack: number; other: number }>();

    const ensureDay = (day: string) => {
      if (!dayMap.has(day)) dayMap.set(day, { store: 0, vending: 0, arcade: 0, ecosnack: 0, other: 0 });
      return dayMap.get(day)!;
    };

    // Vending (machine_transactions)
    machineTransactions?.forEach(t => {
      const day = format(new Date(t.created_at), "MM/dd");
      ensureDay(day).vending += Number(t.amount);
    });

    // Synced transactions classified by source
    syncedTransactions?.forEach(t => {
      if (t.transaction_type !== "revenue" || Number(t.amount) <= 0) return;
      const day = format(new Date(t.created_at), "MM/dd");
      const entry = ensureDay(day);
      const meta = t.metadata as any;
      const source = meta?.source;
      if (source === "ecosnack") entry.ecosnack += Number(t.amount);
      else if (source === "store" || source === "shopify") entry.store += Number(t.amount);
      else if (source === "arcade") entry.arcade += Number(t.amount);
      else entry.other += Number(t.amount);
    });

    return Array.from(dayMap.entries())
      .map(([day, data]) => ({ day, ...data, total: data.store + data.vending + data.arcade + data.ecosnack + data.other }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [syncedTransactions, machineTransactions]);

  // Order status breakdown
  const orderStatusData = useMemo(() => {
    if (!storeOrders) return [];
    const statusMap = new Map<string, number>();
    storeOrders.forEach(o => statusMap.set(o.status, (statusMap.get(o.status) || 0) + 1));
    return Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));
  }, [storeOrders]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Global Analytics
          </h2>
          <p className="text-muted-foreground">
            Cross-division revenue and performance metrics (unified data source)
          </p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="last-month">Last Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">${totals.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">{totals.totalTransactions} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />Store
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-500">${totals.storeRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">{storeOrders?.length || 0} orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />Vending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${totals.vendingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">{machineTransactions?.length || 0} txns</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" />Arcade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-500">${totals.arcadeRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">{totals.totalPlays} plays</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />Wallet Loads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">${totals.walletLoadTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">{walletLoads?.length || 0} loads</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {dailyRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Area type="monotone" dataKey="store" stackId="1" fill="#10b981" stroke="#10b981" fillOpacity={0.6} name="Store" />
                    <Area type="monotone" dataKey="vending" stackId="1" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" fillOpacity={0.6} name="Vending" />
                    <Area type="monotone" dataKey="arcade" stackId="1" fill="#8b5cf6" stroke="#8b5cf6" fillOpacity={0.6} name="Arcade" />
                    <Area type="monotone" dataKey="ecosnack" stackId="1" fill="#f59e0b" stroke="#f59e0b" fillOpacity={0.6} name="EcoVend" />
                    <Area type="monotone" dataKey="other" stackId="1" fill="#06b6d4" stroke="#06b6d4" fillOpacity={0.4} name="Other" />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data for this period</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Revenue Breakdown Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {revenueBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueBreakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {revenueBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No revenue data</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Order Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Store Order Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {orderStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orderStatusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No orders</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Division Summary Table */}
        <Card>
          <CardHeader>
            <CardTitle>Division Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "Online Store", icon: ShoppingCart, revenue: totals.storeRevenue, txns: storeOrders?.length || 0, color: "text-emerald-500" },
                { name: "Vending Machines", icon: Package, revenue: totals.vendingRevenue, txns: machineTransactions?.length || 0, color: "text-primary" },
                { name: "Arcade", icon: Gamepad2, revenue: totals.arcadeRevenue, txns: arcadeSessions?.length || 0, color: "text-purple-500" },
                { name: "EcoSnack", icon: Leaf, revenue: totals.ecosnackRevenue, txns: 0, color: "text-amber-500" },
              ].map((div) => (
                <div key={div.name} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div.icon className={`h-5 w-5 ${div.color}`} />
                    <div>
                      <p className="font-medium text-sm">{div.name}</p>
                      {div.txns > 0 && <p className="text-xs text-muted-foreground">{div.txns} transactions</p>}
                    </div>
                  </div>
                  <p className={`font-bold ${div.color}`}>${div.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 border-2 border-primary/30 rounded-lg bg-primary/5">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <p className="font-bold">Total Revenue</p>
                </div>
                <p className="text-xl font-bold text-primary">${totals.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GlobalAnalytics;
