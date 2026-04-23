import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Warehouse, Plus, Edit, Trash2, Monitor, Users, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/hooks/useAuditLog";

type WarehouseForm = {
  name: string;
  code: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
  manager_id: string;
  capacity_units: string;
  handles_machine_storage: boolean;
  handles_inventory: boolean;
  handles_shipping: boolean;
  status: string;
  notes: string;
};

const emptyForm: WarehouseForm = {
  name: "", code: "", description: "", address: "", city: "", state: "", zip: "", country: "USA",
  phone: "", email: "", manager_id: "", capacity_units: "",
  handles_machine_storage: true, handles_inventory: true, handles_shipping: false,
  status: "active", notes: "",
};

const WarehousesManager = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WarehouseForm>(emptyForm);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ["vendx-warehouses"],
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase.from("vendx_warehouses" as any).select("*").order("name");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["vendx-warehouses-stats"],
    queryFn: async () => {
      const [machines, profs, items] = await Promise.all([
        supabase.from("vendx_machines").select("warehouse_id" as any),
        supabase.from("profiles").select("warehouse_id" as any),
        supabase.from("inventory_items").select("warehouse_id" as any),
      ]);
      const tally = (rows: any[] | null) => {
        const m = new Map<string, number>();
        (rows || []).forEach((r: any) => {
          if (r.warehouse_id) m.set(r.warehouse_id, (m.get(r.warehouse_id) || 0) + 1);
        });
        return m;
      };
      return {
        machines: tally(machines.data as any[]),
        employees: tally(profs.data as any[]),
        items: tally(items.data as any[]),
      };
    },
  });

  const { data: managers } = useQuery({
    queryKey: ["warehouse-manager-candidates"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      return (data as any[]) || [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...form,
        manager_id: form.manager_id || null,
        capacity_units: form.capacity_units ? Number(form.capacity_units) : null,
      };
      if (editingId) {
        const { error } = await supabase.from("vendx_warehouses" as any).update(payload).eq("id", editingId);
        if (error) throw error;
        await logAuditEvent({ action: "update", entity_type: "vendx_warehouse", entity_id: editingId });
      } else {
        const { data, error } = await supabase.from("vendx_warehouses" as any).insert(payload).select().single();
        if (error) throw error;
        await logAuditEvent({ action: "create", entity_type: "vendx_warehouse", entity_id: (data as any).id, details: { name: form.name, code: form.code } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendx-warehouses"] });
      qc.invalidateQueries({ queryKey: ["vendx-warehouses-stats"] });
      toast({ title: editingId ? "Warehouse updated" : "Warehouse created" });
      setOpen(false); setEditingId(null); setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendx_warehouses" as any).delete().eq("id", id);
      if (error) throw error;
      await logAuditEvent({ action: "delete", entity_type: "vendx_warehouse", entity_id: id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendx-warehouses"] });
      qc.invalidateQueries({ queryKey: ["vendx-warehouses-stats"] });
      toast({ title: "Warehouse deleted" });
      if (selectedWarehouseId) setSelectedWarehouseId(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startEdit = (w: any) => {
    setEditingId(w.id);
    setForm({
      name: w.name || "", code: w.code || "", description: w.description || "",
      address: w.address || "", city: w.city || "", state: w.state || "", zip: w.zip || "",
      country: w.country || "USA", phone: w.phone || "", email: w.email || "",
      manager_id: w.manager_id || "",
      capacity_units: w.capacity_units?.toString() || "",
      handles_machine_storage: w.handles_machine_storage,
      handles_inventory: w.handles_inventory,
      handles_shipping: w.handles_shipping,
      status: w.status || "active",
      notes: w.notes || "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Warehouse className="h-6 w-6" /> VendX Warehouses</h2>
          <p className="text-sm text-muted-foreground">Internal storage & fulfillment hubs — manage machine storage, inventory stock, and warehouse staff.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Warehouse</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Edit Warehouse" : "New Warehouse"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VendX Northeast Warehouse" /></div>
                <div><Label>Code *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WH-NE-01" /></div>
              </div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid grid-cols-4 gap-3">
                <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
                <div><Label>Zip</Label><Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></div>
                <div><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Warehouse Manager</Label>
                  <SearchableSelect
                    value={form.manager_id}
                    onValueChange={(v) => setForm({ ...form, manager_id: v })}
                    options={(managers || []).map((m: any) => ({ value: m.id, label: `${m.full_name || "Unnamed"} (${m.email})` }))}
                    placeholder="Select warehouse manager"
                  />
                </div>
                <div>
                  <Label>Capacity (units)</Label>
                  <Input type="number" value={form.capacity_units} onChange={(e) => setForm({ ...form, capacity_units: e.target.value })} placeholder="e.g. 500" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Capabilities</Label>
                <div className="flex items-center justify-between rounded border p-2"><span className="text-sm">Machine Storage</span><Switch checked={form.handles_machine_storage} onCheckedChange={(v) => setForm({ ...form, handles_machine_storage: v })} /></div>
                <div className="flex items-center justify-between rounded border p-2"><span className="text-sm">Inventory Stocking</span><Switch checked={form.handles_inventory} onCheckedChange={(v) => setForm({ ...form, handles_inventory: v })} /></div>
                <div className="flex items-center justify-between rounded border p-2"><span className="text-sm">Shipping & Fulfillment</span><Switch checked={form.handles_shipping} onCheckedChange={(v) => setForm({ ...form, handles_shipping: v })} /></div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Internal Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name || !form.code}>{editingId ? "Save Changes" : "Create Warehouse"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading warehouses…</CardContent></Card>
      ) : !warehouses?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No warehouses yet — create one to start organizing storage and inventory.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((w: any) => (
            <Card key={w.id} className={selectedWarehouseId === w.id ? "ring-2 ring-primary" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Warehouse className="h-4 w-4" />{w.name}
                    </CardTitle>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{w.code}</p>
                  </div>
                  <Badge variant={w.status === "active" ? "default" : "secondary"}>{w.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-xs text-muted-foreground">{[w.city, w.state, w.country].filter(Boolean).join(", ") || "No address"}</p>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                  <div className="flex items-center gap-1.5 text-xs"><Monitor className="h-3 w-3 text-muted-foreground" /> {stats?.machines.get(w.id) || 0} mach</div>
                  <div className="flex items-center gap-1.5 text-xs"><Package className="h-3 w-3 text-muted-foreground" /> {stats?.items.get(w.id) || 0} items</div>
                  <div className="flex items-center gap-1.5 text-xs"><Users className="h-3 w-3 text-muted-foreground" /> {stats?.employees.get(w.id) || 0} staff</div>
                </div>
                {w.capacity_units && (
                  <p className="text-xs text-muted-foreground">Capacity: {w.capacity_units} units</p>
                )}
                <div className="flex flex-wrap gap-1 pt-1">
                  {w.handles_machine_storage && <Badge variant="outline" className="text-[10px]">Storage</Badge>}
                  {w.handles_inventory && <Badge variant="outline" className="text-[10px]">Inventory</Badge>}
                  {w.handles_shipping && <Badge variant="outline" className="text-[10px]">Shipping</Badge>}
                </div>
                <div className="flex gap-1 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setSelectedWarehouseId(w.id)}>Manage</Button>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(w)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete warehouse "${w.name}"? Assignments will be cleared.`)) deleteMut.mutate(w.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedWarehouseId && (
        <WarehouseAssignmentsPanel warehouseId={selectedWarehouseId} warehouse={warehouses?.find((w: any) => w.id === selectedWarehouseId)} onClose={() => setSelectedWarehouseId(null)} />
      )}
    </div>
  );
};

// =====================================================================
// Assignment panel — machines / inventory items / staff
// =====================================================================

const WarehouseAssignmentsPanel = ({ warehouseId, warehouse, onClose }: { warehouseId: string; warehouse: any; onClose: () => void }) => {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: machines } = useQuery({
    queryKey: ["all-machines-for-warehouse"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase.from("vendx_machines").select("id, name, machine_code, warehouse_id" as any).order("machine_code");
      return (data as any[]) || [];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["all-inventory-for-warehouse"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase.from("inventory_items").select("id, product_name, sku, quantity, warehouse_id" as any).order("product_name");
      return (data as any[]) || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles-for-warehouse"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase.from("profiles").select("id, full_name, email, warehouse_id" as any).order("full_name");
      return (data as any[]) || [];
    },
  });

  const assignedMachines = useMemo(() => (machines || []).filter((m: any) => m.warehouse_id === warehouseId), [machines, warehouseId]);
  const assignedItems = useMemo(() => (items || []).filter((i: any) => i.warehouse_id === warehouseId), [items, warehouseId]);
  const assignedStaff = useMemo(() => (profiles || []).filter((p: any) => p.warehouse_id === warehouseId), [profiles, warehouseId]);

  const assignMut = useMutation({
    mutationFn: async ({ table, id, value }: { table: "vendx_machines" | "inventory_items" | "profiles"; id: string; value: string | null }) => {
      const { error } = await supabase.from(table).update({ warehouse_id: value } as any).eq("id", id);
      if (error) throw error;
      await logAuditEvent({ action: value ? "assign_to_warehouse" : "remove_from_warehouse", entity_type: table, entity_id: id, details: { warehouse_id: value } });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast({ title: "Assignment updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="border-primary/40">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Manage: {warehouse?.name}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="machines">
          <TabsList>
            <TabsTrigger value="machines">Machines ({assignedMachines.length})</TabsTrigger>
            <TabsTrigger value="inventory">Inventory ({assignedItems.length})</TabsTrigger>
            <TabsTrigger value="staff">Staff ({assignedStaff.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="machines" className="space-y-3">
            <div>
              <Label>Add a machine to this warehouse</Label>
              <SearchableSelect
                value=""
                onValueChange={(id) => id && assignMut.mutate({ table: "vendx_machines", id, value: warehouseId })}
                options={(machines || []).filter((m: any) => m.warehouse_id !== warehouseId).map((m: any) => ({ value: m.id, label: `${m.machine_code} — ${m.name || "Unnamed"}` }))}
                placeholder="Select a machine to store here"
              />
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
              <TableBody>
                {assignedMachines.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.machine_code}</TableCell>
                    <TableCell>{m.name || "—"}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => assignMut.mutate({ table: "vendx_machines", id: m.id, value: null })}><Trash2 className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
                {!assignedMachines.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">No machines stored</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-3">
            <div>
              <Label>Add an inventory item to this warehouse</Label>
              <SearchableSelect
                value=""
                onValueChange={(id) => id && assignMut.mutate({ table: "inventory_items", id, value: warehouseId })}
                options={(items || []).filter((i: any) => i.warehouse_id !== warehouseId).map((i: any) => ({ value: i.id, label: `${i.product_name} (${i.sku || "no SKU"})` }))}
                placeholder="Select an inventory item"
              />
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Qty</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
              <TableBody>
                {assignedItems.map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.product_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{i.sku || "—"}</TableCell>
                    <TableCell>{i.quantity}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => assignMut.mutate({ table: "inventory_items", id: i.id, value: null })}><Trash2 className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
                {!assignedItems.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No inventory items assigned</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="staff" className="space-y-3">
            <div>
              <Label>Assign an employee to this warehouse</Label>
              <SearchableSelect
                value=""
                onValueChange={(id) => id && assignMut.mutate({ table: "profiles", id, value: warehouseId })}
                options={(profiles || []).filter((p: any) => p.warehouse_id !== warehouseId).map((p: any) => ({ value: p.id, label: `${p.full_name || "Unnamed"} (${p.email})` }))}
                placeholder="Select an employee to assign"
              />
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
              <TableBody>
                {assignedStaff.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.full_name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.email}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => assignMut.mutate({ table: "profiles", id: p.id, value: null })}><Trash2 className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
                {!assignedStaff.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">No staff assigned</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default WarehousesManager;
