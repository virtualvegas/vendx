import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Edit, Trash2, MapPin, Users, Route, Eye, RefreshCw,
  GripVertical, ChevronDown, ChevronUp, Clock, CheckCircle,
  AlertTriangle, Copy, Search, Filter, MoreVertical,
  Monitor, Building, Navigation, Phone, Mail, Calendar,
  TrendingUp, Target, Zap, ArrowUp, ArrowDown, Play, Pause
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ServiceRoute {
  id: string;
  name: string;
  description: string | null;
  assigned_to: string | null;
  status: string;
  created_at: string;
}

interface RouteStop {
  id: string;
  route_id: string;
  stop_name: string;
  address: string | null;
  notes: string | null;
  stop_order: number;
  estimated_duration_minutes: number | null;
  status: string;
  location_id: string | null;
  machine_id: string | null;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

interface Location {
  id: string;
  name: string | null;
  address: string | null;
  city: string;
  contact_name: string | null;
  contact_phone: string | null;
}

interface Machine {
  id: string;
  name: string;
  machine_code: string;
  location_id: string | null;
  status: string;
}

const RouteManager = () => {
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<ServiceRoute | null>(null);
  const [editingStop, setEditingStop] = useState<RouteStop | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [routeForm, setRouteForm] = useState({ name: "", description: "", assigned_to: "", status: "active" });
  const [stopForm, setStopForm] = useState({ 
    stop_name: "", 
    address: "", 
    notes: "", 
    estimated_duration_minutes: 15,
    location_id: "",
    machine_id: ""
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"routes" | "analytics">("routes");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all routes
  const { data: routes, isLoading: routesLoading, refetch: refetchRoutes } = useQuery({
    queryKey: ["admin-routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_routes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceRoute[];
    },
  });

  // Fetch employees with operator role
  const { data: employees } = useQuery({
    queryKey: ["employee-operators"],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "employee_operator");
      if (roleError) throw roleError;
      
      if (!roleData.length) return [];
      
      const userIds = roleData.map(r => r.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);
      if (profileError) throw profileError;
      
      return profiles as UserProfile[];
    },
  });

  // Fetch stops for selected route
  const { data: stops, refetch: refetchStops } = useQuery({
    queryKey: ["route-stops", selectedRouteId],
    queryFn: async () => {
      if (!selectedRouteId) return [];
      const { data, error } = await supabase
        .from("route_stops")
        .select("*")
        .eq("route_id", selectedRouteId)
        .order("stop_order", { ascending: true });
      if (error) throw error;
      return data as RouteStop[];
    },
    enabled: !!selectedRouteId,
  });

  // Fetch locations for stop assignment
  const { data: locations } = useQuery({
    queryKey: ["all-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, address, city, contact_name, contact_phone")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as Location[];
    },
  });

  // Fetch machines for stop assignment
  const { data: machines } = useQuery({
    queryKey: ["all-machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, name, machine_code, location_id, status")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as Machine[];
    },
  });

  // Fetch all stops for analytics
  const { data: allStops } = useQuery({
    queryKey: ["all-route-stops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_stops")
        .select("*, service_routes(name, status)");
      if (error) throw error;
      return data;
    },
  });

  // Route mutations
  const createRouteMutation = useMutation({
    mutationFn: async (data: typeof routeForm) => {
      const { error } = await supabase.from("service_routes").insert([{
        name: data.name,
        description: data.description || null,
        assigned_to: data.assigned_to || null,
        status: data.status,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-routes"] });
      toast({ title: "Route Created" });
      setRouteDialogOpen(false);
      resetRouteForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateRouteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof routeForm }) => {
      const { error } = await supabase.from("service_routes").update({
        name: data.name,
        description: data.description || null,
        assigned_to: data.assigned_to || null,
        status: data.status,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-routes"] });
      toast({ title: "Route Updated" });
      setRouteDialogOpen(false);
      resetRouteForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First delete all stops
      await supabase.from("route_stops").delete().eq("route_id", id);
      const { error } = await supabase.from("service_routes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-routes"] });
      toast({ title: "Route Deleted" });
      if (selectedRouteId) setSelectedRouteId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const duplicateRouteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      const route = routes?.find(r => r.id === routeId);
      if (!route) throw new Error("Route not found");
      
      const { data: newRoute, error: routeError } = await supabase
        .from("service_routes")
        .insert([{
          name: `${route.name} (Copy)`,
          description: route.description,
          status: "inactive",
        }])
        .select()
        .single();
      if (routeError) throw routeError;

      // Copy stops
      const { data: existingStops } = await supabase
        .from("route_stops")
        .select("*")
        .eq("route_id", routeId);

      if (existingStops && existingStops.length > 0) {
        const newStops = existingStops.map(s => ({
          route_id: newRoute.id,
          stop_name: s.stop_name,
          address: s.address,
          notes: s.notes,
          stop_order: s.stop_order,
          estimated_duration_minutes: s.estimated_duration_minutes,
          location_id: s.location_id,
          machine_id: s.machine_id,
          status: "pending",
        }));
        await supabase.from("route_stops").insert(newStops);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-routes"] });
      toast({ title: "Route Duplicated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Stop mutations
  const createStopMutation = useMutation({
    mutationFn: async (data: typeof stopForm) => {
      const maxOrder = stops?.length ? Math.max(...stops.map(s => s.stop_order)) + 1 : 0;
      const { error } = await supabase.from("route_stops").insert([{
        route_id: selectedRouteId,
        stop_name: data.stop_name,
        address: data.address || null,
        notes: data.notes || null,
        estimated_duration_minutes: data.estimated_duration_minutes,
        stop_order: maxOrder,
        location_id: data.location_id || null,
        machine_id: data.machine_id || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops", selectedRouteId] });
      toast({ title: "Stop Added" });
      setStopDialogOpen(false);
      resetStopForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateStopMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof stopForm }) => {
      const { error } = await supabase.from("route_stops").update({
        stop_name: data.stop_name,
        address: data.address || null,
        notes: data.notes || null,
        estimated_duration_minutes: data.estimated_duration_minutes,
        location_id: data.location_id || null,
        machine_id: data.machine_id || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops", selectedRouteId] });
      toast({ title: "Stop Updated" });
      setStopDialogOpen(false);
      resetStopForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteStopMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("route_stops").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops", selectedRouteId] });
      toast({ title: "Stop Removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Reorder stops
  const moveStopMutation = useMutation({
    mutationFn: async ({ stopId, direction }: { stopId: string; direction: "up" | "down" }) => {
      if (!stops) return;
      
      const stopIndex = stops.findIndex(s => s.id === stopId);
      if (stopIndex === -1) return;
      
      const swapIndex = direction === "up" ? stopIndex - 1 : stopIndex + 1;
      if (swapIndex < 0 || swapIndex >= stops.length) return;

      const currentStop = stops[stopIndex];
      const swapStop = stops[swapIndex];

      await supabase.from("route_stops").update({ stop_order: swapStop.stop_order }).eq("id", currentStop.id);
      await supabase.from("route_stops").update({ stop_order: currentStop.stop_order }).eq("id", swapStop.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops", selectedRouteId] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Reset all stops in route
  const resetRouteStopsMutation = useMutation({
    mutationFn: async (routeId: string) => {
      const { error } = await supabase
        .from("route_stops")
        .update({ status: "pending", completed_at: null })
        .eq("route_id", routeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops", selectedRouteId] });
      toast({ title: "Route Reset", description: "All stops set to pending" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetRouteForm = () => {
    setRouteForm({ name: "", description: "", assigned_to: "", status: "active" });
    setEditingRoute(null);
  };

  const resetStopForm = () => {
    setStopForm({ stop_name: "", address: "", notes: "", estimated_duration_minutes: 15, location_id: "", machine_id: "" });
    setEditingStop(null);
  };

  const handleEditRoute = (route: ServiceRoute) => {
    setEditingRoute(route);
    setRouteForm({
      name: route.name,
      description: route.description || "",
      assigned_to: route.assigned_to || "",
      status: route.status,
    });
    setRouteDialogOpen(true);
  };

  const handleEditStop = (stop: RouteStop) => {
    setEditingStop(stop);
    setStopForm({
      stop_name: stop.stop_name,
      address: stop.address || "",
      notes: stop.notes || "",
      estimated_duration_minutes: stop.estimated_duration_minutes || 15,
      location_id: stop.location_id || "",
      machine_id: stop.machine_id || "",
    });
    setStopDialogOpen(true);
  };

  const handleRouteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRoute) {
      updateRouteMutation.mutate({ id: editingRoute.id, data: routeForm });
    } else {
      createRouteMutation.mutate(routeForm);
    }
  };

  const handleStopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStop) {
      updateStopMutation.mutate({ id: editingStop.id, data: stopForm });
    } else {
      createStopMutation.mutate(stopForm);
    }
  };

  const getAssigneeName = (userId: string | null) => {
    if (!userId) return "Unassigned";
    const employee = employees?.find(e => e.id === userId);
    return employee?.full_name || employee?.email || "Unknown";
  };

  // When location is selected, auto-fill address
  useEffect(() => {
    if (stopForm.location_id) {
      const location = locations?.find(l => l.id === stopForm.location_id);
      if (location) {
        setStopForm(prev => ({
          ...prev,
          stop_name: prev.stop_name || location.name || "",
          address: location.address || `${location.city}`,
        }));
      }
    }
  }, [stopForm.location_id, locations]);

  // Filter routes
  const filteredRoutes = routes?.filter(route => {
    const matchesSearch = route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getAssigneeName(route.assigned_to).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || route.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const activeRoutes = routes?.filter(r => r.status === "active") || [];
  const selectedRoute = routes?.find(r => r.id === selectedRouteId);

  // Analytics calculations
  const totalStops = allStops?.length || 0;
  const completedStops = allStops?.filter(s => s.status === "completed")?.length || 0;
  const pendingStops = allStops?.filter(s => s.status === "pending")?.length || 0;
  const avgStopsPerRoute = routes?.length ? Math.round(totalStops / routes.length) : 0;
  const completionRate = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;
  const routeStopCount = stops?.length || 0;
  const routeCompletedCount = stops?.filter(s => s.status === "completed")?.length || 0;
  const routeTotalMinutes = stops?.reduce((acc, s) => acc + (s.estimated_duration_minutes || 15), 0) || 0;

  if (routesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary mr-2" />
        <p className="text-muted-foreground">Loading routes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-foreground">Route Manager</h2>
          <p className="text-sm text-muted-foreground">Create and manage service routes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetchRoutes()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetRouteForm} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Create Route</span>
                <span className="sm:hidden">New</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRoute ? "Edit Route" : "Create New Route"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRouteSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Route Name</Label>
                  <Input
                    id="name"
                    value={routeForm.name}
                    onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                    placeholder="e.g., Downtown Morning Route"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={routeForm.description}
                    onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })}
                    placeholder="Route details and instructions..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="assigned_to">Assign To</Label>
                  <Select 
                    value={routeForm.assigned_to || "unassigned"} 
                    onValueChange={(v) => setRouteForm({ ...routeForm, assigned_to: v === "unassigned" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an operator" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {employees?.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name || emp.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={routeForm.status} 
                    onValueChange={(v) => setRouteForm({ ...routeForm, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setRouteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingRoute ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "routes" | "analytics")}>
        <TabsList className="w-full grid grid-cols-2 h-9">
          <TabsTrigger value="routes" className="text-xs">Routes</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-4 space-y-4">
          {/* Analytics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Route className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total Routes</span>
              </div>
              <p className="text-2xl font-bold">{routes?.length || 0}</p>
              <p className="text-xs text-green-600">{activeRoutes.length} active</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Total Stops</span>
              </div>
              <p className="text-2xl font-bold">{totalStops}</p>
              <p className="text-xs text-muted-foreground">~{avgStopsPerRoute} per route</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Completion</span>
              </div>
              <p className="text-2xl font-bold">{completionRate}%</p>
              <p className="text-xs text-muted-foreground">{completedStops}/{totalStops} stops</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Operators</span>
              </div>
              <p className="text-2xl font-bold">{employees?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Available</p>
            </Card>
          </div>

          {/* Route Performance */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Route Performance</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px]">
                <div className="divide-y">
                  {routes?.map(route => {
                    const routeStops = allStops?.filter(s => s.route_id === route.id) || [];
                    const completed = routeStops.filter(s => s.status === "completed").length;
                    const total = routeStops.length;
                    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
                    
                    return (
                      <div key={route.id} className="p-3 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{route.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {getAssigneeName(route.assigned_to)} • {total} stops
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={route.status === "active" ? "default" : "secondary"} className="text-xs">
                            {route.status}
                          </Badge>
                          <div className="w-12 text-right">
                            <span className={`text-sm font-bold ${rate >= 80 ? 'text-green-500' : rate >= 50 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                              {rate}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routes" className="mt-4 space-y-4">
          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search routes..." 
                className="pl-9 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28 h-9">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Routes Grid on Mobile, Side-by-side on Desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Routes List */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Route className="w-4 h-4" />
                  Routes ({filteredRoutes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                {filteredRoutes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">No routes found</p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2 pr-2">
                      {filteredRoutes.map((route) => (
                        <div 
                          key={route.id} 
                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            selectedRouteId === route.id 
                              ? "border-primary bg-primary/5 shadow-sm" 
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => setSelectedRouteId(route.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-sm truncate">{route.name}</h4>
                                <Badge 
                                  variant={route.status === "active" ? "default" : "secondary"} 
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {route.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {getAssigneeName(route.assigned_to)}
                              </p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { handleEditRoute(route); }}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => duplicateRouteMutation.mutate(route.id)}>
                                  <Copy className="w-4 h-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => resetRouteStopsMutation.mutate(route.id)}>
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Reset Stops
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => deleteRouteMutation.mutate(route.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Route Stops */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {selectedRoute ? selectedRoute.name : "Route Stops"}
                    </CardTitle>
                    {selectedRoute && (
                      <CardDescription className="text-xs mt-0.5">
                        {routeStopCount} stops • ~{Math.round(routeTotalMinutes / 60)}h {routeTotalMinutes % 60}m total
                      </CardDescription>
                    )}
                  </div>
                  {selectedRouteId && (
                    <Dialog open={stopDialogOpen} onOpenChange={setStopDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={resetStopForm}>
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{editingStop ? "Edit Stop" : "Add Stop"}</DialogTitle>
                          <DialogDescription>{selectedRoute?.name}</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleStopSubmit} className="space-y-4">
                          {/* Location Selector */}
                          <div>
                            <Label>Link to Location (Optional)</Label>
                            <Select 
                              value={stopForm.location_id || "none"} 
                              onValueChange={(v) => setStopForm({ ...stopForm, location_id: v === "none" ? "" : v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No location</SelectItem>
                                {locations?.map((loc) => (
                                  <SelectItem key={loc.id} value={loc.id}>
                                    <div className="flex items-center gap-2">
                                      <Building className="w-3 h-3" />
                                      {loc.name || loc.city}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Machine Selector */}
                          <div>
                            <Label>Link to Machine (Optional)</Label>
                            <Select 
                              value={stopForm.machine_id || "none"} 
                              onValueChange={(v) => setStopForm({ ...stopForm, machine_id: v === "none" ? "" : v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select machine" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No machine</SelectItem>
                                {machines?.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    <div className="flex items-center gap-2">
                                      <Monitor className="w-3 h-3" />
                                      {m.name} ({m.machine_code})
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="stop_name">Stop Name</Label>
                            <Input
                              id="stop_name"
                              value={stopForm.stop_name}
                              onChange={(e) => setStopForm({ ...stopForm, stop_name: e.target.value })}
                              placeholder="e.g., Main Street Mall"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="address">Address</Label>
                            <Input
                              id="address"
                              value={stopForm.address}
                              onChange={(e) => setStopForm({ ...stopForm, address: e.target.value })}
                              placeholder="123 Main Street, City"
                            />
                          </div>
                          <div>
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                              id="notes"
                              value={stopForm.notes}
                              onChange={(e) => setStopForm({ ...stopForm, notes: e.target.value })}
                              placeholder="Special instructions..."
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label htmlFor="duration">Est. Duration (min)</Label>
                            <Input
                              id="duration"
                              type="number"
                              value={stopForm.estimated_duration_minutes}
                              onChange={(e) => setStopForm({ ...stopForm, estimated_duration_minutes: parseInt(e.target.value) })}
                              min={5}
                              max={120}
                            />
                          </div>
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setStopDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit">{editingStop ? "Update" : "Add"} Stop</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-2">
                {!selectedRouteId ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Select a route to view stops</p>
                ) : stops?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">No stops added yet</p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-1 pr-2">
                      {stops?.map((stop, index) => (
                        <div 
                          key={stop.id} 
                          className="flex items-center gap-2 p-2 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          {/* Reorder buttons */}
                          <div className="flex flex-col gap-0.5">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5"
                              disabled={index === 0}
                              onClick={() => moveStopMutation.mutate({ stopId: stop.id, direction: "up" })}
                            >
                              <ArrowUp className="w-3 h-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5"
                              disabled={index === (stops?.length || 0) - 1}
                              onClick={() => moveStopMutation.mutate({ stopId: stop.id, direction: "down" })}
                            >
                              <ArrowDown className="w-3 h-3" />
                            </Button>
                          </div>

                          {/* Order number */}
                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {index + 1}
                          </div>

                          {/* Stop info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <h4 className="font-medium text-sm truncate">{stop.stop_name}</h4>
                              {stop.machine_id && <Monitor className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                              {stop.location_id && <Building className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                            </div>
                            {stop.address && (
                              <p className="text-xs text-muted-foreground truncate">{stop.address}</p>
                            )}
                          </div>

                          {/* Duration & Status */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{stop.estimated_duration_minutes || 15}m</span>
                            <Badge 
                              variant={stop.status === "completed" ? "default" : "outline"} 
                              className="text-[10px] px-1.5"
                            >
                              {stop.status === "completed" ? <CheckCircle className="w-3 h-3" /> : stop.status}
                            </Badge>
                          </div>

                          {/* Actions */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditStop(stop)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => deleteStopMutation.mutate(stop.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RouteManager;