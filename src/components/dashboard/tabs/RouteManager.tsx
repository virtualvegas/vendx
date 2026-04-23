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
  Plus, Edit, Trash2, MapPin, Users, Route, RefreshCw,
  ChevronDown, ChevronUp, Clock, CheckCircle,
  AlertTriangle, Copy, Search, Filter, MoreVertical,
  Monitor, Building, ArrowUp, ArrowDown, Navigation,
  Zap, Calendar, AlertCircle, Compass, TrendingUp, Timer
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { optimizeRouteOrder, calculateTotalDistance, estimateTravelTime, isZoneDueForService, getNextServiceDate } from "@/lib/routeOptimization";
import { format, formatDistanceToNow, addDays, isAfter, isBefore, isToday } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";

interface ServiceZone {
  id: string;
  name: string;
  description: string | null;
  assigned_to: string | null;
  status: string;
  created_at: string;
  zone_area: string | null;
  service_frequency_days: number | null;
  last_serviced_at: string | null;
  next_service_due: string | null;
  office_id: string | null;
  warehouse_id: string | null;
  is_multi_day: boolean | null;
  total_days: number | null;
  start_date: string | null;
  end_date: string | null;
  reassigned_at: string | null;
  reassigned_by: string | null;
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
  scheduled_date: string | null;
  priority: string | null;
  auto_scheduled: boolean | null;
  source_ticket_id: string | null;
  day_number: number | null;
  inventory_priority_score: number | null;
  low_inventory_flagged: boolean | null;
  location?: {
    id: string;
    latitude: number | null;
    longitude: number | null;
    name: string | null;
    city: string;
    address: string | null;
  } | null;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  office_id?: string | null;
}

interface Location {
  id: string;
  name: string | null;
  address: string | null;
  city: string;
  contact_name: string | null;
  contact_phone: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface Machine {
  id: string;
  name: string;
  machine_code: string;
  location_id: string | null;
  status: string;
}

const RouteManager = () => {
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ServiceZone | null>(null);
  const [editingStop, setEditingStop] = useState<RouteStop | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [zoneForm, setZoneForm] = useState({ 
    name: "", 
    description: "", 
    assigned_to: "", 
    status: "active",
    zone_area: "",
    service_frequency_days: 15,
    office_id: "",
    warehouse_id: "",
    is_multi_day: false,
    total_days: 1,
    start_date: "",
    end_date: "",
  });
  const [stopForm, setStopForm] = useState({ 
    stop_name: "", 
    address: "", 
    notes: "", 
    estimated_duration_minutes: 15,
    location_id: "",
    machine_id: "",
    scheduled_date: "",
    priority: "normal",
    day_number: 1,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"zones" | "schedule" | "analytics">("zones");
  const [scheduleFilter, setScheduleFilter] = useState<"today" | "upcoming" | "overdue" | "all">("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all zones
  const { data: zones, isLoading: zonesLoading, refetch: refetchZones } = useQuery({
    queryKey: ["admin-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_routes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceZone[];
    },
  });

  // Fetch employees (with office_id so we can scope by route's office)
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
        .select("id, email, full_name, office_id")
        .in("id", userIds);
      if (profileError) throw profileError;
      
      return profiles as UserProfile[];
    },
  });

  // Fetch stops for selected zone with location data for optimization
  const { data: stops, refetch: refetchStops } = useQuery({
    queryKey: ["zone-stops", selectedZoneId],
    queryFn: async () => {
      if (!selectedZoneId) return [];
      const { data, error } = await supabase
        .from("route_stops")
        .select(`
          *,
          location:locations(id, name, city, address, latitude, longitude)
        `)
        .eq("route_id", selectedZoneId)
        .order("stop_order", { ascending: true });
      if (error) throw error;
      return data as RouteStop[];
    },
    enabled: !!selectedZoneId,
  });

  // Fetch all scheduled stops across all zones
  const { data: allScheduledStops } = useQuery({
    queryKey: ["all-scheduled-stops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_stops")
        .select(`
          *,
          location:locations(id, name, city, address),
          zone:service_routes(id, name, assigned_to)
        `)
        .not("scheduled_date", "is", null)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ["all-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, address, city, contact_name, contact_phone, latitude, longitude")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as Location[];
    },
  });

  // Fetch machines
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

  // Fetch offices & warehouses for assignment
  const { data: offices } = useQuery({
    queryKey: ["all-offices-for-routes"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase.from("vendx_offices" as any).select("id, name, code").eq("status", "active").order("name");
      return (data as any[]) || [];
    },
  });
  const { data: warehouses } = useQuery({
    queryKey: ["all-warehouses-for-routes"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase.from("vendx_warehouses" as any).select("id, name, code").eq("status", "active").order("name");
      return (data as any[]) || [];
    },
  });

  // Fetch all stops for analytics
  const { data: allStops } = useQuery({
    queryKey: ["all-zone-stops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_stops")
        .select("*, service_routes(name, status)");
      if (error) throw error;
      return data;
    },
  });

  // Zone mutations
  const createZoneMutation = useMutation({
    mutationFn: async (data: typeof zoneForm) => {
      const { error } = await supabase.from("service_routes").insert([{
        name: data.name,
        description: data.description || null,
        assigned_to: data.assigned_to || null,
        status: data.status,
        zone_area: data.zone_area || null,
        service_frequency_days: data.service_frequency_days,
        office_id: data.office_id || null,
        warehouse_id: data.warehouse_id || null,
        is_multi_day: data.is_multi_day,
        total_days: data.is_multi_day ? Math.max(1, data.total_days) : 1,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      } as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
      toast({ title: "Zone Created" });
      setZoneDialogOpen(false);
      resetZoneForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateZoneMutation = useMutation({
    mutationFn: async ({ id, data, isReassignment }: { id: string; data: typeof zoneForm; isReassignment?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        name: data.name,
        description: data.description || null,
        assigned_to: data.assigned_to || null,
        status: data.status,
        zone_area: data.zone_area || null,
        service_frequency_days: data.service_frequency_days,
        office_id: data.office_id || null,
        warehouse_id: data.warehouse_id || null,
        is_multi_day: data.is_multi_day,
        total_days: data.is_multi_day ? Math.max(1, data.total_days) : 1,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      };
      if (isReassignment) {
        payload.reassigned_at = new Date().toISOString();
        payload.reassigned_by = user?.id ?? null;
      }
      const { error } = await supabase.from("service_routes").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
      toast({ title: vars?.isReassignment ? "Operator Reassigned" : "Zone Updated" });
      setZoneDialogOpen(false);
      resetZoneForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteZoneMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("route_stops").delete().eq("route_id", id);
      const { error } = await supabase.from("service_routes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
      toast({ title: "Zone Deleted" });
      if (selectedZoneId) setSelectedZoneId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const duplicateZoneMutation = useMutation({
    mutationFn: async (zoneId: string) => {
      const zone = zones?.find(r => r.id === zoneId);
      if (!zone) throw new Error("Zone not found");
      
      const { data: newZone, error: zoneError } = await supabase
        .from("service_routes")
        .insert([{
          name: `${zone.name} (Copy)`,
          description: zone.description,
          status: "inactive",
          zone_area: zone.zone_area,
          service_frequency_days: zone.service_frequency_days,
        }])
        .select()
        .single();
      if (zoneError) throw zoneError;

      const { data: existingStops } = await supabase
        .from("route_stops")
        .select("*")
        .eq("route_id", zoneId);

      if (existingStops && existingStops.length > 0) {
        const newStops = existingStops.map(s => ({
          route_id: newZone.id,
          stop_name: s.stop_name,
          address: s.address,
          notes: s.notes,
          stop_order: s.stop_order,
          estimated_duration_minutes: s.estimated_duration_minutes,
          location_id: s.location_id,
          machine_id: s.machine_id,
          priority: s.priority,
          status: "pending",
        }));
        await supabase.from("route_stops").insert(newStops);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
      toast({ title: "Zone Duplicated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Route optimization mutation
  const optimizeRouteMutation = useMutation({
    mutationFn: async () => {
      if (!stops || stops.length < 2) throw new Error("Need at least 2 stops to optimize");
      
      const stopsWithLocations = stops.filter(s => s.location?.latitude && s.location?.longitude);
      if (stopsWithLocations.length < 2) throw new Error("Need at least 2 stops with coordinates");

      const optimizedOrder = optimizeRouteOrder(stops);
      
      // Update each stop with new order
      for (const { id, newOrder } of optimizedOrder) {
        await supabase.from("route_stops").update({ stop_order: newOrder }).eq("id", id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zone-stops", selectedZoneId] });
      toast({ 
        title: "Route Optimized", 
        description: "Stops reordered for shortest travel distance" 
      });
    },
    onError: (error: any) => {
      toast({ title: "Optimization Failed", description: error.message, variant: "destructive" });
    },
  });

  // Mark zone as serviced
  const markZoneServicedMutation = useMutation({
    mutationFn: async (zoneId: string) => {
      const zone = zones?.find(z => z.id === zoneId);
      const nextDue = getNextServiceDate(new Date(), zone?.service_frequency_days || 15);
      
      const { error } = await supabase.from("service_routes").update({
        last_serviced_at: new Date().toISOString(),
        next_service_due: nextDue.toISOString(),
      }).eq("id", zoneId);
      if (error) throw error;

      // Reset all stops to pending
      await supabase.from("route_stops").update({ 
        status: "pending", 
        completed_at: null 
      }).eq("route_id", zoneId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
      queryClient.invalidateQueries({ queryKey: ["zone-stops", selectedZoneId] });
      toast({ title: "Zone Marked Serviced", description: "Next service date scheduled" });
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
        route_id: selectedZoneId,
        stop_name: data.stop_name,
        address: data.address || null,
        notes: data.notes || null,
        estimated_duration_minutes: data.estimated_duration_minutes,
        stop_order: maxOrder,
        location_id: data.location_id || null,
        machine_id: data.machine_id || null,
        scheduled_date: data.scheduled_date || null,
        priority: data.priority,
        day_number: Math.max(1, data.day_number || 1),
      } as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zone-stops", selectedZoneId] });
      queryClient.invalidateQueries({ queryKey: ["all-scheduled-stops"] });
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
        scheduled_date: data.scheduled_date || null,
        priority: data.priority,
        day_number: Math.max(1, data.day_number || 1),
      } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zone-stops", selectedZoneId] });
      queryClient.invalidateQueries({ queryKey: ["all-scheduled-stops"] });
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
      queryClient.invalidateQueries({ queryKey: ["zone-stops", selectedZoneId] });
      queryClient.invalidateQueries({ queryKey: ["all-scheduled-stops"] });
      toast({ title: "Stop Removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["zone-stops", selectedZoneId] });
    },
  });

  const resetZoneForm = () => {
    setZoneForm({ name: "", description: "", assigned_to: "", status: "active", zone_area: "", service_frequency_days: 15, office_id: "", warehouse_id: "", is_multi_day: false, total_days: 1, start_date: "", end_date: "" });
    setEditingZone(null);
  };

  const resetStopForm = () => {
    setStopForm({ stop_name: "", address: "", notes: "", estimated_duration_minutes: 15, location_id: "", machine_id: "", scheduled_date: "", priority: "normal", day_number: 1 });
    setEditingStop(null);
  };

  const handleEditZone = (zone: ServiceZone) => {
    setEditingZone(zone);
    setZoneForm({
      name: zone.name,
      description: zone.description || "",
      assigned_to: zone.assigned_to || "",
      status: zone.status,
      zone_area: zone.zone_area || "",
      service_frequency_days: zone.service_frequency_days || 15,
      office_id: zone.office_id || "",
      warehouse_id: zone.warehouse_id || "",
      is_multi_day: !!zone.is_multi_day,
      total_days: zone.total_days || 1,
      start_date: zone.start_date || "",
      end_date: zone.end_date || "",
    });
    setZoneDialogOpen(true);
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
      scheduled_date: stop.scheduled_date || "",
      priority: stop.priority || "normal",
      day_number: stop.day_number || 1,
    });
    setStopDialogOpen(true);
  };

  const handleZoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingZone) {
      updateZoneMutation.mutate({ id: editingZone.id, data: zoneForm });
    } else {
      createZoneMutation.mutate(zoneForm);
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

  // Auto-fill when location selected
  useEffect(() => {
    if (stopForm.location_id) {
      const location = locations?.find(l => l.id === stopForm.location_id);
      if (location) {
        setStopForm(prev => ({
          ...prev,
          stop_name: prev.stop_name || location.name || "",
          address: location.address || location.city,
        }));
      }
    }
  }, [stopForm.location_id, locations]);

  // Filter zones
  const filteredZones = zones?.filter(zone => {
    const matchesSearch = zone.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getAssigneeName(zone.assigned_to).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (zone.zone_area || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || zone.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  // Filter scheduled stops
  const filteredScheduledStops = allScheduledStops?.filter(stop => {
    if (scheduleFilter === "all") return true;
    if (!stop.scheduled_date) return false;
    
    const schedDate = new Date(stop.scheduled_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (scheduleFilter === "today") return isToday(schedDate);
    if (scheduleFilter === "overdue") return isBefore(schedDate, today) && stop.status !== "completed";
    if (scheduleFilter === "upcoming") return isAfter(schedDate, today);
    return true;
  }) || [];

  const selectedZone = zones?.find(r => r.id === selectedZoneId);
  const activeZones = zones?.filter(r => r.status === "active") || [];
  
  // Calculate route distance
  const routeDistance = stops ? calculateTotalDistance(stops) : 0;
  const routeTravelTime = estimateTravelTime(routeDistance);
  const routeServiceTime = stops?.reduce((acc, s) => acc + (s.estimated_duration_minutes || 15), 0) || 0;
  
  // Analytics
  const totalStops = allStops?.length || 0;
  const completedStops = allStops?.filter(s => s.status === "completed")?.length || 0;
  const autoScheduledCount = allScheduledStops?.filter(s => s.auto_scheduled)?.length || 0;
  const overdueCount = allScheduledStops?.filter(s => {
    if (!s.scheduled_date || s.status === "completed") return false;
    return isBefore(new Date(s.scheduled_date), new Date());
  })?.length || 0;

  if (zonesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary mr-2" />
        <p className="text-muted-foreground">Loading zones...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
            <Compass className="w-6 h-6 text-primary" />
            Zone Manager
          </h2>
          <p className="text-sm text-muted-foreground">Service zones with bi-monthly scheduling</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetchZones()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetZoneForm} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Create Zone</span>
                <span className="sm:hidden">New</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingZone ? "Edit Zone" : "Create New Zone"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleZoneSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Zone Name</Label>
                  <Input
                    id="name"
                    value={zoneForm.name}
                    onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                    placeholder="e.g., Downtown District"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="zone_area">Zone Area / Region</Label>
                  <Input
                    id="zone_area"
                    value={zoneForm.zone_area}
                    onChange={(e) => setZoneForm({ ...zoneForm, zone_area: e.target.value })}
                    placeholder="e.g., North Side, Mall District"
                  />
                </div>
                <div>
                  <Label htmlFor="frequency">Service Frequency (days)</Label>
                  <Select 
                    value={zoneForm.service_frequency_days.toString()} 
                    onValueChange={(v) => setZoneForm({ ...zoneForm, service_frequency_days: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Weekly (7 days)</SelectItem>
                      <SelectItem value="14">Bi-weekly (14 days)</SelectItem>
                      <SelectItem value="15">Twice monthly (15 days)</SelectItem>
                      <SelectItem value="30">Monthly (30 days)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">How often machines in this zone need service</p>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={zoneForm.description}
                    onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
                    placeholder="Zone details and instructions..."
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="office_id">Office (optional)</Label>
                    <Select
                      value={zoneForm.office_id || "none"}
                      onValueChange={(v) => setZoneForm({ ...zoneForm, office_id: v === "none" ? "" : v, assigned_to: "" })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select office" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {(offices || []).map((o: any) => (
                          <SelectItem key={o.id} value={o.id}>{o.name} ({o.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Operators are scoped to this office</p>
                  </div>
                  <div>
                    <Label htmlFor="warehouse_id">Warehouse (optional)</Label>
                    <Select
                      value={zoneForm.warehouse_id || "none"}
                      onValueChange={(v) => setZoneForm({ ...zoneForm, warehouse_id: v === "none" ? "" : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {(warehouses || []).map((w: any) => (
                          <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Storage hub for restock supplies</p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="assigned_to">Assign Operator {zoneForm.office_id && <span className="text-xs text-muted-foreground">(filtered to selected office)</span>}</Label>
                  <Select 
                    value={zoneForm.assigned_to || "unassigned"} 
                    onValueChange={(v) => setZoneForm({ ...zoneForm, assigned_to: v === "unassigned" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an operator" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {(employees || [])
                        .filter(emp => !zoneForm.office_id || emp.office_id === zoneForm.office_id)
                        .map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.full_name || emp.email}
                          </SelectItem>
                        ))}
                      {zoneForm.office_id && (employees || []).filter(e => e.office_id === zoneForm.office_id).length === 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">No operators assigned to this office yet</div>
                      )}
                    </SelectContent>
                  </Select>
                  {editingZone?.assigned_to && editingZone.assigned_to !== zoneForm.assigned_to && (
                    <p className="text-xs text-warning mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Saving will reassign and log the change
                    </p>
                  )}
                </div>
                <div className="border rounded-md p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Multi-day route</Label>
                      <p className="text-xs text-muted-foreground">Enable for big routes spanning multiple days</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={zoneForm.is_multi_day}
                      onChange={(e) => setZoneForm({ ...zoneForm, is_multi_day: e.target.checked, total_days: e.target.checked ? Math.max(2, zoneForm.total_days) : 1 })}
                      className="h-4 w-4"
                    />
                  </div>
                  {zoneForm.is_multi_day && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label htmlFor="total_days" className="text-xs">Total Days</Label>
                        <Input id="total_days" type="number" min={2} max={14} value={zoneForm.total_days}
                          onChange={(e) => setZoneForm({ ...zoneForm, total_days: parseInt(e.target.value) || 2 })} />
                      </div>
                      <div>
                        <Label htmlFor="start_date" className="text-xs">Start Date</Label>
                        <Input id="start_date" type="date" value={zoneForm.start_date}
                          onChange={(e) => setZoneForm({ ...zoneForm, start_date: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="end_date" className="text-xs">End Date</Label>
                        <Input id="end_date" type="date" value={zoneForm.end_date}
                          onChange={(e) => setZoneForm({ ...zoneForm, end_date: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={zoneForm.status} 
                    onValueChange={(v) => setZoneForm({ ...zoneForm, status: v })}
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
                  <Button type="button" variant="outline" onClick={() => setZoneDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">{editingZone ? "Update" : "Create"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="w-full grid grid-cols-3 h-9">
          <TabsTrigger value="zones" className="text-xs">Zones</TabsTrigger>
          <TabsTrigger value="schedule" className="text-xs">Schedule</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs">Analytics</TabsTrigger>
        </TabsList>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="mt-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["all", "today", "upcoming", "overdue"] as const).map(filter => (
              <Button
                key={filter}
                variant={scheduleFilter === filter ? "default" : "outline"}
                size="sm"
                onClick={() => setScheduleFilter(filter)}
                className="capitalize"
              >
                {filter === "overdue" && <AlertCircle className="w-3 h-3 mr-1 text-destructive" />}
                {filter === "today" && <Calendar className="w-3 h-3 mr-1" />}
                {filter}
                {filter === "overdue" && overdueCount > 0 && (
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1">
                    {overdueCount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Scheduled Service Calls
              </CardTitle>
              <CardDescription className="text-xs">
                {autoScheduledCount} auto-scheduled from support tickets
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2">
              {filteredScheduledStops.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No scheduled stops</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-2">
                    {filteredScheduledStops.map(stop => {
                      const isOverdue = stop.scheduled_date && 
                        isBefore(new Date(stop.scheduled_date), new Date()) && 
                        stop.status !== "completed";
                      
                      return (
                        <div 
                          key={stop.id}
                          className={`p-3 border rounded-lg ${
                            isOverdue ? "border-destructive/50 bg-destructive/5" : "border-border"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium text-sm">{stop.stop_name}</h4>
                                {stop.auto_scheduled && (
                                  <Badge variant="secondary" className="text-[10px] px-1">
                                    <Zap className="w-2.5 h-2.5 mr-0.5" />
                                    Auto
                                  </Badge>
                                )}
                                <Badge 
                                  variant={stop.priority === "urgent" ? "destructive" : stop.priority === "high" ? "default" : "outline"}
                                  className="text-[10px] px-1"
                                >
                                  {stop.priority}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {(stop as any).zone?.name} • {getAssigneeName((stop as any).zone?.assigned_to)}
                              </p>
                              {stop.notes && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{stop.notes}</p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`text-xs font-medium ${isOverdue ? "text-destructive" : "text-foreground"}`}>
                                {format(parseLocalDate(stop.scheduled_date!), "MMM d")}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {isOverdue ? "Overdue" : formatDistanceToNow(parseLocalDate(stop.scheduled_date!), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Compass className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total Zones</span>
              </div>
              <p className="text-2xl font-bold">{zones?.length || 0}</p>
              <p className="text-xs text-green-600">{activeZones.length} active</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Total Stops</span>
              </div>
              <p className="text-2xl font-bold">{totalStops}</p>
              <p className="text-xs text-muted-foreground">{completedStops} completed</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Auto-Scheduled</span>
              </div>
              <p className="text-2xl font-bold">{autoScheduledCount}</p>
              <p className="text-xs text-muted-foreground">From tickets</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-xs text-muted-foreground">Overdue</span>
              </div>
              <p className="text-2xl font-bold">{overdueCount}</p>
              <p className="text-xs text-destructive">Needs attention</p>
            </Card>
          </div>

          {/* Zone Service Status */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Zone Service Status</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px]">
                <div className="divide-y">
                  {zones?.map(zone => {
                    const isDue = isZoneDueForService(
                      zone.last_serviced_at ? new Date(zone.last_serviced_at) : null,
                      zone.service_frequency_days || 15
                    );
                    const zoneStops = allStops?.filter(s => s.route_id === zone.id) || [];
                    
                    return (
                      <div key={zone.id} className="p-3 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{zone.name}</p>
                            {isDue && (
                              <Badge variant="destructive" className="text-[10px]">Due</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {zone.zone_area || "No area"} • {zoneStops.length} machines • Every {zone.service_frequency_days || 15} days
                          </p>
                          {zone.last_serviced_at && (
                            <p className="text-xs text-muted-foreground">
                              Last: {formatDistanceToNow(new Date(zone.last_serviced_at), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                        <Badge variant={zone.status === "active" ? "default" : "secondary"}>
                          {zone.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Zones Tab */}
        <TabsContent value="zones" className="mt-4 space-y-4">
          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search zones..." 
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Zones List */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Compass className="w-4 h-4" />
                  Zones ({filteredZones.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                {filteredZones.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">No zones found</p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2 pr-2">
                      {filteredZones.map((zone) => {
                        const isDue = isZoneDueForService(
                          zone.last_serviced_at ? new Date(zone.last_serviced_at) : null,
                          zone.service_frequency_days || 15
                        );
                        
                        return (
                          <div 
                            key={zone.id} 
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${
                              selectedZoneId === zone.id 
                                ? "border-primary bg-primary/5 shadow-sm" 
                                : isDue
                                  ? "border-destructive/50 hover:border-destructive"
                                  : "border-border hover:border-primary/50"
                            }`}
                            onClick={() => setSelectedZoneId(zone.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-medium text-sm truncate">{zone.name}</h4>
                                  <Badge 
                                    variant={zone.status === "active" ? "default" : "secondary"} 
                                    className="text-[10px] px-1.5 py-0"
                                  >
                                    {zone.status}
                                  </Badge>
                                  {isDue && (
                                    <Badge variant="destructive" className="text-[10px] px-1">
                                      <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                                      Due
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {zone.zone_area || "No area set"} • Every {zone.service_frequency_days || 15}d
                                </p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {getAssigneeName(zone.assigned_to)}
                                </p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditZone(zone)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => duplicateZoneMutation.mutate(zone.id)}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => markZoneServicedMutation.mutate(zone.id)}>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Mark Serviced
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => deleteZoneMutation.mutate(zone.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Zone Stops */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {selectedZone ? selectedZone.name : "Zone Machines"}
                    </CardTitle>
                    {selectedZone && stops && stops.length > 0 && (
                      <CardDescription className="text-xs mt-0.5">
                        {stops.length} machines • {routeDistance}km • ~{routeTravelTime + routeServiceTime}min total
                      </CardDescription>
                    )}
                  </div>
                  {selectedZoneId && (
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => optimizeRouteMutation.mutate()}
                        disabled={!stops || stops.length < 2 || optimizeRouteMutation.isPending}
                        title="Optimize route for shortest distance"
                      >
                        <Navigation className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">Optimize</span>
                      </Button>
                      <Dialog open={stopDialogOpen} onOpenChange={setStopDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" onClick={resetStopForm}>
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{editingStop ? "Edit Stop" : "Add Machine"}</DialogTitle>
                            <DialogDescription>{selectedZone?.name}</DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleStopSubmit} className="space-y-4">
                            <div>
                              <Label>Link to Location</Label>
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
                                        {loc.latitude && <MapPin className="w-2.5 h-2.5 text-green-500" />}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground mt-1">
                                Locations with coordinates enable route optimization
                              </p>
                            </div>

                            <div>
                              <Label>Link to Machine</Label>
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

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="scheduled_date">Scheduled Date</Label>
                                <Input
                                  id="scheduled_date"
                                  type="date"
                                  value={stopForm.scheduled_date}
                                  onChange={(e) => setStopForm({ ...stopForm, scheduled_date: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="priority">Priority</Label>
                                <Select 
                                  value={stopForm.priority} 
                                  onValueChange={(v) => setStopForm({ ...stopForm, priority: v })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
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
                              <Label htmlFor="duration">Est. Service Time (min)</Label>
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
                              <Button type="submit">{editingStop ? "Update" : "Add"}</Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-2">
                {!selectedZoneId ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Select a zone to view machines</p>
                ) : stops?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">No machines in this zone</p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-1 pr-2">
                      {stops?.map((stop, index) => (
                        <div 
                          key={stop.id} 
                          className={`flex items-center gap-2 p-2 border rounded-lg hover:bg-muted/30 transition-colors ${
                            stop.auto_scheduled ? "border-blue-500/30 bg-blue-500/5" : "border-border"
                          }`}
                        >
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

                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {index + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <h4 className="font-medium text-sm truncate">{stop.stop_name}</h4>
                              {stop.machine_id && <Monitor className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                              {stop.location?.latitude && <span title="Has coordinates"><MapPin className="w-3 h-3 text-green-500 flex-shrink-0" /></span>}
                              {stop.auto_scheduled && (
                                <Badge variant="secondary" className="text-[10px] px-1">
                                  <Zap className="w-2.5 h-2.5" />
                                </Badge>
                              )}
                              {stop.priority === "urgent" && (
                                <Badge variant="destructive" className="text-[10px] px-1">Urgent</Badge>
                              )}
                              {stop.priority === "high" && (
                                <Badge variant="default" className="text-[10px] px-1">High</Badge>
                              )}
                            </div>
                            {stop.address && (
                              <p className="text-xs text-muted-foreground truncate">{stop.address}</p>
                            )}
                            {stop.scheduled_date && (
                              <p className="text-[10px] text-blue-600">
                                Scheduled: {format(parseLocalDate(stop.scheduled_date), "MMM d")}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{stop.estimated_duration_minutes || 15}m</span>
                            <Badge 
                              variant={stop.status === "completed" ? "default" : "outline"} 
                              className="text-[10px] px-1.5"
                            >
                              {stop.status === "completed" ? <CheckCircle className="w-3 h-3" /> : stop.status}
                            </Badge>
                          </div>

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
