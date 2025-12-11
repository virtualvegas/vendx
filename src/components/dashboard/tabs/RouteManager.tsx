import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, MapPin, Users, Route, Eye } from "lucide-react";

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
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

const RouteManager = () => {
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<ServiceRoute | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [routeForm, setRouteForm] = useState({ name: "", description: "", assigned_to: "", status: "active" });
  const [stopForm, setStopForm] = useState({ stop_name: "", address: "", notes: "", estimated_duration_minutes: 15 });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all routes
  const { data: routes, isLoading: routesLoading } = useQuery({
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
  const { data: stops } = useQuery({
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
      toast({ title: "Success", description: "Route created successfully" });
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
      toast({ title: "Success", description: "Route updated successfully" });
      setRouteDialogOpen(false);
      resetRouteForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_routes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-routes"] });
      toast({ title: "Success", description: "Route deleted successfully" });
      if (selectedRouteId) setSelectedRouteId(null);
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
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-stops", selectedRouteId] });
      toast({ title: "Success", description: "Stop added successfully" });
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
      toast({ title: "Success", description: "Stop removed successfully" });
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
    setStopForm({ stop_name: "", address: "", notes: "", estimated_duration_minutes: 15 });
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
    createStopMutation.mutate(stopForm);
  };

  const getAssigneeName = (userId: string | null) => {
    if (!userId) return "Unassigned";
    const employee = employees?.find(e => e.id === userId);
    return employee?.full_name || employee?.email || "Unknown";
  };

  const activeRoutes = routes?.filter(r => r.status === "active") || [];
  const selectedRoute = routes?.find(r => r.id === selectedRouteId);

  if (routesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading routes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Route Manager</h2>
          <p className="text-muted-foreground">Create and manage service routes for field operators</p>
        </div>
        <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetRouteForm}>
              <Plus className="w-4 h-4 mr-2" />
              Create Route
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setRouteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingRoute ? "Update" : "Create"} Route
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Routes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{routes?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Routes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">{activeRoutes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Operators Available</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{employees?.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Routes List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="w-5 h-5" />
              All Routes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {routes?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No routes created yet</p>
            ) : (
              <div className="space-y-3">
                {routes?.map((route) => (
                  <div 
                    key={route.id} 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedRouteId === route.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedRouteId(route.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-foreground">{route.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Assigned: {getAssigneeName(route.assigned_to)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={route.status === "active" ? "default" : "secondary"}>
                          {route.status}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditRoute(route); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); deleteRouteMutation.mutate(route.id); }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Route Stops */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Route Stops
              </CardTitle>
              {selectedRouteId && (
                <Dialog open={stopDialogOpen} onOpenChange={setStopDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={resetStopForm}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Stop
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Stop to {selectedRoute?.name}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleStopSubmit} className="space-y-4">
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
                        <Label htmlFor="duration">Estimated Duration (minutes)</Label>
                        <Input
                          id="duration"
                          type="number"
                          value={stopForm.estimated_duration_minutes}
                          onChange={(e) => setStopForm({ ...stopForm, estimated_duration_minutes: parseInt(e.target.value) })}
                          min={5}
                          max={120}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setStopDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">Add Stop</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedRouteId ? (
              <p className="text-center text-muted-foreground py-8">Select a route to view stops</p>
            ) : stops?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No stops added yet</p>
            ) : (
              <div className="space-y-2">
                {stops?.map((stop, index) => (
                  <div key={stop.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">{stop.stop_name}</h4>
                      {stop.address && (
                        <p className="text-sm text-muted-foreground">{stop.address}</p>
                      )}
                    </div>
                    <Badge variant={stop.status === "completed" ? "default" : "outline"}>
                      {stop.status}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => deleteStopMutation.mutate(stop.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RouteManager;