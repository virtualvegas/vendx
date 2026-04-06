import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/hooks/useAuditLog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, Clock, CheckCircle, Navigation, Package, 
  RefreshCw, User, Calendar, AlertTriangle, Monitor,
  Phone, Mail, FileText, Truck, Play, Pause, RotateCcw,
  Timer, Zap, TrendingUp, ChevronRight, MapPinned,
  Search, Filter, WifiOff, Wifi, Camera, MessageSquare,
  ThumbsUp, AlertCircle, SkipForward, History, Target,
  DollarSign, Coins, Banknote, CreditCard, ListTodo, Flag
} from "lucide-react";

interface RouteStop {
  id: string;
  route_id: string;
  stop_name: string;
  address: string | null;
  notes: string | null;
  stop_order: number;
  estimated_duration_minutes: number | null;
  status: string;
  completed_at: string | null;
  location_id: string | null;
  machine_id: string | null;
  machine?: {
    id: string;
    name: string;
    machine_code: string;
    status: string;
  } | null;
  location?: {
    id: string;
    name: string | null;
    city: string;
    address: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
  } | null;
}

interface ServiceRoute {
  id: string;
  name: string;
  description: string | null;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  assignee?: {
    full_name: string | null;
    email: string;
  } | null;
}

interface MachineInventoryItem {
  id: string;
  product_name: string;
  sku: string;
  slot_number: string | null;
  quantity: number;
  max_capacity: number;
  unit_price: number;
}

interface UserRole {
  role: string;
}

const MyRoute = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [showStopDetailsDialog, setShowStopDetailsDialog] = useState(false);
  const [showRestockDialog, setShowRestockDialog] = useState(false);
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [showRevenueDialog, setShowRevenueDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [selectedStop, setSelectedStop] = useState<RouteStop | null>(null);
  const [restockNotes, setRestockNotes] = useState("");
  const [restockQuantities, setRestockQuantities] = useState<Record<string, number>>({});
  const [issueDescription, setIssueDescription] = useState("");
  const [revenueForm, setRevenueForm] = useState({ cashAmount: "", coinsAmount: "", notes: "" });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium" });
  const [activeView, setActiveView] = useState<"my-route" | "all-routes">("my-route");
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [routeStartTime, setRouteStartTime] = useState<Date | null>(null);
  const [quickViewStop, setQuickViewStop] = useState<RouteStop | null>(null);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch current user's roles
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["user-roles", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id);
      if (error) throw error;
      return data.map((r: UserRole) => r.role);
    },
    enabled: !!currentUser?.id,
  });

  useEffect(() => {
    if (roles) setUserRoles(roles);
  }, [roles]);

  const isManager = userRoles.some(r => 
    ["super_admin", "global_operations_manager", "regional_manager"].includes(r)
  );

  // Fetch routes
  const { data: routes, isLoading: routesLoading, refetch: refetchRoutes } = useQuery({
    queryKey: ["my-routes", currentUser?.id, isManager, activeView],
    queryFn: async () => {
      let query = supabase
        .from("service_routes")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isManager || activeView === "my-route") {
        if (!isManager && currentUser?.id) {
          query = query.eq("assigned_to", currentUser.id);
        }
        query = query.eq("status", "active");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ServiceRoute[];
    },
    enabled: !!currentUser?.id,
  });

  // Fetch assignee profiles
  const { data: routesWithAssignees } = useQuery({
    queryKey: ["routes-with-assignees", routes],
    queryFn: async () => {
      if (!routes || routes.length === 0) return [];
      
      const assigneeIds = routes.filter(r => r.assigned_to).map(r => r.assigned_to!);
      if (assigneeIds.length === 0) return routes;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", assigneeIds);

      return routes.map(route => ({
        ...route,
        assignee: profiles?.find(p => p.id === route.assigned_to) || null,
      }));
    },
    enabled: !!routes && routes.length > 0,
  });

  useEffect(() => {
    if (routesWithAssignees && routesWithAssignees.length > 0 && !selectedRouteId) {
      setSelectedRouteId(routesWithAssignees[0].id);
    }
  }, [routesWithAssignees, selectedRouteId]);

  const selectedRoute = routesWithAssignees?.find(r => r.id === selectedRouteId);

  // Fetch stops with machine and location details
  const { data: stops, isLoading: stopsLoading, refetch: refetchStops } = useQuery({
    queryKey: ["route-stops", selectedRouteId],
    queryFn: async () => {
      if (!selectedRouteId) return [];
      const { data, error } = await supabase
        .from("route_stops")
        .select(`
          *,
          machine:vendx_machines(id, name, machine_code, status),
          location:locations(id, name, city, address, contact_name, contact_phone, contact_email)
        `)
        .eq("route_id", selectedRouteId)
        .order("stop_order", { ascending: true });
      if (error) throw error;
      return data as RouteStop[];
    },
    enabled: !!selectedRouteId,
  });

  // Fetch machine inventory
  const { data: machineInventory } = useQuery({
    queryKey: ["machine-inventory", selectedStop?.machine_id],
    queryFn: async () => {
      if (!selectedStop?.machine_id) return [];
      const { data, error } = await supabase
        .from("machine_inventory")
        .select("*")
        .eq("machine_id", selectedStop.machine_id)
        .order("slot_number");
      if (error) throw error;
      return data as MachineInventoryItem[];
    },
    enabled: !!selectedStop?.machine_id,
  });

  // Complete stop mutation
  const completeStopMutation = useMutation({
    mutationFn: async (stopId: string) => {
      const { error } = await supabase
        .from("route_stops")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops"] });
      toast({ title: "Stop Completed", description: "Great work! Moving to next stop." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Skip stop mutation
  const skipStopMutation = useMutation({
    mutationFn: async ({ stopId, reason }: { stopId: string; reason: string }) => {
      const { error } = await supabase
        .from("route_stops")
        .update({ 
          status: "skipped", 
          notes: `Skipped: ${reason}`,
          completed_at: new Date().toISOString()
        })
        .eq("id", stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops"] });
      toast({ title: "Stop Skipped", description: "Moving to next stop" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Reset stop mutation
  const resetStopMutation = useMutation({
    mutationFn: async (stopId: string) => {
      const { error } = await supabase
        .from("route_stops")
        .update({ status: "pending", completed_at: null })
        .eq("id", stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops"] });
      toast({ title: "Stop Reset" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Log restock mutation - per-item quantities, deducts from warehouse
  const logRestockMutation = useMutation({
    mutationFn: async ({ machineId, notes, quantities }: { machineId: string; notes: string; quantities: Record<string, number> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!machineInventory || machineInventory.length === 0) return;

      const restockedItems: any[] = [];

      for (const item of machineInventory) {
        const qtyToAdd = quantities[item.id] ?? (item.max_capacity - item.quantity);
        if (qtyToAdd <= 0) continue;

        const newQty = Math.min(item.max_capacity, item.quantity + qtyToAdd);
        restockedItems.push({
          inventory_id: item.id,
          product_name: item.product_name,
          sku: item.sku,
          slot_number: item.slot_number,
          previous_quantity: item.quantity,
          quantity_added: qtyToAdd,
          new_quantity: newQty,
        });

        // Update machine slot
        await supabase
          .from("machine_inventory")
          .update({ quantity: newQty, last_restocked: new Date().toISOString() })
          .eq("id", item.id);

        // Deduct from warehouse by SKU
        const { data: warehouseItem } = await supabase
          .from("inventory_items")
          .select("id, quantity")
          .eq("sku", item.sku)
          .single();

        if (warehouseItem) {
          const newWarehouseQty = Math.max(0, warehouseItem.quantity - qtyToAdd);
          await supabase
            .from("inventory_items")
            .update({ quantity: newWarehouseQty })
            .eq("id", warehouseItem.id);
        }
      }

      if (restockedItems.length > 0) {
        // Log the restock
        await supabase
          .from("restock_logs")
          .insert({
            machine_id: machineId,
            performed_by: user?.id,
            notes,
            items_restocked: restockedItems,
          });

        logAuditEvent({
          action: "Machine Restocked",
          entity_type: "Machine Inventory",
          entity_id: machineId,
          details: { items: restockedItems.length, total_added: restockedItems.reduce((s, i) => s + i.quantity_added, 0) },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machine-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      toast({ title: "Restock Logged", description: "Inventory updated, warehouse stock deducted" });
      setShowRestockDialog(false);
      setRestockNotes("");
      setRestockQuantities({});
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Report issue mutation
  const reportIssueMutation = useMutation({
    mutationFn: async ({ stopId, machineId, description }: { stopId: string; machineId: string; description: string }) => {
      const ticketNumber = `TKT-${Date.now().toString().slice(-6)}`;
      const { error } = await supabase
        .from("support_tickets")
        .insert({
          ticket_number: ticketNumber,
          machine_id: machineId,
          location: selectedStop?.stop_name || "Unknown",
          issue_type: "field_report",
          priority: "medium",
          description,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Issue Reported", description: "Support ticket created" });
      setShowIssueDialog(false);
      setIssueDescription("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Revenue collection mutation
  const collectRevenueMutation = useMutation({
    mutationFn: async ({ 
      machineId, 
      locationId, 
      stopId, 
      cashAmount, 
      coinsAmount, 
      notes 
    }: { 
      machineId: string; 
      locationId: string | null; 
      stopId: string;
      cashAmount: number; 
      coinsAmount: number; 
      notes: string 
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const totalAmount = cashAmount + coinsAmount;
      
      const { error } = await supabase
        .from("revenue_collections")
        .insert({
          machine_id: machineId,
          location_id: locationId,
          route_stop_id: stopId,
          collected_by: user?.id,
          cash_amount: cashAmount,
          coins_amount: coinsAmount,
          total_amount: totalAmount,
          notes: notes || null,
        });
      if (error) throw error;

      logAuditEvent({
        action: "Revenue Collected",
        entity_type: "Revenue Collection",
        entity_id: machineId,
        details: { cash: cashAmount, coins: coinsAmount, total: totalAmount, stop_id: stopId },
      });
    },
    onSuccess: () => {
      toast({ 
        title: "Revenue Collected", 
        description: `$${(parseFloat(revenueForm.cashAmount || "0") + parseFloat(revenueForm.coinsAmount || "0")).toFixed(2)} recorded` 
      });
      setShowRevenueDialog(false);
      setRevenueForm({ cashAmount: "", coinsAmount: "", notes: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update route status
  const updateRouteStatusMutation = useMutation({
    mutationFn: async ({ routeId, status }: { routeId: string; status: string }) => {
      const { error } = await supabase
        .from("service_routes")
        .update({ status })
        .eq("id", routeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-routes"] });
      toast({ title: "Route Updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Reset all stops
  const resetRouteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      const { error } = await supabase
        .from("route_stops")
        .update({ status: "pending", completed_at: null })
        .eq("route_id", routeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops"] });
      setRouteStartTime(null);
      toast({ title: "Route Reset" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Create task from route stop
  const createTaskFromStopMutation = useMutation({
    mutationFn: async ({ title, description, priority, stopName }: { title: string; description: string; priority: string; stopName: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("daily_tasks").insert([{
        title,
        description: `[Route Stop: ${stopName}] ${description}`,
        priority,
        status: "pending",
        due_date: new Date().toISOString().split("T")[0],
        created_by: user?.id,
        assigned_to: user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["today-tasks-count"] });
      toast({ title: "Task Created", description: "Added to your daily tasks" });
      setShowTaskDialog(false);
      setTaskForm({ title: "", description: "", priority: "medium" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Fetch today's tasks to show count in header
  const { data: todayTasks } = useQuery({
    queryKey: ["today-tasks-count"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("daily_tasks")
        .select("id, title, status")
        .eq("due_date", today)
        .eq("status", "pending");
      if (error) throw error;
      return data || [];
    },
  });

  // Calculations
  const pendingStops = stops?.filter(s => s.status === "pending") || [];
  const completedStops = stops?.filter(s => s.status === "completed" || s.status === "skipped") || [];
  const currentStop = pendingStops[0];
  const progress = stops?.length ? Math.round((completedStops.length / stops.length) * 100) : 0;

  const totalEstimatedMinutes = stops?.reduce((acc, s) => acc + (s.estimated_duration_minutes || 15), 0) || 0;
  const remainingMinutes = pendingStops.reduce((acc, s) => acc + (s.estimated_duration_minutes || 15), 0);
  const completedMinutes = totalEstimatedMinutes - remainingMinutes;

  const lowStockItems = machineInventory?.filter(i => i.quantity <= 2) || [];

  // Filter stops by search
  const filteredPendingStops = pendingStops.filter(s => 
    s.stop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.machine?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openStopDetails = (stop: RouteStop) => {
    setSelectedStop(stop);
    setShowStopDetailsDialog(true);
  };

  const startRoute = () => {
    setRouteStartTime(new Date());
    toast({ title: "Route Started", description: "Good luck!" });
  };

  const formatTime = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const getETA = () => {
    const now = new Date();
    const eta = new Date(now.getTime() + remainingMinutes * 60000);
    return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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
      {/* Compact Header with Status Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl lg:text-2xl font-bold text-foreground truncate">My Route</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isOnline ? "outline" : "destructive"} className="text-xs">
            {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
            {isOnline ? "Online" : "Offline"}
          </Badge>
          <Button variant="ghost" size="icon" onClick={() => { refetchRoutes(); refetchStops(); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Today's Tasks Banner */}
      {todayTasks && todayTasks.length > 0 && (
        <Card className="p-3 border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium">{todayTasks.length} task{todayTasks.length !== 1 ? "s" : ""} due today</span>
            </div>
            <div className="flex items-center gap-1">
              {todayTasks.slice(0, 2).map(t => (
                <Badge key={t.id} variant="outline" className="text-xs max-w-[120px] truncate">{t.title}</Badge>
              ))}
              {todayTasks.length > 2 && <Badge variant="outline" className="text-xs">+{todayTasks.length - 2}</Badge>}
            </div>
          </div>
        </Card>
      )}

      {/* Manager View Toggle */}
      {isManager && (
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "my-route" | "all-routes")} className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-9">
            <TabsTrigger value="my-route" className="text-xs">Active Routes</TabsTrigger>
            <TabsTrigger value="all-routes" className="text-xs">All Routes</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Route Selector */}
      {routesWithAssignees && routesWithAssignees.length > 0 && (
        <Card className="p-3">
          <div className="space-y-2">
            <Select value={selectedRouteId || ""} onValueChange={setSelectedRouteId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select a route" />
              </SelectTrigger>
              <SelectContent>
                {routesWithAssignees.map(route => (
                  <SelectItem key={route.id} value={route.id}>
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      <span>{route.name}</span>
                      <Badge variant={route.status === "active" ? "default" : "secondary"} className="text-xs">
                        {route.status}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedRoute && isManager && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => updateRouteStatusMutation.mutate({ 
                    routeId: selectedRoute.id, 
                    status: selectedRoute.status === "active" ? "paused" : "active" 
                  })}
                >
                  {selectedRoute.status === "active" ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                  {selectedRoute.status === "active" ? "Pause" : "Activate"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => resetRouteMutation.mutate(selectedRoute.id)}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {(!routesWithAssignees || routesWithAssignees.length === 0) && (
        <Card className="py-12 text-center">
          <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold mb-1">No Routes Available</h3>
          <p className="text-sm text-muted-foreground">
            {isManager ? "Create routes in Route Manager" : "No routes assigned to you"}
          </p>
        </Card>
      )}

      {selectedRoute && (
        <>
          {/* Quick Stats Bar - Mobile Optimized */}
          <div className="grid grid-cols-4 gap-2">
            <Card className="p-2 text-center">
              <Target className="w-4 h-4 mx-auto text-primary mb-1" />
              <p className="text-lg font-bold">{pendingStops.length}</p>
              <p className="text-[10px] text-muted-foreground">Remaining</p>
            </Card>
            <Card className="p-2 text-center">
              <CheckCircle className="w-4 h-4 mx-auto text-green-500 mb-1" />
              <p className="text-lg font-bold">{completedStops.length}</p>
              <p className="text-[10px] text-muted-foreground">Complete</p>
            </Card>
            <Card className="p-2 text-center">
              <Timer className="w-4 h-4 mx-auto text-yellow-500 mb-1" />
              <p className="text-lg font-bold">{formatTime(remainingMinutes)}</p>
              <p className="text-[10px] text-muted-foreground">Time Left</p>
            </Card>
            <Card className="p-2 text-center">
              <Clock className="w-4 h-4 mx-auto text-blue-500 mb-1" />
              <p className="text-lg font-bold">{getETA()}</p>
              <p className="text-[10px] text-muted-foreground">ETA</p>
            </Card>
          </div>

          {/* Progress Bar with Visual Indicator */}
          <Card className="p-3">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">{selectedRoute.name}</span>
              <span className="text-primary font-bold">{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" />
            {!routeStartTime && pendingStops.length > 0 && completedStops.length === 0 && (
              <Button className="w-full mt-3" onClick={startRoute}>
                <Play className="w-4 h-4 mr-2" />
                Start Route
              </Button>
            )}
          </Card>

          {/* Current Stop - Hero Card */}
          {currentStop && (
            <Card className="border-2 border-primary bg-gradient-to-br from-primary/10 to-primary/5">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <Badge className="bg-primary text-primary-foreground">
                    <Navigation className="w-3 h-3 mr-1 animate-pulse" />
                    Stop {currentStop.stop_order + 1}/{stops?.length}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {currentStop.estimated_duration_minutes || 15}m
                  </Badge>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-foreground mb-1">{currentStop.stop_name}</h3>
                  {(currentStop.address || currentStop.location?.address) && (
                    <button 
                      className="text-sm text-muted-foreground flex items-start gap-2 text-left hover:text-primary transition-colors"
                      onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(currentStop.address || currentStop.location?.address || '')}`, '_blank')}
                    >
                      <MapPinned className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{currentStop.address || currentStop.location?.address}</span>
                    </button>
                  )}
                </div>

                {/* Machine Status Card */}
                {currentStop.machine && (
                  <div className="p-3 bg-card rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">{currentStop.machine.name}</span>
                      </div>
                      <Badge variant={currentStop.machine.status === "active" ? "outline" : "destructive"} className="text-xs">
                        {currentStop.machine.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{currentStop.machine.machine_code}</p>
                    {lowStockItems.length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {lowStockItems.length} items low stock
                      </Badge>
                    )}
                  </div>
                )}

                {/* Quick Contact Buttons */}
                {currentStop.location && (currentStop.location.contact_phone || currentStop.location.contact_email) && (
                  <div className="flex gap-2">
                    {currentStop.location.contact_phone && (
                      <Button variant="outline" size="sm" className="flex-1 h-9" asChild>
                        <a href={`tel:${currentStop.location.contact_phone}`}>
                          <Phone className="w-4 h-4 mr-2" />
                          Call
                        </a>
                      </Button>
                    )}
                    {currentStop.location.contact_email && (
                      <Button variant="outline" size="sm" className="flex-1 h-9" asChild>
                        <a href={`mailto:${currentStop.location.contact_email}`}>
                          <Mail className="w-4 h-4 mr-2" />
                          Email
                        </a>
                      </Button>
                    )}
                  </div>
                )}

                {currentStop.notes && (
                  <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
                    <FileText className="w-4 h-4 inline mr-2" />
                    {currentStop.notes}
                  </div>
                )}
                
                {/* Primary Actions */}
                <div className="grid grid-cols-1 gap-2">
                  <Button 
                    size="lg"
                    className="h-12 text-base"
                    onClick={() => completeStopMutation.mutate(currentStop.id)}
                    disabled={completeStopMutation.isPending}
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Complete Stop
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {currentStop.machine && (
                      <>
                        <Button 
                          variant="secondary"
                          size="sm"
                          className="h-10"
                          onClick={() => { setSelectedStop(currentStop); setRestockQuantities({}); setShowRestockDialog(true); }}
                        >
                          <Package className="w-4 h-4 mr-1" />
                          Restock
                        </Button>
                        <Button 
                          variant="secondary"
                          size="sm"
                          className="h-10 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => { setSelectedStop(currentStop); setShowRevenueDialog(true); }}
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Collect $
                        </Button>
                      </>
                    )}
                    <Button 
                      variant="outline"
                      size="sm"
                      className="h-10"
                      onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(currentStop.address || currentStop.location?.address || '')}`, '_blank')}
                    >
                      <Navigation className="w-4 h-4 mr-1" />
                      Navigate
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="h-10"
                      onClick={() => { setSelectedStop(currentStop); setShowIssueDialog(true); }}
                    >
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Issue
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Search for Stops */}
          {pendingStops.length > 2 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search stops, machines..." 
                className="pl-9 h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {/* Upcoming Stops */}
          {filteredPendingStops.length > 1 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2 text-yellow-600">
                  <Clock className="w-4 h-4" />
                  Up Next ({filteredPendingStops.length - 1})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0">
                <div className="space-y-1">
                  {filteredPendingStops.slice(1, 6).map((stop, idx) => (
                    <div 
                      key={stop.id} 
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors cursor-pointer"
                      onClick={() => openStopDetails(stop)}
                    >
                      <div className="w-7 h-7 rounded-full bg-yellow-500/20 text-yellow-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {stop.stop_order + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{stop.stop_name}</p>
                        {stop.machine && (
                          <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                            <Monitor className="w-3 h-3" />
                            {stop.machine.machine_code}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{stop.estimated_duration_minutes || 15}m</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                  {filteredPendingStops.length > 6 && (
                    <p className="text-xs text-center text-muted-foreground py-2">
                      +{filteredPendingStops.length - 6} more stops
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Completed Stops */}
          {completedStops.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                  <History className="w-4 h-4" />
                  Completed ({completedStops.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0">
                <div className="space-y-1">
                  {completedStops.slice(0, 5).map((stop) => (
                    <div 
                      key={stop.id} 
                      className="flex items-center gap-3 p-2 rounded-lg opacity-60"
                      onClick={() => openStopDetails(stop)}
                    >
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{stop.stop_name}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {stop.completed_at && new Date(stop.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isManager && (
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); resetStopMutation.mutate(stop.id); }}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Route Complete */}
          {pendingStops.length === 0 && completedStops.length > 0 && (
            <Card className="border-2 border-green-500 bg-gradient-to-br from-green-500/10 to-green-500/5">
              <CardContent className="py-8 text-center">
                <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                  <ThumbsUp className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-bold mb-2">Route Complete!</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {completedStops.length} stops completed
                  {routeStartTime && ` in ${formatTime(Math.round((Date.now() - routeStartTime.getTime()) / 60000))}`}
                </p>
                {isManager && (
                  <Button variant="outline" onClick={() => resetRouteMutation.mutate(selectedRoute.id)}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset for Tomorrow
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Stop Details Dialog */}
      <Dialog open={showStopDetailsDialog} onOpenChange={setShowStopDetailsDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Stop Details
            </DialogTitle>
          </DialogHeader>
          {selectedStop && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold">{selectedStop.stop_name}</h3>
                <Badge variant={selectedStop.status === "completed" ? "default" : selectedStop.status === "skipped" ? "secondary" : "outline"} className="mt-1">
                  {selectedStop.status}
                </Badge>
              </div>

              {(selectedStop.address || selectedStop.location?.address) && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-1 text-muted-foreground" />
                  <p>{selectedStop.address || selectedStop.location?.address}</p>
                </div>
              )}

              {selectedStop.machine && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    {selectedStop.machine.name}
                  </p>
                  <p className="text-sm text-muted-foreground font-mono">{selectedStop.machine.machine_code}</p>
                </div>
              )}

              {selectedStop.location && (
                <div className="space-y-2 text-sm">
                  {selectedStop.location.contact_name && (
                    <p className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {selectedStop.location.contact_name}
                    </p>
                  )}
                  {selectedStop.location.contact_phone && (
                    <a href={`tel:${selectedStop.location.contact_phone}`} className="flex items-center gap-2 text-primary">
                      <Phone className="w-4 h-4" />
                      {selectedStop.location.contact_phone}
                    </a>
                  )}
                  {selectedStop.location.contact_email && (
                    <a href={`mailto:${selectedStop.location.contact_email}`} className="flex items-center gap-2 text-primary">
                      <Mail className="w-4 h-4" />
                      {selectedStop.location.contact_email}
                    </a>
                  )}
                </div>
              )}

              {selectedStop.notes && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm">{selectedStop.notes}</p>
                </div>
              )}

              {/* Machine Inventory */}
              {selectedStop.machine && machineInventory && machineInventory.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Inventory
                  </h4>
                  <ScrollArea className="h-[150px]">
                    <div className="space-y-1">
                      {machineInventory.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                          <span className="truncate flex-1">{item.product_name}</span>
                          <Badge variant={item.quantity <= 2 ? "destructive" : "outline"} className="text-xs ml-2">
                            {item.quantity}/{item.max_capacity}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {selectedStop?.status === "pending" && (
              <>
                <Button className="flex-1" onClick={() => { completeStopMutation.mutate(selectedStop.id); setShowStopDetailsDialog(false); }}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => { skipStopMutation.mutate({ stopId: selectedStop.id, reason: "Manual skip" }); setShowStopDetailsDialog(false); }}>
                  <SkipForward className="w-4 h-4 mr-2" />
                  Skip
                </Button>
              </>
            )}
            <Button 
              variant="secondary" 
              className="flex-1"
              onClick={() => {
                setTaskForm({ 
                  title: `Follow up: ${selectedStop?.stop_name || ""}`, 
                  description: selectedStop?.machine ? `Machine: ${selectedStop.machine.name} (${selectedStop.machine.machine_code})` : "",
                  priority: "medium" 
                });
                setShowStopDetailsDialog(false);
                setShowTaskDialog(true);
              }}
            >
              <ListTodo className="w-4 h-4 mr-2" />
              Create Task
            </Button>
            {selectedStop?.status !== "pending" && isManager && (
              <Button variant="outline" onClick={() => { resetStopMutation.mutate(selectedStop!.id); setShowStopDetailsDialog(false); }}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={showRestockDialog} onOpenChange={setShowRestockDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Restock Machine
            </DialogTitle>
            <DialogDescription>
              {selectedStop?.machine?.name} — adjust quantities per slot
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {machineInventory && machineInventory.length > 0 ? (
              <ScrollArea className="max-h-[350px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Slot</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Add</TableHead>
                      <TableHead>New</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {machineInventory.map(item => {
                      const toAdd = restockQuantities[item.id] ?? (item.max_capacity - item.quantity);
                      const newQty = Math.min(item.max_capacity, item.quantity + Math.max(0, toAdd));
                      return (
                        <TableRow key={item.id} className={item.quantity === 0 ? "bg-destructive/5" : item.quantity <= 2 ? "bg-yellow-500/5" : ""}>
                          <TableCell className="font-mono text-xs">{item.slot_number || "—"}</TableCell>
                          <TableCell>
                            <span className="font-medium text-sm">{item.product_name}</span>
                            <span className="block text-xs text-muted-foreground">{item.sku}</span>
                          </TableCell>
                          <TableCell>
                            <span className={item.quantity === 0 ? "text-destructive font-bold" : ""}>{item.quantity}/{item.max_capacity}</span>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={item.max_capacity - item.quantity}
                              value={toAdd}
                              onChange={e => setRestockQuantities(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                              className="w-16 h-8"
                            />
                          </TableCell>
                          <TableCell className="font-bold text-primary">{newQty}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <p className="text-center text-muted-foreground py-4">No inventory slots configured</p>
            )}
            <div>
              <Label htmlFor="restock-notes">Notes</Label>
              <Textarea
                id="restock-notes"
                placeholder="Any issues or observations..."
                value={restockNotes}
                onChange={(e) => setRestockNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Warehouse stock will be auto-deducted on confirm
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestockDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => selectedStop?.machine && logRestockMutation.mutate({ 
                machineId: selectedStop.machine.id, 
                notes: restockNotes,
                quantities: restockQuantities,
              })}
              disabled={logRestockMutation.isPending}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirm Restock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Issue Dialog */}
      <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Report Issue
            </DialogTitle>
            <DialogDescription>
              {selectedStop?.stop_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="issue">Describe the issue</Label>
              <Textarea
                id="issue"
                placeholder="What's wrong with the machine or location?"
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIssueDialog(false)}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={() => selectedStop?.machine && reportIssueMutation.mutate({ 
                stopId: selectedStop.id, 
                machineId: selectedStop.machine.id, 
                description: issueDescription 
              })}
              disabled={!issueDescription.trim() || reportIssueMutation.isPending}
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revenue Collection Dialog */}
      <Dialog open={showRevenueDialog} onOpenChange={setShowRevenueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Collect Revenue
            </DialogTitle>
            <DialogDescription>
              {selectedStop?.machine?.name} - {selectedStop?.stop_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cashAmount" className="flex items-center gap-2">
                  <Banknote className="w-4 h-4" />
                  Cash ($)
                </Label>
                <Input
                  id="cashAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={revenueForm.cashAmount}
                  onChange={(e) => setRevenueForm({ ...revenueForm, cashAmount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coinsAmount" className="flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  Coins ($)
                </Label>
                <Input
                  id="coinsAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={revenueForm.coinsAmount}
                  onChange={(e) => setRevenueForm({ ...revenueForm, coinsAmount: e.target.value })}
                />
              </div>
            </div>
            
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-700 dark:text-green-300">Total Collection</span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  ${(parseFloat(revenueForm.cashAmount || "0") + parseFloat(revenueForm.coinsAmount || "0")).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="revenueNotes">Notes (optional)</Label>
              <Textarea
                id="revenueNotes"
                placeholder="Any notes about the collection..."
                value={revenueForm.notes}
                onChange={(e) => setRevenueForm({ ...revenueForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevenueDialog(false)}>Cancel</Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => selectedStop?.machine && collectRevenueMutation.mutate({ 
                machineId: selectedStop.machine.id,
                locationId: selectedStop.location_id,
                stopId: selectedStop.id,
                cashAmount: parseFloat(revenueForm.cashAmount || "0"),
                coinsAmount: parseFloat(revenueForm.coinsAmount || "0"),
                notes: revenueForm.notes
              })}
              disabled={
                collectRevenueMutation.isPending || 
                (parseFloat(revenueForm.cashAmount || "0") + parseFloat(revenueForm.coinsAmount || "0")) <= 0
              }
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirm Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task from Stop Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-primary" />
              Create Task
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Task title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Details..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => createTaskFromStopMutation.mutate({ ...taskForm, stopName: selectedStop?.stop_name || "" })}
              disabled={!taskForm.title.trim() || createTaskFromStopMutation.isPending}
            >
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyRoute;