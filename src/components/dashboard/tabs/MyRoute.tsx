import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, Clock, CheckCircle, Navigation, Package, 
  RefreshCw, User, Calendar, AlertTriangle, Monitor,
  Phone, Mail, FileText, Truck, Play, Pause, RotateCcw
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
  const [selectedStop, setSelectedStop] = useState<RouteStop | null>(null);
  const [restockNotes, setRestockNotes] = useState("");
  const [activeView, setActiveView] = useState<"my-route" | "all-routes">("my-route");
  const [userRoles, setUserRoles] = useState<string[]>([]);

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

  // Fetch routes - all for managers, assigned for operators
  const { data: routes, isLoading: routesLoading, refetch: refetchRoutes } = useQuery({
    queryKey: ["my-routes", currentUser?.id, isManager, activeView],
    queryFn: async () => {
      let query = supabase
        .from("service_routes")
        .select("*")
        .order("created_at", { ascending: false });

      // For operators, only show their assigned routes
      // For managers viewing "my-route", show all; for "all-routes" show all active
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

  // Fetch assignee profiles for routes
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

  // Auto-select first route
  useEffect(() => {
    if (routesWithAssignees && routesWithAssignees.length > 0 && !selectedRouteId) {
      // For operators, select their first assigned active route
      // For managers, select the first route
      const firstRoute = routesWithAssignees[0];
      setSelectedRouteId(firstRoute.id);
    }
  }, [routesWithAssignees, selectedRouteId]);

  const selectedRoute = routesWithAssignees?.find(r => r.id === selectedRouteId);

  // Fetch stops for selected route with machine and location details
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

  // Fetch machine inventory for selected stop
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
        .update({ 
          status: "completed", 
          completed_at: new Date().toISOString() 
        })
        .eq("id", stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops"] });
      toast({ title: "Stop Completed", description: "Moving to next stop" });
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
        .update({ 
          status: "pending", 
          completed_at: null 
        })
        .eq("id", stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops"] });
      toast({ title: "Stop Reset", description: "Stop marked as pending" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Log restock mutation
  const logRestockMutation = useMutation({
    mutationFn: async ({ machineId, notes }: { machineId: string; notes: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("restock_logs")
        .insert({
          machine_id: machineId,
          performed_by: user?.id,
          notes,
          items_restocked: machineInventory?.map(i => ({
            product_name: i.product_name,
            quantity_added: i.max_capacity - i.quantity,
          })) || [],
        });
      if (error) throw error;

      // Update machine inventory to full capacity
      if (machineInventory && machineInventory.length > 0) {
        for (const item of machineInventory) {
          await supabase
            .from("machine_inventory")
            .update({ 
              quantity: item.max_capacity, 
              last_restocked: new Date().toISOString() 
            })
            .eq("id", item.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machine-inventory"] });
      toast({ title: "Restock Logged", description: "Machine inventory updated" });
      setShowRestockDialog(false);
      setRestockNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update route status mutation
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

  // Reset all stops in route
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
      toast({ title: "Route Reset", description: "All stops marked as pending" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const pendingStops = stops?.filter(s => s.status === "pending") || [];
  const completedStops = stops?.filter(s => s.status === "completed") || [];
  const currentStop = pendingStops[0];
  const progress = stops?.length ? Math.round((completedStops.length / stops.length) * 100) : 0;

  const openStopDetails = (stop: RouteStop) => {
    setSelectedStop(stop);
    setShowStopDetailsDialog(true);
  };

  const openRestockDialog = () => {
    setShowRestockDialog(true);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">My Route</h2>
          <p className="text-muted-foreground">
            {isManager ? "View and manage all service routes" : "View and manage your assigned service route"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchRoutes(); refetchStops(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Manager view toggle */}
      {isManager && (
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "my-route" | "all-routes")}>
          <TabsList>
            <TabsTrigger value="my-route">Active Routes</TabsTrigger>
            <TabsTrigger value="all-routes">All Routes</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Route Selector */}
      {routesWithAssignees && routesWithAssignees.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[250px]">
                <Label className="mb-2 block">Select Route</Label>
                <Select value={selectedRouteId || ""} onValueChange={setSelectedRouteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a route" />
                  </SelectTrigger>
                  <SelectContent>
                    {routesWithAssignees.map(route => (
                      <SelectItem key={route.id} value={route.id}>
                        <div className="flex items-center gap-2">
                          <span>{route.name}</span>
                          <Badge variant={route.status === "active" ? "default" : "secondary"} className="text-xs">
                            {route.status}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedRoute && isManager && (
                <div className="flex gap-2">
                  {selectedRoute.status === "active" ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateRouteStatusMutation.mutate({ routeId: selectedRoute.id, status: "paused" })}
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateRouteStatusMutation.mutate({ routeId: selectedRoute.id, status: "active" })}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Activate
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => resetRouteMutation.mutate(selectedRoute.id)}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset Route
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(!routesWithAssignees || routesWithAssignees.length === 0) && (
        <Card>
          <CardContent className="py-16 text-center">
            <MapPin className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Routes Available</h3>
            <p className="text-muted-foreground">
              {isManager 
                ? "No routes have been created yet. Use Route Manager to create routes."
                : "You don't have any active routes assigned to you."}
            </p>
          </CardContent>
        </Card>
      )}

      {selectedRoute && (
        <>
          {/* Route Info */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" />
                    {selectedRoute.name}
                  </CardTitle>
                  {selectedRoute.description && (
                    <CardDescription>{selectedRoute.description}</CardDescription>
                  )}
                </div>
                <Badge variant={selectedRoute.status === "active" ? "default" : "secondary"}>
                  {selectedRoute.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{stops?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Stops</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-green-500">{completedStops.length}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-500">{pendingStops.length}</p>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{progress}%</p>
                  <p className="text-xs text-muted-foreground">Progress</p>
                </div>
                {selectedRoute.assignee && (
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium truncate">{selectedRoute.assignee.full_name || selectedRoute.assignee.email}</p>
                    <p className="text-xs text-muted-foreground">Assigned To</p>
                  </div>
                )}
              </div>
              <Progress value={progress} className="mt-4 h-2" />
            </CardContent>
          </Card>

          {/* Current Stop */}
          {currentStop && (
            <Card className="border-primary border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-primary animate-pulse" />
                    Current Stop
                  </CardTitle>
                  <Badge className="bg-primary">
                    Stop {currentStop.stop_order + 1} of {stops?.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-2xl font-bold text-foreground">{currentStop.stop_name}</h3>
                  {(currentStop.address || currentStop.location?.address) && (
                    <p className="text-muted-foreground flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4" />
                      {currentStop.address || currentStop.location?.address}
                    </p>
                  )}
                </div>

                {/* Machine Info */}
                {currentStop.machine && (
                  <div className="flex items-center gap-3 p-3 bg-accent/10 rounded-lg">
                    <Monitor className="w-5 h-5 text-accent" />
                    <div>
                      <p className="font-medium">{currentStop.machine.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{currentStop.machine.machine_code}</p>
                    </div>
                    <Badge variant={currentStop.machine.status === "active" ? "outline" : "destructive"} className="ml-auto">
                      {currentStop.machine.status}
                    </Badge>
                  </div>
                )}

                {/* Location Contact */}
                {currentStop.location && (currentStop.location.contact_name || currentStop.location.contact_phone) && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    {currentStop.location.contact_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4 text-muted-foreground" />
                        {currentStop.location.contact_name}
                      </span>
                    )}
                    {currentStop.location.contact_phone && (
                      <a href={`tel:${currentStop.location.contact_phone}`} className="flex items-center gap-1 text-primary hover:underline">
                        <Phone className="w-4 h-4" />
                        {currentStop.location.contact_phone}
                      </a>
                    )}
                    {currentStop.location.contact_email && (
                      <a href={`mailto:${currentStop.location.contact_email}`} className="flex items-center gap-1 text-primary hover:underline">
                        <Mail className="w-4 h-4" />
                        {currentStop.location.contact_email}
                      </a>
                    )}
                  </div>
                )}
                
                {currentStop.notes && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground flex items-start gap-2">
                      <FileText className="w-4 h-4 mt-0.5" />
                      {currentStop.notes}
                    </p>
                  </div>
                )}
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Est. {currentStop.estimated_duration_minutes || 15} min
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <Button 
                    className="flex-1"
                    onClick={() => completeStopMutation.mutate(currentStop.id)}
                    disabled={completeStopMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Complete Stop
                  </Button>
                  {currentStop.machine && (
                    <Button 
                      variant="secondary"
                      onClick={() => { setSelectedStop(currentStop); openRestockDialog(); }}
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Log Restock
                    </Button>
                  )}
                  {(currentStop.address || currentStop.location?.address) && (
                    <Button 
                      variant="outline"
                      onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(currentStop.address || currentStop.location?.address || '')}`, '_blank')}
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      Navigate
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => openStopDetails(currentStop)}>
                    Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Stops */}
          {pendingStops.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-yellow-500">Upcoming Stops ({pendingStops.length - 1})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingStops.slice(1).map((stop) => (
                    <div 
                      key={stop.id} 
                      className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => openStopDetails(stop)}
                    >
                      <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-sm font-medium">
                        {stop.stop_order + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground truncate">{stop.stop_name}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {stop.machine && (
                            <span className="flex items-center gap-1">
                              <Monitor className="w-3 h-3" />
                              {stop.machine.machine_code}
                            </span>
                          )}
                          {(stop.address || stop.location?.city) && (
                            <span className="truncate">{stop.address || stop.location?.city}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {stop.estimated_duration_minutes || 15} min
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Completed Stops */}
          {completedStops.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-green-500">Completed Stops ({completedStops.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {completedStops.map((stop) => (
                    <div 
                      key={stop.id} 
                      className="flex items-center gap-3 p-3 border border-border rounded-lg opacity-70 hover:opacity-100 cursor-pointer transition-opacity"
                      onClick={() => openStopDetails(stop)}
                    >
                      <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground truncate">{stop.stop_name}</h4>
                        {stop.completed_at && (
                          <p className="text-sm text-muted-foreground">
                            Completed at {new Date(stop.completed_at).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                      {isManager && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); resetStopMutation.mutate(stop.id); }}
                        >
                          <RotateCcw className="w-4 h-4" />
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
            <Card className="border-green-500 bg-green-500/10">
              <CardContent className="py-8 text-center">
                <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">Route Complete!</h3>
                <p className="text-muted-foreground mb-4">Great job! You've completed all stops on your route.</p>
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
        <DialogContent className="max-w-lg">
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
                <Badge variant={selectedStop.status === "completed" ? "default" : "secondary"} className="mt-1">
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

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Est. {selectedStop.estimated_duration_minutes || 15} min
                </span>
                {selectedStop.completed_at && (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    {new Date(selectedStop.completed_at).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Machine Inventory */}
              {selectedStop.machine && machineInventory && machineInventory.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Machine Inventory
                  </h4>
                  <ScrollArea className="h-[150px]">
                    <div className="space-y-2">
                      {machineInventory.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                          <span>{item.product_name}</span>
                          <span className={item.quantity <= 2 ? "text-destructive font-medium" : ""}>
                            {item.quantity}/{item.max_capacity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedStop?.status === "pending" && (
              <Button onClick={() => { completeStopMutation.mutate(selectedStop.id); setShowStopDetailsDialog(false); }}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Complete Stop
              </Button>
            )}
            {selectedStop?.status === "completed" && isManager && (
              <Button variant="outline" onClick={() => { resetStopMutation.mutate(selectedStop.id); setShowStopDetailsDialog(false); }}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset Stop
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={showRestockDialog} onOpenChange={setShowRestockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Log Restock
            </DialogTitle>
            <DialogDescription>
              Log a restock for {selectedStop?.machine?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {machineInventory && machineInventory.length > 0 && (
              <div>
                <Label>Current Inventory</Label>
                <div className="mt-2 space-y-2">
                  {machineInventory.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                      <span>{item.product_name}</span>
                      <div className="flex items-center gap-2">
                        <span className={item.quantity <= 2 ? "text-destructive" : ""}>
                          {item.quantity}/{item.max_capacity}
                        </span>
                        {item.quantity < item.max_capacity && (
                          <Badge variant="outline" className="text-xs">
                            +{item.max_capacity - item.quantity}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={restockNotes}
                onChange={(e) => setRestockNotes(e.target.value)}
                placeholder="Any notes about this restock..."
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestockDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => selectedStop?.machine_id && logRestockMutation.mutate({ machineId: selectedStop.machine_id, notes: restockNotes })}
              disabled={logRestockMutation.isPending}
            >
              <Package className="w-4 h-4 mr-2" />
              Log Restock & Fill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyRoute;