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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Monitor, Plus, Key, RefreshCw, Copy, Eye, EyeOff, Wifi, WifiOff, MapPin, Package, Search, Settings, Trash2, Edit } from "lucide-react";

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
  api_key: string;
  last_seen: string | null;
  location_id: string | null;
  notes: string | null;
  installed_at: string | null;
  created_at: string;
  location?: Location;
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

const MACHINE_TYPES = [
  { value: "snack", label: "Snack" },
  { value: "beverage", label: "Beverage" },
  { value: "combo", label: "Combo" },
  { value: "fresh", label: "Fresh Food" },
  { value: "digital", label: "Digital Kiosk" },
  { value: "claw", label: "Claw Machine" },
  { value: "arcade", label: "Arcade" },
  { value: "other", label: "Other" },
];

const MachineRegistry = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [machineInventory, setMachineInventory] = useState<MachineInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  
  // Dialogs
  const [showMachineDialog, setShowMachineDialog] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  
  const [machineForm, setMachineForm] = useState({
    name: "",
    machine_code: "",
    machine_type: "snack",
    location_id: "",
    vendx_pay_enabled: true,
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
            location_id: machineForm.location_id || null,
            vendx_pay_enabled: machineForm.vendx_pay_enabled,
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
            location_id: machineForm.location_id || null,
            vendx_pay_enabled: machineForm.vendx_pay_enabled,
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

  const toggleMachineStatus = async (machine: Machine) => {
    const newStatus = machine.status === "active" ? "inactive" : "active";
    try {
      const { error } = await supabase
        .from("vendx_machines")
        .update({ status: newStatus })
        .eq("id", machine.id);

      if (error) throw error;
      toast({ title: `Machine ${newStatus}` });
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
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
    setMachineForm({ name: "", machine_code: "", machine_type: "snack", location_id: "", vendx_pay_enabled: true, notes: "" });
    setEditingMachine(null);
  };

  const openEditMachine = (machine: Machine) => {
    setEditingMachine(machine);
    setMachineForm({
      name: machine.name,
      machine_code: machine.machine_code,
      machine_type: machine.machine_type,
      location_id: machine.location_id || "",
      vendx_pay_enabled: machine.vendx_pay_enabled,
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
      return matchesSearch && matchesStatus && matchesLocation;
    });
  }, [machines, searchTerm, filterStatus, filterLocation]);

  // Stats
  const stats = useMemo(() => ({
    total: machines.length,
    active: machines.filter(m => m.status === "active").length,
    vendxPayEnabled: machines.filter(m => m.vendx_pay_enabled).length,
    online: machines.filter(m => getOnlineStatus(m.last_seen)).length,
  }), [machines]);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Monitor className="w-6 h-6 text-primary" />
          Machine Registry
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

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Machines</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-500">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">VendX Pay Enabled</p>
            <p className="text-2xl font-bold text-accent">{stats.vendxPayEnabled}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Online Now</p>
            <p className="text-2xl font-bold text-primary">{stats.online}</p>
          </CardContent>
        </Card>
      </div>

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
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name || `${loc.city}, ${loc.country}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  <TableHead>Status</TableHead>
                  <TableHead>VendX Pay</TableHead>
                  <TableHead>Online</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMachines.map((machine) => {
                  const isOnline = getOnlineStatus(machine.last_seen);
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
                        <Badge variant={machine.status === "active" ? "default" : "secondary"}>
                          {machine.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={machine.vendx_pay_enabled}
                          onCheckedChange={() => toggleVendxPay(machine)}
                        />
                      </TableCell>
                      <TableCell>
                        {isOnline ? (
                          <div className="flex items-center gap-1 text-green-500">
                            <Wifi className="w-4 h-4" />
                            <span className="text-xs">Online</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <WifiOff className="w-4 h-4" />
                            <span className="text-xs">Offline</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditMachine(machine)} title="Edit">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openInventoryDialog(machine)} title="Inventory">
                            <Package className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { setSelectedMachine(machine); setShowApiKeyDialog(true); }} title="API Key">
                            <Key className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => toggleMachineStatus(machine)} title={machine.status === "active" ? "Disable" : "Enable"}>
                            <Settings className="w-4 h-4" />
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

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent VendX Pay Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
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
                {sessions.slice(0, 20).map((session) => {
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
                <Label>Location</Label>
                <Select
                  value={machineForm.location_id}
                  onValueChange={(v) => setMachineForm({ ...machineForm, location_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Location</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name || `${loc.city}, ${loc.country}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label>Enable VendX Pay</Label>
                <p className="text-xs text-muted-foreground">Allow wallet payments on this machine</p>
              </div>
              <Switch
                checked={machineForm.vendx_pay_enabled}
                onCheckedChange={(v) => setMachineForm({ ...machineForm, vendx_pay_enabled: v })}
              />
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
    </div>
  );
};

export default MachineRegistry;