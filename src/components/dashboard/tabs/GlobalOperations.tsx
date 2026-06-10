import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, MapPin, Check, Search, Download, Globe, Monitor,
  TrendingUp, AlertTriangle, RefreshCw, Building2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { subDays, format } from "date-fns";

const COLORS = ["hsl(var(--primary))", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

const GlobalOperations = () => {
  const [dateRange, setDateRange] = useState("30d");
  const [locSearch, setLocSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const { toast } = useToast();

  const dateFilter = useMemo(() => {
    const now = new Date();
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : dateRange === "90d" ? 90 : 365;
    return { start: subDays(now, days), end: now };
  }, [dateRange]);

  const { data: machines = [] } = useQuery({
    queryKey: ["ops-machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, name, machine_code, machine_type, status, location_id, lifetime_revenue, total_plays, total_vends, last_activity_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: divisions = [] } = useQuery({
    queryKey: ["ops-divisions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("divisions").select("*").eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: locations = [], refetch: refetchLocations } = useQuery({
    queryKey: ["ops-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, city, country, status, is_visible, machine_count, address")
        .order("country");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: txns = [] } = useQuery({
    queryKey: ["ops-txns", dateRange],
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

  // ===== Derived stats =====
  const totalMachines = machines.length;
  const activeMachines = machines.filter((m: any) => m.status === "active").length;
  const offlineMachines = machines.filter((m: any) => m.status === "offline" || m.status === "inactive").length;
  const maintenanceMachines = machines.filter((m: any) => m.status === "maintenance").length;

  const periodRevenue = txns.reduce((s, t: any) => s + Number(t.amount || 0), 0);
  const periodTxnCount = txns.length;

  // Revenue per machine
  const revByMachine = useMemo(() => {
    const map = new Map<string, number>();
    txns.forEach((t: any) => map.set(t.machine_id, (map.get(t.machine_id) || 0) + Number(t.amount || 0)));
    return map;
  }, [txns]);

  const topMachines = useMemo(() => {
    return machines
      .map((m: any) => ({ ...m, periodRevenue: revByMachine.get(m.id) || 0 }))
      .sort((a: any, b: any) => b.periodRevenue - a.periodRevenue)
      .slice(0, 10);
  }, [machines, revByMachine]);

  // Country breakdown
  const countries = useMemo(() => {
    const set = new Set<string>();
    locations.forEach((l: any) => l.country && set.add(l.country));
    return Array.from(set).sort();
  }, [locations]);

  const machinesByCountry = useMemo(() => {
    const locCountryMap = new Map<string, string>();
    locations.forEach((l: any) => locCountryMap.set(l.id, l.country || "Unknown"));
    const counts = new Map<string, number>();
    machines.forEach((m: any) => {
      const c = locCountryMap.get(m.location_id) || "Unknown";
      counts.set(c, (counts.get(c) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [machines, locations]);

  // Machine type breakdown
  const typeBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    machines.forEach((m: any) => counts.set(m.machine_type || "unknown", (counts.get(m.machine_type || "unknown") || 0) + 1));
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [machines]);

  // Status breakdown
  const statusBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    machines.forEach((m: any) => counts.set(m.status || "unknown", (counts.get(m.status || "unknown") || 0) + 1));
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [machines]);

  const filteredLocations = useMemo(() => {
    return locations.filter((l: any) => {
      if (countryFilter !== "all" && l.country !== countryFilter) return false;
      if (locSearch) {
        const q = locSearch.toLowerCase();
        if (!(l.city || "").toLowerCase().includes(q) && !(l.name || "").toLowerCase().includes(q) && !(l.country || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [locations, locSearch, countryFilter]);

  const exportCSV = () => {
    const rows = [["Country", "City", "Location", "Status", "Visible", "Machines"]];
    filteredLocations.forEach((l: any) => rows.push([l.country || "", l.city || "", l.name || "", l.status || "", l.is_visible ? "yes" : "no", String(l.machine_count || 0)]));
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `global-locations-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast({ title: "Exported", description: `${filteredLocations.length} locations` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold mb-1">Global Operations</h2>
          <p className="text-muted-foreground">Monitor worldwide VendX machine performance and operations</p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="365d">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetchLocations()}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Health KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Machines</p>
              <p className="text-2xl font-bold">{totalMachines}</p>
              <p className="text-xs text-green-500">{activeMachines} active</p>
            </div>
            <Monitor className="w-8 h-8 text-primary/30" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Period Revenue</p>
              <p className="text-2xl font-bold text-green-500">${periodRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground">{periodTxnCount} txns</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500/30" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Locations</p>
              <p className="text-2xl font-bold">{locations.length}</p>
              <p className="text-xs text-muted-foreground">{countries.length} countries</p>
            </div>
            <Globe className="w-8 h-8 text-primary/30" />
          </div>
        </CardContent></Card>
        <Card className={offlineMachines + maintenanceMachines > 0 ? "border-yellow-500/40" : ""}><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Needs Attention</p>
              <p className={`text-2xl font-bold ${offlineMachines + maintenanceMachines > 0 ? "text-yellow-500" : ""}`}>{offlineMachines + maintenanceMachines}</p>
              <p className="text-xs text-muted-foreground">{offlineMachines} offline · {maintenanceMachines} maint.</p>
            </div>
            <AlertTriangle className={`w-8 h-8 ${offlineMachines + maintenanceMachines > 0 ? "text-yellow-500/50" : "text-muted/30"}`} />
          </div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="machines">Top Machines</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="divisions">Divisions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Machines by Country</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {machinesByCountry.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={machinesByCountry} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={100} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Machine Status Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {statusBreakdown.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {statusBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Machine Type Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {typeBreakdown.map((t) => (
                  <div key={t.name} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground capitalize">{t.name}</p>
                    <p className="text-2xl font-bold">{t.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="machines">
          <Card>
            <CardHeader><CardTitle>Top 10 Machines by Period Revenue</CardTitle></CardHeader>
            <CardContent>
              {topMachines.filter((m: any) => m.periodRevenue > 0).length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No machine revenue in this period</p>
              ) : (
                <div className="space-y-2">
                  {topMachines.filter((m: any) => m.periodRevenue > 0).map((m: any, i: number) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{i + 1}</div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{m.name || m.machine_code}</p>
                          <p className="text-xs text-muted-foreground">{m.machine_code} · {m.machine_type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-500">${m.periodRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <Badge variant="outline" className="text-xs">{m.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Search city, country, name…" value={locSearch} onChange={(e) => setLocSearch(e.target.value)} />
              </div>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-full md:w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All countries</SelectItem>
                  {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportCSV} disabled={filteredLocations.length === 0}>
                <Download className="w-4 h-4 mr-2" />Export
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" />Locations ({filteredLocations.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredLocations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No matching locations</p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredLocations.map((loc: any) => (
                    <div key={loc.id} className="flex items-start justify-between border-b border-border pb-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="font-semibold truncate">{loc.name || loc.city}</p>
                        <p className="text-xs text-muted-foreground">{loc.city}, {loc.country}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground items-center flex-wrap">
                          <span className="flex items-center gap-1"><Activity className="h-3 w-3" />{loc.machine_count || 0} machines</span>
                          <Badge variant="outline" className="text-xs">{loc.status}</Badge>
                          {!loc.is_visible && <Badge variant="secondary" className="text-xs">hidden</Badge>}
                        </div>
                      </div>
                      {loc.status === "active" && <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-1" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="divisions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" />Active Divisions ({divisions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {divisions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No active divisions</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {divisions.map((d: any) => (
                    <div key={d.id} className="flex items-center gap-2 p-3 rounded-lg border border-border">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="font-medium truncate">{d.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GlobalOperations;
