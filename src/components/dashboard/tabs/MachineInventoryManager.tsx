import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Package, AlertTriangle, Trash2, Edit, Search,
  RefreshCw, Monitor, ChevronDown, ChevronRight, Copy,
} from "lucide-react";

const CATEGORIES = [
  "Snacks", "Beverages", "Fresh Food", "Candy",
  "Healthy Options", "Coffee/Tea", "Supplies", "Other",
];

interface MachineInventoryItem {
  id: string;
  machine_id: string;
  product_name: string;
  sku: string;
  slot_number: string | null;
  quantity: number;
  max_capacity: number;
  unit_price: number;
  cost_of_goods: number | null;
  category: string | null;
  last_restocked: string | null;
  locker_code: string | null;
}

interface Machine {
  id: string;
  name: string;
  machine_code: string;
  machine_type: string;
  location?: { name: string | null; city: string } | null;
}

const MachineInventoryManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMachine, setFilterMachine] = useState<string>("all");
  const [collapsedMachines, setCollapsedMachines] = useState<Set<string>>(new Set());
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingItem, setEditingItem] = useState<MachineInventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<MachineInventoryItem | null>(null);

  // Assign product to multiple machines state
  const [assignForm, setAssignForm] = useState({
    product_name: "",
    sku: "",
    category: "Snacks",
    unit_price: 0,
    cost_of_goods: 0,
    max_capacity: 10,
    quantity: 0,
    slot_number: "",
  });
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]);

  // Edit form
  const [editForm, setEditForm] = useState({
    product_name: "",
    sku: "",
    slot_number: "",
    quantity: 0,
    max_capacity: 10,
    unit_price: 0,
    cost_of_goods: 0,
    category: "Snacks",
  });

  // Queries
  const { data: machines = [] } = useQuery({
    queryKey: ["machines-for-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, name, machine_code, machine_type, location:locations(name, city)")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as Machine[];
    },
  });

  const { data: inventoryItems = [], isLoading } = useQuery({
    queryKey: ["machine-inventory-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machine_inventory")
        .select("*")
        .order("product_name");
      if (error) throw error;
      return data as MachineInventoryItem[];
    },
  });

  // Group inventory by machine
  const machineGroups = useMemo(() => {
    const filtered = inventoryItems.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMachine = filterMachine === "all" || item.machine_id === filterMachine;
      return matchesSearch && matchesMachine;
    });

    const groups = new Map<string, MachineInventoryItem[]>();
    filtered.forEach((item) => {
      const list = groups.get(item.machine_id) || [];
      list.push(item);
      groups.set(item.machine_id, list);
    });
    return groups;
  }, [inventoryItems, searchTerm, filterMachine]);

  // Stats
  const stats = useMemo(() => ({
    totalSlots: inventoryItems.length,
    uniqueMachines: new Set(inventoryItems.map((i) => i.machine_id)).size,
    lowStock: inventoryItems.filter((i) => i.quantity <= 2 && i.quantity > 0).length,
    emptySlots: inventoryItems.filter((i) => i.quantity === 0).length,
  }), [inventoryItems]);

  // Mutations
  const assignMutation = useMutation({
    mutationFn: async ({ form, machineIds }: { form: typeof assignForm; machineIds: string[] }) => {
      const rows = machineIds.map((mid) => ({
        machine_id: mid,
        product_name: form.product_name,
        sku: form.sku,
        category: form.category,
        unit_price: form.unit_price,
        cost_of_goods: form.cost_of_goods,
        max_capacity: form.max_capacity,
        quantity: form.quantity,
        slot_number: form.slot_number || null,
      }));
      const { error } = await supabase.from("machine_inventory").insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["machine-inventory-all"] });
      toast({ title: `Product assigned to ${vars.machineIds.length} machine(s)` });
      setShowAssignDialog(false);
      setSelectedMachineIds([]);
      setAssignForm({ product_name: "", sku: "", category: "Snacks", unit_price: 0, cost_of_goods: 0, max_capacity: 10, quantity: 0, slot_number: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof editForm> }) => {
      const { error } = await supabase.from("machine_inventory").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machine-inventory-all"] });
      toast({ title: "Item updated" });
      setShowEditDialog(false);
      setEditingItem(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("machine_inventory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machine-inventory-all"] });
      toast({ title: "Item removed" });
      setShowDeleteConfirm(false);
      setDeletingItem(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMachine = (id: string) => {
    setCollapsedMachines((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openEdit = (item: MachineInventoryItem) => {
    setEditingItem(item);
    setEditForm({
      product_name: item.product_name,
      sku: item.sku,
      slot_number: item.slot_number || "",
      quantity: item.quantity,
      max_capacity: item.max_capacity,
      unit_price: item.unit_price,
      cost_of_goods: item.cost_of_goods || 0,
      category: item.category || "Snacks",
    });
    setShowEditDialog(true);
  };

  const getMachine = (id: string) => machines.find((m) => m.id === id);

  const toggleSelectMachine = (id: string) => {
    setSelectedMachineIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            Machine Inventory
          </h2>
          <p className="text-muted-foreground">Manage product slots across all machines</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["machine-inventory-all"] })}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => setShowAssignDialog(true)}>
            <Copy className="w-4 h-4 mr-2" /> Assign Product
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Total Slots</p><p className="text-2xl font-bold">{stats.totalSlots}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Machines</p><p className="text-2xl font-bold">{stats.uniqueMachines}</p></CardContent></Card>
        <Card className={stats.lowStock > 0 ? "border-yellow-500/50" : ""}><CardContent className="p-6"><p className="text-sm text-muted-foreground">Low Stock</p><p className={`text-2xl font-bold ${stats.lowStock > 0 ? "text-yellow-500" : ""}`}>{stats.lowStock}</p></CardContent></Card>
        <Card className={stats.emptySlots > 0 ? "border-destructive/50" : ""}><CardContent className="p-6"><p className="text-sm text-muted-foreground">Empty Slots</p><p className={`text-2xl font-bold ${stats.emptySlots > 0 ? "text-destructive" : ""}`}>{stats.emptySlots}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterMachine} onValueChange={setFilterMachine}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder="All Machines" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Machines</SelectItem>
              {machines.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name} ({m.machine_code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Machine Sections */}
      {machineGroups.size === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No inventory found</p>
          <p className="text-sm mt-1">Use "Assign Product" to add products to machines.</p>
        </CardContent></Card>
      ) : (
        Array.from(machineGroups.entries()).map(([machineId, items]) => {
          const machine = getMachine(machineId);
          const isCollapsed = collapsedMachines.has(machineId);
          const machineEmpty = items.filter((i) => i.quantity === 0).length;
          const machineLow = items.filter((i) => i.quantity > 0 && i.quantity <= 2).length;

          return (
            <Card key={machineId}>
              <CardHeader
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleMachine(machineId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    <Monitor className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{machine?.name || "Unknown Machine"}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {machine?.machine_code} • {machine?.location?.name || machine?.location?.city || "No location"} • {items.length} slot{items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {machineEmpty > 0 && <Badge variant="destructive">{machineEmpty} empty</Badge>}
                    {machineLow > 0 && <Badge variant="outline" className="border-yellow-500 text-yellow-500">{machineLow} low</Badge>}
                  </div>
                </div>
              </CardHeader>
              {!isCollapsed && (
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Slot</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>COGS</TableHead>
                        <TableHead>Retail</TableHead>
                        <TableHead>Margin</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const margin = item.unit_price - (item.cost_of_goods || 0);
                        const marginPct = item.unit_price > 0 ? (margin / item.unit_price) * 100 : 0;
                        return (
                          <TableRow key={item.id} className={item.quantity === 0 ? "bg-destructive/5" : item.quantity <= 2 ? "bg-yellow-500/5" : ""}>
                            <TableCell className="font-mono">{item.slot_number || "—"}</TableCell>
                            <TableCell>
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-xs text-muted-foreground">{item.sku}</p>
                            </TableCell>
                            <TableCell><Badge variant="outline">{item.category || "General"}</Badge></TableCell>
                            <TableCell>
                              <span className={item.quantity === 0 ? "text-destructive font-medium" : item.quantity <= 2 ? "text-yellow-500 font-medium" : ""}>
                                {item.quantity}
                              </span>
                              <span className="text-muted-foreground">/{item.max_capacity}</span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">${(item.cost_of_goods || 0).toFixed(2)}</TableCell>
                            <TableCell className="font-medium">${item.unit_price.toFixed(2)}</TableCell>
                            <TableCell>
                              <span className={marginPct >= 30 ? "text-green-600" : marginPct >= 15 ? "text-yellow-500" : "text-destructive"}>
                                {marginPct.toFixed(0)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Edit className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => { setDeletingItem(item); setShowDeleteConfirm(true); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          );
        })
      )}

      {/* Assign Product to Multiple Machines Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Product to Machines</DialogTitle>
            <DialogDescription>Fill in product details, then select which machines to assign it to.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); assignMutation.mutate({ form: assignForm, machineIds: selectedMachineIds }); }} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Name *</Label>
                <Input value={assignForm.product_name} onChange={(e) => setAssignForm({ ...assignForm, product_name: e.target.value })} placeholder="Coca-Cola 12oz" required />
              </div>
              <div className="space-y-2">
                <Label>SKU *</Label>
                <Input value={assignForm.sku} onChange={(e) => setAssignForm({ ...assignForm, sku: e.target.value })} placeholder="COK-12OZ" required />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={assignForm.category} onValueChange={(v) => setAssignForm({ ...assignForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Slot Number</Label>
                <Input value={assignForm.slot_number} onChange={(e) => setAssignForm({ ...assignForm, slot_number: e.target.value })} placeholder="A1 (optional)" />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" value={assignForm.quantity} onChange={(e) => setAssignForm({ ...assignForm, quantity: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Max Capacity</Label>
                <Input type="number" value={assignForm.max_capacity} onChange={(e) => setAssignForm({ ...assignForm, max_capacity: parseInt(e.target.value) || 10 })} />
              </div>
              <div className="space-y-2">
                <Label>Cost of Goods ($)</Label>
                <Input type="number" step="0.01" value={assignForm.cost_of_goods} onChange={(e) => setAssignForm({ ...assignForm, cost_of_goods: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Retail Price ($)</Label>
                <Input type="number" step="0.01" value={assignForm.unit_price} onChange={(e) => setAssignForm({ ...assignForm, unit_price: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>

            {/* Machine Selection */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Select Machines *</Label>
              <p className="text-sm text-muted-foreground">Choose one or more machines to assign this product to.</p>
              <ScrollArea className="h-[200px] rounded-md border p-3">
                <div className="space-y-2">
                  {machines.map((m) => (
                    <label key={m.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                      <Checkbox
                        checked={selectedMachineIds.includes(m.id)}
                        onCheckedChange={() => toggleSelectMachine(m.id)}
                      />
                      <Monitor className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{m.machine_code}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{m.location?.name || m.location?.city || "—"}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
              {selectedMachineIds.length > 0 && (
                <p className="text-sm text-primary font-medium">{selectedMachineIds.length} machine(s) selected</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={selectedMachineIds.length === 0 || assignMutation.isPending}>
                Assign to {selectedMachineIds.length} Machine{selectedMachineIds.length !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Inventory Slot</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (editingItem) updateMutation.mutate({ id: editingItem.id, data: editForm }); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input value={editForm.product_name} onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Slot Number</Label>
                <Input value={editForm.slot_number} onChange={(e) => setEditForm({ ...editForm, slot_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Max Capacity</Label>
                <Input type="number" value={editForm.max_capacity} onChange={(e) => setEditForm({ ...editForm, max_capacity: parseInt(e.target.value) || 10 })} />
              </div>
              <div className="space-y-2">
                <Label>COGS ($)</Label>
                <Input type="number" step="0.01" value={editForm.cost_of_goods} onChange={(e) => setEditForm({ ...editForm, cost_of_goods: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Retail ($)</Label>
                <Input type="number" step="0.01" value={editForm.unit_price} onChange={(e) => setEditForm({ ...editForm, unit_price: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Item</DialogTitle>
            <DialogDescription>Remove "{deletingItem?.product_name}" from this machine? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletingItem && deleteMutation.mutate(deletingItem.id)} disabled={deleteMutation.isPending}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MachineInventoryManager;
