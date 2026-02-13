import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend 
} from "recharts";
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { 
  DollarSign, Ticket, Users, Gamepad2, TrendingUp, Download, 
  MapPin, RefreshCw, BarChart3, Gift 
} from "lucide-react";
import { toast } from "sonner";

interface MachineStats {
  id: string;
  name: string;
  machine_code: string;
  machine_type: string;
  total_plays: number;
  lifetime_revenue: number;
  current_period_revenue: number;
  location?: {
    name: string | null;
    city: string;
  } | null;
}

interface TicketStats {
  machine_id: string;
  machine_name: string;
  location_name: string;
  tickets_issued: number;
  tickets_redeemed: number;
  transaction_count: number;
}

interface SessionStats {
  machine_id: string;
  unique_players: number;
  total_sessions: number;
  total_plays: number;
  total_revenue: number;
  avg_plays_per_session: number;
}

interface LocationRevenue {
  location_id: string;
  location_name: string;
  city: string;
  machine_count: number;
  total_revenue: number;
  total_plays: number;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const ArcadeAnalytics = () => {
  const [dateRange, setDateRange] = useState("30d");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");

  // Calculate date range
  const dateFilter = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case "7d":
        return { start: subDays(now, 7), end: now };
      case "30d":
        return { start: subDays(now, 30), end: now };
      case "90d":
        return { start: subDays(now, 90), end: now };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last-month":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      default:
        return { start: subDays(now, 30), end: now };
    }
  }, [dateRange]);

  // Fetch arcade machines with stats
  const { data: machines, isLoading: machinesLoading, refetch: refetchMachines } = useQuery({
    queryKey: ["arcade-machines-stats", selectedLocation],
    queryFn: async () => {
      let query = supabase
        .from("vendx_machines")
        .select(`
          id, name, machine_code, machine_type, 
          total_plays, lifetime_revenue, current_period_revenue,
          location:locations(name, city)
        `)
        .in("machine_type", ["arcade", "claw"])
        .eq("status", "active")
        .order("lifetime_revenue", { ascending: false });
      
      if (selectedLocation !== "all") {
        query = query.eq("location_id", selectedLocation);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as MachineStats[];
    },
  });

  // Fetch locations for filter
  const { data: locations } = useQuery({
    queryKey: ["arcade-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, city")
        .eq("status", "active")
        .order("city");
      if (error) throw error;
      return data;
    },
  });

  // Fetch ticket transactions aggregated by machine
  const { data: ticketStats } = useQuery({
    queryKey: ["arcade-ticket-stats", dateFilter.start, dateFilter.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_transactions")
        .select(`
          machine_id,
          amount,
          vendx_machines!inner(name, machine_code),
          locations(name, city)
        `)
        .gte("created_at", dateFilter.start.toISOString())
        .lte("created_at", dateFilter.end.toISOString())
        .not("machine_id", "is", null);
      
      if (error) throw error;
      
      // Aggregate by machine
      const machineMap = new Map<string, TicketStats>();
      data?.forEach((tx: any) => {
        const key = tx.machine_id;
        if (!machineMap.has(key)) {
          machineMap.set(key, {
            machine_id: key,
            machine_name: tx.vendx_machines?.name || "Unknown",
            location_name: tx.locations?.name || tx.locations?.city || "Unknown",
            tickets_issued: 0,
            tickets_redeemed: 0,
            transaction_count: 0,
          });
        }
        const stats = machineMap.get(key)!;
        if (tx.amount > 0) {
          stats.tickets_issued += tx.amount;
        } else {
          stats.tickets_redeemed += Math.abs(tx.amount);
        }
        stats.transaction_count++;
      });
      
      return Array.from(machineMap.values()).sort((a, b) => b.tickets_issued - a.tickets_issued);
    },
  });

  // Fetch play sessions for player analytics
  const { data: sessionStats } = useQuery({
    queryKey: ["arcade-session-stats", dateFilter.start, dateFilter.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arcade_play_sessions")
        .select("machine_id, user_id, plays_purchased, amount")
        .gte("created_at", dateFilter.start.toISOString())
        .lte("created_at", dateFilter.end.toISOString());
      
      if (error) throw error;
      
      // Aggregate by machine
      const machineMap = new Map<string, SessionStats>();
      const usersByMachine = new Map<string, Set<string>>();
      
      data?.forEach((session) => {
        const key = session.machine_id;
        if (!machineMap.has(key)) {
          machineMap.set(key, {
            machine_id: key,
            unique_players: 0,
            total_sessions: 0,
            total_plays: 0,
            total_revenue: 0,
            avg_plays_per_session: 0,
          });
          usersByMachine.set(key, new Set());
        }
        const stats = machineMap.get(key)!;
        const users = usersByMachine.get(key)!;
        
        users.add(session.user_id);
        stats.total_sessions++;
        stats.total_plays += session.plays_purchased || 0;
        stats.total_revenue += session.amount || 0;
      });
      
      // Calculate final values
      machineMap.forEach((stats, key) => {
        stats.unique_players = usersByMachine.get(key)!.size;
        stats.avg_plays_per_session = stats.total_sessions > 0 
          ? stats.total_plays / stats.total_sessions 
          : 0;
      });
      
      return Array.from(machineMap.values());
    },
  });

  // Fetch redemption data for prize cost analysis
  const { data: redemptionStats } = useQuery({
    queryKey: ["arcade-redemption-stats", dateFilter.start, dateFilter.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_transactions")
        .select("amount, metadata")
        .eq("transaction_type", "redeem")
        .gte("created_at", dateFilter.start.toISOString())
        .lte("created_at", dateFilter.end.toISOString());
      
      if (error) throw error;
      
      const totalRedeemed = data?.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) || 0;
      const redemptionCount = data?.length || 0;
      
      return { totalRedeemed, redemptionCount };
    },
  });

  // Calculate totals
  const totals = useMemo(() => {
    const totalRevenue = machines?.reduce((sum, m) => sum + (m.lifetime_revenue || 0), 0) || 0;
    const periodRevenue = machines?.reduce((sum, m) => sum + (m.current_period_revenue || 0), 0) || 0;
    const totalPlays = machines?.reduce((sum, m) => sum + (m.total_plays || 0), 0) || 0;
    const totalTicketsIssued = ticketStats?.reduce((sum, t) => sum + t.tickets_issued, 0) || 0;
    const totalTicketsRedeemed = redemptionStats?.totalRedeemed || 0;
    const uniquePlayers = sessionStats?.reduce((sum, s) => sum + s.unique_players, 0) || 0;
    const avgPlaysPerUser = uniquePlayers > 0 ? totalPlays / uniquePlayers : 0;
    
    return {
      totalRevenue,
      periodRevenue,
      totalPlays,
      totalTicketsIssued,
      totalTicketsRedeemed,
      uniquePlayers,
      avgPlaysPerUser,
      machineCount: machines?.length || 0,
    };
  }, [machines, ticketStats, sessionStats, redemptionStats]);

  // Chart data for revenue by machine
  const revenueChartData = useMemo(() => {
    return machines?.slice(0, 10).map(m => ({
      name: m.name?.substring(0, 15) || m.machine_code,
      revenue: m.lifetime_revenue || 0,
      plays: m.total_plays || 0,
    })) || [];
  }, [machines]);

  // Chart data for tickets by machine
  const ticketChartData = useMemo(() => {
    return ticketStats?.slice(0, 10).map(t => ({
      name: t.machine_name?.substring(0, 15) || "Unknown",
      issued: t.tickets_issued,
      redeemed: t.tickets_redeemed,
    })) || [];
  }, [ticketStats]);

  // Location breakdown data
  const locationData = useMemo(() => {
    if (!machines) return [];
    
    const locationMap = new Map<string, LocationRevenue>();
    machines.forEach(m => {
      const locName = m.location?.name || m.location?.city || "Unassigned";
      if (!locationMap.has(locName)) {
        locationMap.set(locName, {
          location_id: locName,
          location_name: locName,
          city: m.location?.city || "",
          machine_count: 0,
          total_revenue: 0,
          total_plays: 0,
        });
      }
      const loc = locationMap.get(locName)!;
      loc.machine_count++;
      loc.total_revenue += m.lifetime_revenue || 0;
      loc.total_plays += m.total_plays || 0;
    });
    
    return Array.from(locationMap.values()).sort((a, b) => b.total_revenue - a.total_revenue);
  }, [machines]);

  // Export to CSV
  const exportToCSV = (type: "machines" | "tickets" | "locations") => {
    let csvContent = "";
    let filename = "";
    
    if (type === "machines" && machines) {
      filename = `arcade-machine-revenue-${format(new Date(), "yyyy-MM-dd")}.csv`;
      csvContent = "Machine Name,Machine Code,Type,Location,Total Plays,Lifetime Revenue,Period Revenue\n";
      machines.forEach(m => {
        csvContent += `"${m.name}","${m.machine_code}","${m.machine_type}","${m.location?.name || m.location?.city || ""}",${m.total_plays || 0},${m.lifetime_revenue || 0},${m.current_period_revenue || 0}\n`;
      });
    } else if (type === "tickets" && ticketStats) {
      filename = `arcade-ticket-stats-${format(new Date(), "yyyy-MM-dd")}.csv`;
      csvContent = "Machine Name,Location,Tickets Issued,Tickets Redeemed,Transactions\n";
      ticketStats.forEach(t => {
        csvContent += `"${t.machine_name}","${t.location_name}",${t.tickets_issued},${t.tickets_redeemed},${t.transaction_count}\n`;
      });
    } else if (type === "locations" && locationData) {
      filename = `arcade-location-revenue-${format(new Date(), "yyyy-MM-dd")}.csv`;
      csvContent = "Location,City,Machines,Total Plays,Total Revenue\n";
      locationData.forEach(l => {
        csvContent += `"${l.location_name}","${l.city}",${l.machine_count},${l.total_plays},${l.total_revenue}\n`;
      });
    }
    
    if (csvContent) {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      toast.success("Report exported successfully");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Arcade Analytics
          </h2>
          <p className="text-muted-foreground">
            Revenue, ticket distribution, and player engagement metrics
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
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
          
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations?.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name || loc.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="icon" onClick={() => refetchMachines()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Lifetime Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              ${totals.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">
              Period: ${totals.periodRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" />
              Total Plays
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.totalPlays.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              Across {totals.machineCount} machines
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              Tickets Issued
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-500">
              {totals.totalTicketsIssued.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              Redeemed: {totals.totalTicketsRedeemed.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Avg Plays/User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.avgPlaysPerUser.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">
              {totals.uniquePlayers} unique players
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="machines">Machine Details</TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Machine (Top 10)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="name" width={100} />
                      <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Location</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={locationData.slice(0, 6)}
                        dataKey="total_revenue"
                        nameKey="location_name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {locationData.slice(0, 6).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tickets Tab */}
        <TabsContent value="tickets" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => exportToCSV("tickets")}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tickets Issued vs Redeemed (Top 10)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ticketChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="issued" name="Issued" fill="hsl(var(--chart-1))" />
                      <Bar dataKey="redeemed" name="Redeemed" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Prize Redemption Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Tickets Redeemed</p>
                      <p className="text-2xl font-bold">{totals.totalTicketsRedeemed.toLocaleString()}</p>
                    </div>
                    <Ticket className="h-8 w-8 text-primary/50" />
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Redemption Count</p>
                      <p className="text-2xl font-bold">{redemptionStats?.redemptionCount || 0}</p>
                    </div>
                    <Gift className="h-8 w-8 text-primary/50" />
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Outstanding Tickets</p>
                      <p className="text-2xl font-bold text-amber-500">
                        {(totals.totalTicketsIssued - totals.totalTicketsRedeemed).toLocaleString()}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-amber-500/50" />
                  </div>
                  
                  {totals.totalRevenue > 0 && (
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Ticket Cost Ratio</p>
                      <p className="text-lg font-semibold">
                        {((totals.totalTicketsIssued / totals.totalRevenue) || 0).toFixed(2)} tickets per $1 revenue
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => exportToCSV("locations")}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Revenue by Location
              </CardTitle>
              <CardDescription>
                Arcade performance across all locations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-center">Machines</TableHead>
                      <TableHead className="text-center">Total Plays</TableHead>
                      <TableHead className="text-right">Total Revenue</TableHead>
                      <TableHead className="text-right">Avg/Machine</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locationData.map((loc) => (
                      <TableRow key={loc.location_id}>
                        <TableCell>
                          <div className="font-medium">{loc.location_name}</div>
                          {loc.city && loc.city !== loc.location_name && (
                            <div className="text-xs text-muted-foreground">{loc.city}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{loc.machine_count}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {loc.total_plays.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          ${loc.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${(loc.total_revenue / loc.machine_count || 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {locationData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No location data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Machine Details Tab */}
        <TabsContent value="machines" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => exportToCSV("machines")}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5" />
                Machine Performance
              </CardTitle>
              <CardDescription>
                Detailed metrics for each arcade machine
              </CardDescription>
            </CardHeader>
            <CardContent>
              {machinesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Machine</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-center">Type</TableHead>
                        <TableHead className="text-center">Total Plays</TableHead>
                        <TableHead className="text-right">Lifetime Revenue</TableHead>
                        <TableHead className="text-right">Period Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {machines?.map((machine) => (
                        <TableRow key={machine.id}>
                          <TableCell>
                            <div className="font-medium">{machine.name}</div>
                            <div className="text-xs text-muted-foreground">{machine.machine_code}</div>
                          </TableCell>
                          <TableCell>
                            {machine.location?.name || machine.location?.city || "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{machine.machine_type}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {(machine.total_plays || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-medium text-primary">
                            ${(machine.lifetime_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            ${(machine.current_period_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                      {machines?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No arcade machines found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ArcadeAnalytics;
