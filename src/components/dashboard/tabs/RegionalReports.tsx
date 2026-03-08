import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Download, MapPin, Monitor } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";

const COLORS = ["hsl(var(--primary))", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];

const RegionalReports = () => {
  const [dateRange, setDateRange] = useState("30d");
  const { toast } = useToast();

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

  // Fetch locations as "regions"
  const { data: locations, isLoading } = useQuery({
    queryKey: ["regional-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, city, country, status")
        .eq("status", "active")
        .order("city");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch machines for counts per location
  const { data: machines } = useQuery({
    queryKey: ["regional-machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, location_id, status")
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch machine_transactions for the period
  const { data: machineTransactions } = useQuery({
    queryKey: ["regional-machine-txns", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machine_transactions")
        .select("amount, machine_id, created_at")
        .gte("created_at", dateFilter.start.toISOString())
        .lte("created_at", dateFilter.end.toISOString());
      if (error) throw error;
      return data || [];
    },
  });


  // Build region stats from live data
  const regionStats = useMemo(() => {
    if (!locations) return [];

    // Machine count per location
    const machineCountMap = new Map<string, number>();
    machines?.forEach(m => {
      if (m.location_id) {
        machineCountMap.set(m.location_id, (machineCountMap.get(m.location_id) || 0) + 1);
      }
    });

    // Machine -> location lookup
    const machineLocMap = new Map<string, string>();
    machines?.forEach(m => {
      if (m.location_id) machineLocMap.set(m.id, m.location_id);
    });

    // Revenue per location from machine_transactions
    const revenueMap = new Map<string, number>();
    const txnCountMap = new Map<string, number>();
    machineTransactions?.forEach(t => {
      const locId = machineLocMap.get(t.machine_id);
      if (locId) {
        revenueMap.set(locId, (revenueMap.get(locId) || 0) + Number(t.amount));
        txnCountMap.set(locId, (txnCountMap.get(locId) || 0) + 1);
      }
    });

    // Revenue from synced transactions matched by machine_code
    syncedTransactions?.forEach(t => {
      if (Number(t.amount) <= 0) return;
      const meta = t.metadata as any;
      const machineCode = meta?.machine_code;
      if (machineCode) {
        const machine = machines?.find(m => (m as any).machine_code === machineCode);
        if (machine?.location_id) {
          revenueMap.set(machine.location_id, (revenueMap.get(machine.location_id) || 0) + Number(t.amount));
          txnCountMap.set(machine.location_id, (txnCountMap.get(machine.location_id) || 0) + 1);
        }
      }
    });

    return locations.map(loc => ({
      id: loc.id,
      name: loc.name || loc.city,
      country: loc.country,
      activeMachines: machineCountMap.get(loc.id) || 0,
      revenue: revenueMap.get(loc.id) || 0,
      transactions: txnCountMap.get(loc.id) || 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [locations, machines, machineTransactions, syncedTransactions]);

  const totalMachines = regionStats.reduce((s, r) => s + r.activeMachines, 0);
  const totalRevenue = regionStats.reduce((s, r) => s + r.revenue, 0);
  const totalTransactions = regionStats.reduce((s, r) => s + r.transactions, 0);

  // Chart data
  const revenueChartData = useMemo(() => 
    regionStats.filter(r => r.revenue > 0).map(r => ({
      name: r.name.length > 12 ? r.name.substring(0, 12) + "…" : r.name,
      revenue: Math.round(r.revenue * 100) / 100,
      transactions: r.transactions,
    })),
  [regionStats]);

  const machineDistribution = useMemo(() => 
    regionStats.filter(r => r.activeMachines > 0).map(r => ({ name: r.name, value: r.activeMachines })),
  [regionStats]);

  const exportCSV = () => {
    if (!regionStats.length) return;
    let csv = "Location,Country,Active Machines,Revenue,Transactions\n";
    regionStats.forEach(r => {
      csv += `"${r.name}","${r.country}",${r.activeMachines},${r.revenue.toFixed(2)},${r.transactions}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `regional-reports-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast({ title: "Exported", description: "Regional report downloaded" });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Regional Reports</h2>
          <p className="text-muted-foreground">Live performance across all locations</p>
        </div>
        <div className="flex gap-2">
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
          <Button variant="outline" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" />Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4" />Total Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{regionStats.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Monitor className="w-4 h-4" />Active Machines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{totalMachines}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Period Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{totalTransactions.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {revenueChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No revenue data for this period</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Machine Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {machineDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={machineDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {machineDistribution.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No machine data</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Location Performance List */}
      <Card>
        <CardHeader>
          <CardTitle>Location Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {regionStats.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No active locations found</p>
            ) : (
              regionStats.map((region) => (
                <div key={region.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-foreground">{region.name}</h3>
                        <span className="text-sm text-muted-foreground">{region.country}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>{region.activeMachines} machines</span>
                        <span>${region.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} revenue</span>
                        <span>{region.transactions.toLocaleString()} transactions</span>
                      </div>
                    </div>
                  </div>
                  <Progress value={totalRevenue > 0 ? (region.revenue / totalRevenue) * 100 : 0} className="h-2" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegionalReports;
