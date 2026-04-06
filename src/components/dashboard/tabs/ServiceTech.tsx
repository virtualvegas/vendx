import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/hooks/useAuditLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Wrench, Monitor, Package, RefreshCw, MapPin, Clock, CheckCircle,
  AlertTriangle, Navigation, Truck, Calendar, ClipboardList,
  ArrowRight, MessageSquare, Plus, TrendingUp, Search, Wifi, WifiOff,
} from "lucide-react";

interface ServiceStop {
  id: string;
  route_id: string;
  stop_name: string;
  address: string | null;
  notes: string | null;
  status: string;
  priority: string | null;
  scheduled_date: string | null;
  auto_scheduled: boolean | null;
  source_ticket_id: string | null;
  estimated_duration_minutes: number | null;
  completed_at: string | null;
  service_type: string | null;
  tech_notes: string | null;
  restocked_items: any;
  completed_by: string | null;
  machine_id: string | null;
  location_id: string | null;
  machine?: { id: string; name: string; machine_code: string; status: string } | null;
  location?: { id: string; name: string | null; city: string; address: string | null } | null;
  zone?: { id: string; name: string } | null;
}

interface MachineInvItem {
  id: string;
  product_name: string;
  sku: string;
  slot_number: string | null;
  quantity: number;
  max_capacity: number;
  unit_price: number;
}

const SERVICE_TYPES = [
  { value: "routine", label: "Routine Service" },
  { value: "restock", label: "Restock" },
  { value: "repair", label: "Repair" },
  { value: "inspection", label: "Inspection" },
  { value: "install", label: "Installation" },
  { value: "collection", label: "Revenue Collection" },
];

const ServiceTech = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [showRestockDialog, setShowRestockDialog] = useState(false);
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const [selectedStop, setSelectedStop] = useState<ServiceStop | null>(null);
  const [serviceForm, setServiceForm] = useState({ service_type: "routine", tech_notes: "" });
  const [restockQuantities, setRestockQuantities] = useState<Record<string, number>>({});
  const [collectionForm, setCollectionForm] = useState({ cashAmount: "", coinsAmount: "", notes: "" });
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => { const { data: { user } } = await supabase.auth.getUser(); return user; },
  });

  // Fetch all service stops assigned to the operator's routes
  const { data: serviceStops, isLoading, refetch } = useQuery({
    queryKey: ["service-tech-stops", statusFilter],
    queryFn: async () => {
      if (!currentUser?.id) return [];

      // Get routes assigned to this user
      const { data: routes } = await supabase
        .from("service_routes")
        .select("id")
        .eq("assigned_to", currentUser.id)
        .eq("status", "active");

      // Also check if user is a manager (sees all)
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id);
      const isManager = roles?.some(r => ["super_admin", "global_operations_manager"].includes(r.role));

      let query = supabase
        .from("route_stops")
        .select(`
          *,
          machine:vendx_machines(id, name, machine_code, status),
          location:locations(id, name, city, address)
        `)
        .order("scheduled_date", { ascending: true });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (!isManager && routes && routes.length > 0) {
        query = query.in("route_id", routes.map(r => r.id));
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return (data || []) as ServiceStop[];
    },
    enabled: !!currentUser?.id,
  });

  // Machine inventory for restock
  const { data: machineInventory } = useQuery({
    queryKey: ["service-machine-inv", selectedStop?.machine_id],
    queryFn: async () => {
      if (!selectedStop?.machine_id) return [];
      const { data, error } = await supabase
        .from("machine_inventory")
        .select("*")
        .eq("machine_id", selectedStop.machine_id)
        .order("slot_number");
      if (error) throw error;
      return data as MachineInvItem[];
    },
    enabled: !!selectedStop?.machine_id,
  });

  // Realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel("service-stops-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "route_stops" }, () => {
        queryClient.invalidateQueries({ queryKey: ["service-tech-stops"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Stats
  const stats = useMemo(() => {
    if (!serviceStops) return { pending: 0, inProgress: 0, completed: 0, today: 0 };
    const today = new Date().toISOString().split("T")[0];
    return {
      pending: serviceStops.filter(s => s.status === "pending").length,
      inProgress: serviceStops.filter(s => s.status === "in_progress").length,
      completed: serviceStops.filter(s => s.status === "completed").length,
      today: serviceStops.filter(s => s.scheduled_date === today).length,
    };
  }, [serviceStops]);

  // Complete service stop with notes and auto-deduct warehouse stock on restock
  const completeServiceMutation = useMutation({
    mutationFn: async ({ stop, serviceType, techNotes, restockedItems }: {
      stop: ServiceStop; serviceType: string; techNotes: string; restockedItems: any[];
    }) => {
      // Update the route stop
      const { error } = await supabase
        .from("route_stops")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: currentUser?.id,
          service_type: serviceType,
          tech_notes: techNotes,
          restocked_items: restockedItems,
        } as any)
        .eq("id", stop.id);
      if (error) throw error;

      // If restock, update machine inventory AND deduct from warehouse
      if (serviceType === "restock" && restockedItems.length > 0 && stop.machine_id) {
        for (const item of restockedItems) {
          if (item.quantity_added > 0) {
            // Update machine inventory to new quantity
            await supabase
              .from("machine_inventory")
              .update({
                quantity: item.new_quantity,
                last_restocked: new Date().toISOString(),
              })
              .eq("id", item.inventory_id);

            // Deduct from warehouse by matching SKU
            if (item.sku) {
              const { data: warehouseItem } = await supabase
                .from("inventory_items")
                .select("id, quantity")
                .eq("sku", item.sku)
                .single();

              if (warehouseItem) {
                const newWarehouseQty = Math.max(0, warehouseItem.quantity - item.quantity_added);
                await supabase
                  .from("inventory_items")
                  .update({ quantity: newWarehouseQty })
                  .eq("id", warehouseItem.id);
              }
            }
          }
        }

        // Log the restock
        await supabase.from("restock_logs").insert({
          machine_id: stop.machine_id,
          performed_by: currentUser?.id,
          notes: techNotes || "Restocked via service stop",
          items_restocked: restockedItems,
        });
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["service-tech-stops"] });
      queryClient.invalidateQueries({ queryKey: ["machine-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["route-stops"] });
      toast({ title: "Service Completed", description: `${vars.stop.stop_name} marked as serviced` });
      logAuditEvent({
        action: "Completed Service Stop",
        entity_type: "Route Stop",
        entity_id: vars.stop.id,
        details: { service_type: vars.serviceType, machine: vars.stop.machine?.name, restocked: vars.restockedItems.length },
      });
      setShowServiceDialog(false);
      setShowRestockDialog(false);
      setSelectedStop(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Start service (set to in_progress)
  const startServiceMutation = useMutation({
    mutationFn: async (stopId: string) => {
      const { error } = await supabase
        .from("route_stops")
        .update({ status: "in_progress" } as any)
        .eq("id", stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-tech-stops"] });
      queryClient.invalidateQueries({ queryKey: ["route-stops"] });
      toast({ title: "Service Started" });
    },
  });

  // Add tech note mutation
  const addNoteMutation = useMutation({
    mutationFn: async ({ stopId, note }: { stopId: string; note: string }) => {
      const { data: existing } = await supabase.from("route_stops").select("tech_notes").eq("id", stopId).single();
      const currentNotes = (existing as any)?.tech_notes || "";
      const timestamp = new Date().toLocaleString();
      const updatedNotes = currentNotes ? `${currentNotes}\n[${timestamp}] ${note}` : `[${timestamp}] ${note}`;
      const { error } = await supabase.from("route_stops").update({ tech_notes: updatedNotes } as any).eq("id", stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-tech-stops"] });
      toast({ title: "Note Added" });
    },
  });

  // Revenue collection mutation
  const collectRevenueMutation = useMutation({
    mutationFn: async ({ stop, cashAmount, coinsAmount, notes }: {
      stop: ServiceStop; cashAmount: number; coinsAmount: number; notes: string;
    }) => {
      const totalAmount = cashAmount + coinsAmount;
      const { error } = await supabase
        .from("revenue_collections")
        .insert({
          machine_id: stop.machine_id,
          location_id: stop.location_id,
          route_stop_id: stop.id,
          collected_by: currentUser?.id,
          cash_amount: cashAmount,
          coins_amount: coinsAmount,
          total_amount: totalAmount,
          notes: notes || null,
        });
      if (error) throw error;

      logAuditEvent({
        action: "Revenue Collected",
        entity_type: "Revenue Collection",
        entity_id: stop.machine_id || stop.id,
        details: { cash: cashAmount, coins: coinsAmount, total: totalAmount, stop: stop.stop_name },
      });
    },
    onSuccess: () => {
      toast({ title: "Revenue Collected", description: `$${(parseFloat(collectionForm.cashAmount || "0") + parseFloat(collectionForm.coinsAmount || "0")).toFixed(2)} recorded` });
      setShowCollectionDialog(false);
      setCollectionForm({ cashAmount: "", coinsAmount: "", notes: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openServiceComplete = (stop: ServiceStop) => {
    setSelectedStop(stop);
    setServiceForm({ service_type: stop.service_type || "routine", tech_notes: "" });
    setShowServiceDialog(true);
  };

  const openRestock = (stop: ServiceStop) => {
    setSelectedStop(stop);
    setRestockQuantities({});
    setShowRestockDialog(true);
  };

  const handleCompleteService = () => {
    if (!selectedStop) return;
    completeServiceMutation.mutate({
      stop: selectedStop,
      serviceType: serviceForm.service_type,
      techNotes: serviceForm.tech_notes,
      restockedItems: [],
    });
  };

  const handleCompleteRestock = () => {
    if (!selectedStop || !machineInventory) return;
    const restockedItems = machineInventory
      .map(item => {
        const added = restockQuantities[item.id] ?? (item.max_capacity - item.quantity);
        return {
          inventory_id: item.id,
          product_name: item.product_name,
          sku: item.sku,
          slot_number: item.slot_number,
          previous_quantity: item.quantity,
          quantity_added: Math.max(0, added),
          new_quantity: Math.min(item.max_capacity, item.quantity + Math.max(0, added)),
        };
      })
      .filter(i => i.quantity_added > 0);

    completeServiceMutation.mutate({
      stop: selectedStop,
      serviceType: "restock",
      techNotes: serviceForm.tech_notes || "Restock completed",
      restockedItems,
    });
  };

  const filteredStops = useMemo(() => {
    if (!serviceStops) return [];
    return serviceStops.filter(s =>
      s.stop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.machine?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [serviceStops, searchQuery]);

  const getPriorityColor = (p: string | null) => {
    switch (p) {
      case "urgent": return "border-l-red-500 bg-red-500/5";
      case "high": return "border-l-orange-500 bg-orange-500/5";
      default: return "border-l-blue-500";
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="w-6 h-6 text-primary" />
            Service Operations
          </h2>
          <p className="text-sm text-muted-foreground">Manage service stops, restock machines, and log tech notes</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isOnline ? "outline" : "destructive"} className="text-xs">
            {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
            {isOnline ? "Online" : "Offline"}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-yellow-500/50 transition-colors" onClick={() => setStatusFilter("pending")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10"><Clock className="w-5 h-5 text-yellow-500" /></div>
            <div><p className="text-2xl font-bold">{stats.pending}</p><p className="text-xs text-muted-foreground">Pending</p></div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => setStatusFilter("in_progress")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><Wrench className="w-5 h-5 text-blue-500" /></div>
            <div><p className="text-2xl font-bold">{stats.inProgress}</p><p className="text-xs text-muted-foreground">In Progress</p></div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-green-500/50 transition-colors" onClick={() => setStatusFilter("completed")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><CheckCircle className="w-5 h-5 text-green-500" /></div>
            <div><p className="text-2xl font-bold">{stats.completed}</p><p className="text-xs text-muted-foreground">Completed</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Calendar className="w-5 h-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{stats.today}</p><p className="text-xs text-muted-foreground">Due Today</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search stops, machines..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Service Stops List */}
      <div className="space-y-3">
        {filteredStops.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No service stops found</p>
              <p className="text-sm mt-1">Try changing the status filter</p>
            </CardContent>
          </Card>
        ) : (
          filteredStops.map(stop => (
            <Card key={stop.id} className={`border-l-4 ${getPriorityColor(stop.priority)}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold">{stop.stop_name}</h3>
                      {stop.auto_scheduled && (
                        <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-600">From Ticket</Badge>
                      )}
                      {stop.priority === "urgent" && (
                        <Badge variant="destructive" className="text-xs">Urgent</Badge>
                      )}
                      <Badge variant="outline" className="text-xs capitalize">{stop.service_type || "routine"}</Badge>
                    </div>

                    {stop.machine && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Monitor className="w-3 h-3" />
                        {stop.machine.name} ({stop.machine.machine_code})
                        <Badge variant={stop.machine.status === "active" ? "outline" : "destructive"} className="text-[10px] ml-1">
                          {stop.machine.status}
                        </Badge>
                      </p>
                    )}

                    {stop.address && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {stop.address}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {stop.scheduled_date && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(stop.scheduled_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      )}
                      {stop.estimated_duration_minutes && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> ~{stop.estimated_duration_minutes}m
                        </span>
                      )}
                      {(stop as any).tech_notes && (
                        <span className="text-xs text-primary flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Has notes
                        </span>
                      )}
                    </div>

                    {stop.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 bg-muted/50 p-2 rounded">{stop.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {stop.status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => startServiceMutation.mutate(stop.id)}>
                          <Wrench className="w-3 h-3 mr-1" /> Start
                        </Button>
                        {stop.address && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`} target="_blank" rel="noopener noreferrer">
                              <Navigation className="w-3 h-3 mr-1" /> Navigate
                            </a>
                          </Button>
                        )}
                      </>
                    )}
                    {stop.status === "in_progress" && (
                      <>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => openServiceComplete(stop)}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Complete
                        </Button>
                        {stop.machine_id && (
                          <Button size="sm" variant="outline" onClick={() => openRestock(stop)}>
                            <Package className="w-3 h-3 mr-1" /> Restock
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => {
                          const note = prompt("Add a tech note:");
                          if (note) addNoteMutation.mutate({ stopId: stop.id, note });
                        }}>
                          <MessageSquare className="w-3 h-3 mr-1" /> Note
                        </Button>
                      </>
                    )}
                    {stop.status === "completed" && (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                        <CheckCircle className="w-3 h-3 mr-1" /> Done
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Complete Service Dialog */}
      <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Service - {selectedStop?.stop_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Service Type</Label>
              <Select value={serviceForm.service_type} onValueChange={v => setServiceForm(f => ({ ...f, service_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map(st => <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tech Notes</Label>
              <Textarea
                value={serviceForm.tech_notes}
                onChange={e => setServiceForm(f => ({ ...f, tech_notes: e.target.value }))}
                placeholder="Describe work performed, issues found, parts replaced..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowServiceDialog(false)}>Cancel</Button>
            <Button onClick={handleCompleteService} disabled={completeServiceMutation.isPending}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={showRestockDialog} onOpenChange={setShowRestockDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Restock - {selectedStop?.machine?.name || selectedStop?.stop_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!machineInventory || machineInventory.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No inventory slots configured for this machine</p>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Slot</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Add</TableHead>
                      <TableHead>New Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {machineInventory.map(item => {
                      const toAdd = restockQuantities[item.id] ?? (item.max_capacity - item.quantity);
                      const newQty = Math.min(item.max_capacity, item.quantity + Math.max(0, toAdd));
                      return (
                        <TableRow key={item.id} className={item.quantity === 0 ? "bg-destructive/5" : item.quantity <= 2 ? "bg-yellow-500/5" : ""}>
                          <TableCell className="font-mono">{item.slot_number || "—"}</TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">{item.sku}</p>
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
            )}
            <div>
              <Label>Restock Notes</Label>
              <Textarea
                value={serviceForm.tech_notes}
                onChange={e => setServiceForm(f => ({ ...f, tech_notes: e.target.value }))}
                placeholder="Notes about the restock..."
                rows={2}
              />
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-sm text-yellow-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Warehouse stock will be automatically deducted when you confirm
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestockDialog(false)}>Cancel</Button>
            <Button onClick={handleCompleteRestock} disabled={completeServiceMutation.isPending}>
              <Package className="w-4 h-4 mr-2" />
              Confirm Restock & Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceTech;
