import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Monitor, Plus, Key, RefreshCw, Copy, Eye, EyeOff, MapPin, Package, Search, Settings, Trash2, Edit, DollarSign, Activity, Gamepad2, ShoppingCart } from "lucide-react";
import { 
  MachineStatsCards, 
  MachineFilters, 
  MachineStatusBadge,
  getOnlineStatus,
  getMachineTypeLabel,
  filterMachines,
  generateMachineCode as genMachineCode,
  generateMachineApiKey,
  BaseMachine,
  MachineLocation,
  MACHINE_TYPES
} from "@/components/machines";
import { ArcadePricingTemplates, MachineActivityLog, MachineStatsOverview, MachinePricingEditor } from "./machines";
import { formatDistanceToNow } from "date-fns";

interface Location {
  id: string;
  name: string | null;
  city: string;
  country: string;
  address: string | null;
}

interface Machine {
  id: string;
  name: string;
  machine_code: string;
  machine_type: string;
  status: string;
  vendx_pay_enabled: boolean;
  accepts_cash: boolean;
  accepts_coins: boolean;
  accepts_cards: boolean;
  api_key: string;
  last_seen: string | null;
  location_id: string | null;
  notes: string | null;
  installed_at: string | null;
  created_at: string;
  location?: Location;
  // New fields for pricing and stats
  price_per_play: number | null;
  plays_per_bundle: number | null;
  bundle_price: number | null;
  pricing_template_id: string | null;
  total_plays: number;
  total_vends: number;
  last_activity_at: string | null;
  current_period_revenue: number;
  lifetime_revenue: number;
  connection_status: string;
}

interface MachineInventoryItem {
  id: string;
  machine_id: string;
  product_name: string;
  sku: string;
  slot_number: string | null;
  quantity: number;
  max_capacity: number;
  unit_price: number;
  last_restocked: string | null;
}

interface Session {
  id: string;
  machine_id: string;
  session_code: string;
  session_type: string;
  status: string;
  created_at: string;
  expires_at: string;
  user_id: string | null;
}

// Use MACHINE_TYPES from universal components

const MachineRegistry = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [machineInventory, setMachineInventory] = useState<MachineInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("machines");
  
  // Dialogs
  const [showMachineDialog, setShowMachineDialog] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPricingEditor, setShowPricingEditor] = useState(false);
  
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  
  const [machineForm, setMachineForm] = useState({
    name: "",
    machine_code: "",
    machine_type: "snack",
    status: "active",
    location_id: "",
    vendx_pay_enabled: true,
    accepts_cash: true,
    accepts_coins: true,
    accepts_cards: true,
    notes: "",
  });
  
  const [inventoryForm, setInventoryForm] = useState({
    product_name: "",
    sku: "",
    slot_number: "",
    quantity: 0,
    max_capacity: 10,
    unit_price: 0,
  });
  
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [machinesRes, locationsRes, sessionsRes] = await Promise.all([
        supabase.from("vendx_machines").select("*").order("created_at", { ascending: false }),
        supabase.from("locations").select("id, name, city, country, address").eq("status", "active"),
        supabase.from("machine_sessions").select("*").order("created_at", { ascending: false }).limit(100),
      ]);

      const machinesData = machinesRes.data || [];
      const locationsData = locationsRes.data || [];
      
      // Merge location data into machines
      const machinesWithLocations = machinesData.map(m => ({
        ...m,
        location: locationsData.find(l => l.id === m.location_id),
      }));

      setMachines(machinesWithLocations);
      setLocations(locationsData);
      setSessions(sessionsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchMachineInventory = async (machineId: string) => {
    const { data } = await supabase
      .from("machine_inventory")
      .select("*")
      .eq("machine_id", machineId)
      .order("slot_number");
    setMachineInventory(data || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateApiKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "vx_";
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const generateMachineCode = () => {
    const prefix = "VX";
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${random}`;
  };

  const handleCreateOrUpdateMachine = async () => {
    try {
      if (editingMachine) {
        const { error } = await supabase
          .from("vendx_machines")
          .update({
            name: machineForm.name,
            machine_code: machineForm.machine_code,
            machine_type: machineForm.machine_type,
            status: machineForm.status,
            location_id: machineForm.location_id && machineForm.location_id !== "none" ? machineForm.location_id : null,
            vendx_pay_enabled: machineForm.vendx_pay_enabled,
            accepts_cash: machineForm.accepts_cash,
            accepts_coins: machineForm.accepts_coins,
            accepts_cards: machineForm.accepts_cards,
            notes: machineForm.notes || null,
          })
          .eq("id", editingMachine.id);

        if (error) throw error;
        toast({ title: "Machine updated successfully" });
      } else {
        const apiKey = generateApiKey();
        const { error } = await supabase
          .from("vendx_machines")
          .insert({
            name: machineForm.name,
            machine_code: machineForm.machine_code || generateMachineCode(),
            machine_type: machineForm.machine_type,
            location_id: machineForm.location_id && machineForm.location_id !== "none" ? machineForm.location_id : null,
            vendx_pay_enabled: machineForm.vendx_pay_enabled,
            accepts_cash: machineForm.accepts_cash,
            accepts_coins: machineForm.accepts_coins,
            accepts_cards: machineForm.accepts_cards,
            notes: machineForm.notes || null,
            api_key: apiKey,
            installed_at: new Date().toISOString(),
          });

        if (error) throw error;
        toast({ title: "Machine registered successfully" });
      }

      setShowMachineDialog(false);
      resetMachineForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving machine:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteMachine = async () => {
    if (!selectedMachine) return;
    try {
      const { error } = await supabase
        .from("vendx_machines")
        .delete()
        .eq("id", selectedMachine.id);

      if (error) throw error;
      toast({ title: "Machine deleted" });
      setShowDeleteConfirm(false);
      setSelectedMachine(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleRotateApiKey = async () => {
    if (!selectedMachine) return;
    try {
      const newApiKey = generateApiKey();
      const { error } = await supabase
        .from("vendx_machines")
        .update({ api_key: newApiKey })
        .eq("id", selectedMachine.id);

      if (error) throw error;
      toast({ title: "API key rotated successfully" });
      setSelectedMachine({ ...selectedMachine, api_key: newApiKey });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const updateMachineStatus = async (machine: Machine, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("vendx_machines")
        .update({ status: newStatus })
        .eq("id", machine.id);

      if (error) throw error;
      toast({ title: `Machine set to ${newStatus}` });
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const updateConnectionStatus = async (machine: Machine, newConnectionStatus: string) => {
    try {
      const { error } = await supabase
        .from("vendx_machines")
        .update({ connection_status: newConnectionStatus } as any)
        .eq("id", machine.id);

      if (error) throw error;
      toast({ title: `Connection set to ${newConnectionStatus}` });
      fetchData();
    } catch (error) {
      console.error("Error updating connection status:", error);
    }
  };

  const toggleVendxPay = async (machine: Machine) => {
    try {
      const { error } = await supabase
        .from("vendx_machines")
        .update({ vendx_pay_enabled: !machine.vendx_pay_enabled })
        .eq("id", machine.id);

      if (error) throw error;
      toast({ title: `VendX Pay ${machine.vendx_pay_enabled ? "disabled" : "enabled"}` });
      fetchData();
    } catch (error) {
      console.error("Error toggling VendX Pay:", error);
    }
  };

  const handleAddInventoryItem = async () => {
    if (!selectedMachine) return;
    try {
      const { error } = await supabase.from("machine_inventory").insert({
        machine_id: selectedMachine.id,
        ...inventoryForm,
      });

      if (error) throw error;
      toast({ title: "Item added to machine" });
      fetchMachineInventory(selectedMachine.id);
      setInventoryForm({ product_name: "", sku: "", slot_number: "", quantity: 0, max_capacity: 10, unit_price: 0 });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteInventoryItem = async (itemId: string) => {
    try {
      await supabase.from("machine_inventory").delete().eq("id", itemId);
      if (selectedMachine) fetchMachineInventory(selectedMachine.id);
      toast({ title: "Item removed" });
    } catch (error) {
      console.error("Error deleting inventory item:", error);
    }
  };

  const resetMachineForm = () => {
    setMachineForm({ 
      name: "", 
      machine_code: "", 
      machine_type: "snack", 
      status: "active",
      location_id: "", 
      vendx_pay_enabled: true, 
      accepts_cash: true,
      accepts_coins: true,
      accepts_cards: true,
      notes: "" 
    });
    setEditingMachine(null);
  };

  const openEditMachine = (machine: Machine) => {
    setEditingMachine(machine);
    setMachineForm({
      name: machine.name,
      machine_code: machine.machine_code,
      machine_type: machine.machine_type,
      status: machine.status,
      location_id: machine.location_id || "",
      vendx_pay_enabled: machine.vendx_pay_enabled,
      accepts_cash: machine.accepts_cash ?? true,
      accepts_coins: machine.accepts_coins ?? true,
      accepts_cards: machine.accepts_cards ?? true,
      notes: machine.notes || "",
    });
    setShowMachineDialog(true);
  };

  const openInventoryDialog = (machine: Machine) => {
    setSelectedMachine(machine);
    fetchMachineInventory(machine.id);
    setShowInventoryDialog(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const getOnlineStatus = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff < 5 * 60 * 1000;
  };

  // Filtered machines
  const filteredMachines = useMemo(() => {
    return machines.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.machine_code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === "all" || m.status === filterStatus;
      const matchesLocation = filterLocation === "all" || m.location_id === filterLocation;
      const matchesType = filterType === "all" || m.machine_type === filterType;
      return matchesSearch && matchesStatus && matchesLocation && matchesType;
    });
  }, [machines, searchTerm, filterStatus, filterLocation, filterType]);

  // Stats
  const stats = useMemo(() => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const vendingTypes = ["snack", "beverage", "combo", "fresh", "digital"];
    const arcadeTypes = ["arcade", "claw"];
    
    return {
      total: machines.length,
      active: machines.filter(m => m.status === "active").length,
      vendxPayEnabled: machines.filter(m => m.vendx_pay_enabled).length,
      online: machines.filter(m => m.last_seen && new Date(m.last_seen).getTime() > fiveMinutesAgo).length,
      offline: machines.filter(m => m.status === "active" && (!m.last_seen || new Date(m.last_seen).getTime() <= fiveMinutesAgo)).length,
      totalRevenue: machines.reduce((sum, m) => sum + (m.lifetime_revenue || 0), 0),
      totalPlays: machines.reduce((sum, m) => sum + (m.total_plays || 0), 0),
      totalVends: machines.reduce((sum, m) => sum + (m.total_vends || 0), 0),
      vendingCount: machines.filter(m => vendingTypes.includes(m.machine_type)).length,
      arcadeCount: machines.filter(m => arcadeTypes.includes(m.machine_type)).length,
    };
  }, [machines]);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Monitor className="w-6 h-6 text-primary" />
          Machine Management
        </h2>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetMachineForm(); setShowMachineDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Register Machine
          </Button>
        </div>
      </div>

      {/* Enhanced Stats */}
      <MachineStatsOverview stats={stats} />

      {/* Tabs for different sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="machines" className="flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            Machines
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            Sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="machines" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search machines..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-[150px]">
                  <SearchableSelect
                    options={[
                      { value: "all", label: "All Types" },
                      ...MACHINE_TYPES.map(t => ({ value: t.value, label: t.label })),
                    ]}
                    value={filterType}
                    onValueChange={setFilterType}
                    placeholder="Type"
                    searchPlaceholder="Search type..."
                  />
                </div>
                <div className="w-[150px]">
                  <SearchableSelect
                    options={[
                      { value: "all", label: "All Status" },
                      { value: "active", label: "Active" },
                      { value: "inactive", label: "Inactive" },
                      { value: "maintenance", label: "Maintenance" },
                      { value: "offline", label: "Offline" },
                    ]}
                    value={filterStatus}
                    onValueChange={setFilterStatus}
                    placeholder="Status"
                    searchPlaceholder="Search status..."
                  />
                </div>
                <div className="w-[200px]">
                  <SearchableSelect
                    options={[
                      { value: "all", label: "All Locations" },
                      ...locations.map(loc => ({
                        value: loc.id,
                        label: loc.name || `${loc.city}, ${loc.country}`,
                      })),
                    ]}
                    value={filterLocation}
                    onValueChange={setFilterLocation}
                    placeholder="Location"
                    searchPlaceholder="Search locations..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Machines Table */}
          <Card>
            <CardHeader>
              <CardTitle>Registered Machines ({filteredMachines.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Machine</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Connection</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMachines.map((machine) => {
                      const isArcade = machine.machine_type === "arcade" || machine.machine_type === "claw";
                      return (
                        <TableRow key={machine.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{machine.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{machine.machine_code}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {machine.location ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-muted-foreground" />
                                <span className="text-sm">{machine.location.name || `${machine.location.city}`}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{machine.machine_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium">${(machine.lifetime_revenue || 0).toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">lifetime</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              {isArcade ? (
                                <span className="flex items-center gap-1">
                                  <Gamepad2 className="w-3 h-3 text-purple-500" />
                                  {machine.total_plays || 0}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <ShoppingCart className="w-3 h-3 text-green-500" />
                                  {machine.total_vends || 0}
                                </span>
                              )}
                              {machine.last_activity_at && (
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(machine.last_activity_at), { addSuffix: true })}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={(machine as any).connection_status || "offline"}
                              onValueChange={(v) => updateConnectionStatus(machine, v)}
                            >
                              <SelectTrigger className="w-[120px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="online">🟢 Online</SelectItem>
                                <SelectItem value="offline">🔴 Offline</SelectItem>
                                <SelectItem value="intermittent">🟡 Intermittent</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <MachineStatusBadge 
                              status={machine.status} 
                              lastSeen={machine.last_seen}
                              onlineCheckMode="status-only"
                              size="sm"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Select
                                value={machine.status}
                                onValueChange={(v) => updateMachineStatus(machine, v)}
                              >
                                <SelectTrigger className="w-[120px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="inactive">Inactive</SelectItem>
                                  <SelectItem value="maintenance">Maintenance</SelectItem>
                                  <SelectItem value="offline">Offline</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button size="icon" variant="ghost" onClick={() => openEditMachine(machine)} title="Edit">
                                <Edit className="w-4 h-4" />
                              </Button>
                              {isArcade && (
                                <Button size="icon" variant="ghost" onClick={() => { setSelectedMachine(machine); setShowPricingEditor(true); }} title="Set Pricing">
                                  <DollarSign className="w-4 h-4" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" onClick={() => openInventoryDialog(machine)} title="Inventory">
                                <Package className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => { setSelectedMachine(machine); setShowApiKeyDialog(true); }} title="API Key">
                                <Key className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => { setSelectedMachine(machine); setShowDeleteConfirm(true); }} title="Delete">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <MachineActivityLog 
            machines={machines.map(m => ({ id: m.id, name: m.name, machine_code: m.machine_code }))} 
          />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent VendX Pay Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Machine</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.slice(0, 50).map((session) => {
                      const machine = machines.find((m) => m.id === session.machine_id);
                      return (
                        <TableRow key={session.id}>
                          <TableCell className="font-medium">{machine?.name || "Unknown"}</TableCell>
                          <TableCell className="capitalize">{session.session_type}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                session.status === "verified" ? "default" :
                                session.status === "used" ? "secondary" :
                                session.status === "expired" ? "outline" : "outline"
                              }
                            >
                              {session.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(session.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Machine Dialog */}
      <Dialog open={showMachineDialog} onOpenChange={setShowMachineDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMachine ? "Edit Machine" : "Register New Machine"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Machine Name *</Label>
                <Input
                  value={machineForm.name}
                  onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })}
                  placeholder="HQ Lobby Snack Machine"
                />
              </div>
              <div className="space-y-2">
                <Label>Machine Code</Label>
                <Input
                  value={machineForm.machine_code}
                  onChange={(e) => setMachineForm({ ...machineForm, machine_code: e.target.value })}
                  placeholder="Auto-generated if blank"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Machine Type *</Label>
                <Select
                  value={machineForm.machine_type}
                  onValueChange={(v) => setMachineForm({ ...machineForm, machine_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MACHINE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={machineForm.status}
                  onValueChange={(v) => setMachineForm({ ...machineForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <SearchableSelect
                options={[
                  { value: "none", label: "No Location" },
                  ...locations.map(loc => ({
                    value: loc.id,
                    label: loc.name || `${loc.city}, ${loc.country}`,
                  })),
                ]}
                value={machineForm.location_id}
                onValueChange={(v) => setMachineForm({ ...machineForm, location_id: v })}
                placeholder="Select location"
                searchPlaceholder="Search locations..."
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={machineForm.notes}
                onChange={(e) => setMachineForm({ ...machineForm, notes: e.target.value })}
                placeholder="Optional notes about this machine..."
                rows={2}
              />
            </div>
            {/* Payment Methods Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Payment Methods Accepted</Label>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-sm">Cash</Label>
                    <p className="text-xs text-muted-foreground">Accept paper bills</p>
                  </div>
                  <Switch
                    checked={machineForm.accepts_cash}
                    onCheckedChange={(v) => setMachineForm({ ...machineForm, accepts_cash: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-sm">Coins</Label>
                    <p className="text-xs text-muted-foreground">Accept coin payments</p>
                  </div>
                  <Switch
                    checked={machineForm.accepts_coins}
                    onCheckedChange={(v) => setMachineForm({ ...machineForm, accepts_coins: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-sm">Credit/Debit Cards</Label>
                    <p className="text-xs text-muted-foreground">Accept card payments</p>
                  </div>
                  <Switch
                    checked={machineForm.accepts_cards}
                    onCheckedChange={(v) => setMachineForm({ ...machineForm, accepts_cards: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <div>
                    <Label className="text-sm">VendX Pay</Label>
                    <p className="text-xs text-muted-foreground">Allow wallet payments</p>
                  </div>
                  <Switch
                    checked={machineForm.vendx_pay_enabled}
                    onCheckedChange={(v) => setMachineForm({ ...machineForm, vendx_pay_enabled: v })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMachineDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateOrUpdateMachine} disabled={!machineForm.name}>
              {editingMachine ? "Update Machine" : "Register Machine"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Key Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Machine API Key</DialogTitle>
            <DialogDescription>Use this key to authenticate the machine with VendX Pay</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Machine</p>
              <p className="font-medium">{selectedMachine?.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{selectedMachine?.machine_code}</p>
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={selectedMachine?.api_key || ""}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(selectedMachine?.api_key || "")}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              ⚠️ Keep this key secure. Rotating the key will disconnect the machine until updated.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApiKeyDialog(false)}>Close</Button>
            <Button variant="destructive" onClick={handleRotateApiKey}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Rotate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Machine Inventory Dialog */}
      <Dialog open={showInventoryDialog} onOpenChange={setShowInventoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Machine Inventory: {selectedMachine?.name}</DialogTitle>
            <DialogDescription>Manage products loaded in this machine</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="inventory">
            <TabsList>
              <TabsTrigger value="inventory">Current Inventory</TabsTrigger>
              <TabsTrigger value="add">Add Product</TabsTrigger>
            </TabsList>
            <TabsContent value="inventory" className="space-y-4">
              {machineInventory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No inventory items</p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Slot</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {machineInventory.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.slot_number || "-"}</TableCell>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{item.sku}</TableCell>
                          <TableCell>
                            <span className={item.quantity <= 2 ? "text-destructive font-medium" : ""}>
                              {item.quantity}/{item.max_capacity}
                            </span>
                          </TableCell>
                          <TableCell>${item.unit_price.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteInventoryItem(item.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>
            <TabsContent value="add" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product Name *</Label>
                  <Input
                    value={inventoryForm.product_name}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, product_name: e.target.value })}
                    placeholder="Coca-Cola 12oz"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SKU *</Label>
                  <Input
                    value={inventoryForm.sku}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, sku: e.target.value })}
                    placeholder="COK-12OZ-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slot Number</Label>
                  <Input
                    value={inventoryForm.slot_number}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, slot_number: e.target.value })}
                    placeholder="A1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Capacity</Label>
                  <Input
                    type="number"
                    value={inventoryForm.max_capacity}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, max_capacity: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Current Quantity</Label>
                  <Input
                    type="number"
                    value={inventoryForm.quantity}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={inventoryForm.unit_price}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, unit_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <Button onClick={handleAddInventoryItem} disabled={!inventoryForm.product_name || !inventoryForm.sku}>
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Machine</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedMachine?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteMachine}>Delete Machine</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Arcade Pricing Editor */}
      <MachinePricingEditor
        open={showPricingEditor}
        onOpenChange={setShowPricingEditor}
        machine={selectedMachine ? {
          id: selectedMachine.id,
          name: selectedMachine.name,
          machine_code: selectedMachine.machine_code,
          machine_type: selectedMachine.machine_type,
          price_per_play: selectedMachine.price_per_play,
          plays_per_bundle: selectedMachine.plays_per_bundle,
          bundle_price: selectedMachine.bundle_price,
          pricing_template_id: selectedMachine.pricing_template_id,
        } : null}
        onSaved={fetchData}
      />
    </div>
  );
};

export default MachineRegistry;