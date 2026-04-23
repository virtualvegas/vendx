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
import { Building2, Plus, Edit, Trash2, MapPin, Monitor, Users, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/hooks/useAuditLog";

type OfficeForm = {
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
  handles_machine_storage: boolean;
  handles_customer_service: boolean;
  handles_service_tech: boolean;
  status: string;
  notes: string;
};

const emptyForm: OfficeForm = {
  name: "", code: "", description: "", address: "", city: "", state: "", zip: "", country: "USA",
  phone: "", email: "", manager_id: "",
  handles_machine_storage: true, handles_customer_service: true, handles_service_tech: true,
  status: "active", notes: "",
};

const OfficesManager = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OfficeForm>(emptyForm);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);

  // Offices list with stats
  const { data: offices, isLoading } = useQuery({
    queryKey: ["vendx-offices"],
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase
        .from("vendx_offices" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // Office stats — counts of locations, machines, employees, open tickets per office
  const { data: stats } = useQuery({
    queryKey: ["vendx-offices-stats"],
    queryFn: async () => {
      const [locs, machines, profs, tix] = await Promise.all([
        supabase.from("locations").select("office_id"),
        supabase.from("vendx_machines").select("office_id"),
        supabase.from("profiles").select("office_id"),
        supabase.from("support_tickets").select("office_id, status"),
      ]);
      const tally = (rows: any[] | null, filter?: (r: any) => boolean) => {
        const m = new Map<string, number>();
        (rows || []).filter(r => filter ? filter(r) : true).forEach(r => {
          if (r.office_id) m.set(r.office_id, (m.get(r.office_id) || 0) + 1);
        });
        return m;
      };
      return {
        locations: tally(locs.data),
        machines: tally(machines.data),
        employees: tally(profs.data),
        openTickets: tally(tix.data, (r: any) => r.status !== "resolved" && r.status !== "closed"),
      };
    },
  });

  const { data: managers } = useQuery({
    queryKey: ["office-manager-candidates"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      return (data as any[]) || [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, manager_id: form.manager_id || null };
      if (editingId) {
        const { error } = await supabase.from("vendx_offices" as any).update(payload).eq("id", editingId);
        if (error) throw error;
        await logAuditEvent({ action: "update", entity_type: "vendx_office", entity_id: editingId });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.from("vendx_offices" as any).insert({ ...payload, created_by: user?.id }).select().single();
        if (error) throw error;
        await logAuditEvent({ action: "create", entity_type: "vendx_office", entity_id: (data as any).id, details: { name: form.name, code: form.code } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendx-offices"] });
      qc.invalidateQueries({ queryKey: ["vendx-offices-stats"] });
      toast({ title: editingId ? "Office updated" : "Office created" });
      setOpen(false); setEditingId(null); setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendx_offices" as any).delete().eq("id", id);
      if (error) throw error;
      await logAuditEvent({ action: "delete", entity_type: "vendx_office", entity_id: id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendx-offices"] });
      qc.invalidateQueries({ queryKey: ["vendx-offices-stats"] });
      toast({ title: "Office deleted" });
      if (selectedOfficeId) setSelectedOfficeId(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startEdit = (office: any) => {
    setEditingId(office.id);
    setForm({
      name: office.name || "", code: office.code || "", description: office.description || "",
      address: office.address || "", city: office.city || "", state: office.state || "", zip: office.zip || "",
      country: office.country || "USA", phone: office.phone || "", email: office.email || "",
      manager_id: office.manager_id || "",
      handles_machine_storage: office.handles_machine_storage, handles_customer_service: office.handles_customer_service,
      handles_service_tech: office.handles_service_tech, status: office.status || "active", notes: office.notes || "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6" /> VendX Offices</h2>
          <p className="text-sm text-muted-foreground">Internal regional operations centers — manage locations, machines, employees, and ticket routing.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Office</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Edit Office" : "New Office"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VendX Northeast" /></div>
                <div><Label>Code *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="VX-NE-01" /></div>
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
              <div>
                <Label>Office Manager</Label>
                <SearchableSelect
                  value={form.manager_id}
                  onValueChange={(v) => setForm({ ...form, manager_id: v })}
                  options={(managers || []).map((m: any) => ({ value: m.id, label: `${m.full_name || "Unnamed"} (${m.email})` }))}
                  placeholder="Select office manager"
                />
              </div>
              <div className="space-y-2">
                <Label>Capabilities</Label>
                <div className="flex items-center justify-between rounded border p-2"><span className="text-sm">Machine Storage</span><Switch checked={form.handles_machine_storage} onCheckedChange={(v) => setForm({ ...form, handles_machine_storage: v })} /></div>
                <div className="flex items-center justify-between rounded border p-2"><span className="text-sm">Customer Service</span><Switch checked={form.handles_customer_service} onCheckedChange={(v) => setForm({ ...form, handles_customer_service: v })} /></div>
                <div className="flex items-center justify-between rounded border p-2"><span className="text-sm">Service Tech Operations</span><Switch checked={form.handles_service_tech} onCheckedChange={(v) => setForm({ ...form, handles_service_tech: v })} /></div>
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
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name || !form.code}>{editingId ? "Save Changes" : "Create Office"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading offices…</CardContent></Card>
      ) : !offices?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No offices yet — create one to start organizing operations.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {offices.map((o: any) => (
            <Card key={o.id} className={selectedOfficeId === o.id ? "ring-2 ring-primary" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" />{o.name}
                    </CardTitle>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{o.code}</p>
                  </div>
                  <Badge variant={o.status === "active" ? "default" : "secondary"}>{o.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-xs text-muted-foreground">{[o.city, o.state, o.country].filter(Boolean).join(", ") || "No address"}</p>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div className="flex items-center gap-1.5 text-xs"><MapPin className="h-3 w-3 text-muted-foreground" /> {stats?.locations.get(o.id) || 0} locations</div>
                  <div className="flex items-center gap-1.5 text-xs"><Monitor className="h-3 w-3 text-muted-foreground" /> {stats?.machines.get(o.id) || 0} machines</div>
                  <div className="flex items-center gap-1.5 text-xs"><Users className="h-3 w-3 text-muted-foreground" /> {stats?.employees.get(o.id) || 0} staff</div>
                  <div className="flex items-center gap-1.5 text-xs"><Ticket className="h-3 w-3 text-muted-foreground" /> {stats?.openTickets.get(o.id) || 0} open</div>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {o.handles_machine_storage && <Badge variant="outline" className="text-[10px]">Storage</Badge>}
                  {o.handles_customer_service && <Badge variant="outline" className="text-[10px]">CS</Badge>}
                  {o.handles_service_tech && <Badge variant="outline" className="text-[10px]">Tech</Badge>}
                </div>
                <div className="flex gap-1 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setSelectedOfficeId(o.id)}>Manage</Button>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(o)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete office "${o.name}"? Assignments will be cleared.`)) deleteMut.mutate(o.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedOfficeId && (
        <OfficeAssignmentsPanel officeId={selectedOfficeId} office={offices?.find((o: any) => o.id === selectedOfficeId)} onClose={() => setSelectedOfficeId(null)} />
      )}
    </div>
  );
};

// =====================================================================
// Office Assignments Panel — locations / machines / employees
// =====================================================================

const OfficeAssignmentsPanel = ({ officeId, office, onClose }: { officeId: string; office: any; onClose: () => void }) => {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: locations } = useQuery({
    queryKey: ["all-locations-for-office"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase.from("locations").select("id, name, city, country, office_id").order("name");
      return (data as any[]) || [];
    },
  });

  const { data: machines } = useQuery({
    queryKey: ["all-machines-for-office"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase.from("vendx_machines").select("id, name, machine_code, location_id, office_id").order("machine_code");
      return (data as any[]) || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles-for-office"],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase.from("profiles").select("id, full_name, email, office_id").order("full_name");
      return (data as any[]) || [];
    },
  });

  const assignedLocations = useMemo(() => (locations || []).filter(l => l.office_id === officeId), [locations, officeId]);
  const assignedMachines = useMemo(() => (machines || []).filter(m => m.office_id === officeId), [machines, officeId]);
  const assignedStaff = useMemo(() => (profiles || []).filter(p => p.office_id === officeId), [profiles, officeId]);

  const assignMut = useMutation({
    mutationFn: async ({ table, id, value }: { table: "locations" | "vendx_machines" | "profiles"; id: string; value: string | null }) => {
      const { error } = await supabase.from(table).update({ office_id: value }).eq("id", id);
      if (error) throw error;
      await logAuditEvent({ action: value ? "assign_to_office" : "remove_from_office", entity_type: table, entity_id: id, details: { office_id: value } });
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
        <CardTitle className="text-lg">Manage: {office?.name}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="locations">
          <TabsList>
            <TabsTrigger value="locations">Locations ({assignedLocations.length})</TabsTrigger>
            <TabsTrigger value="machines">Machines ({assignedMachines.length})</TabsTrigger>
            <TabsTrigger value="staff">Staff ({assignedStaff.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="locations" className="space-y-3">
            <div>
              <Label>Add a location to this office</Label>
              <SearchableSelect
                value=""
                onValueChange={(id) => id && assignMut.mutate({ table: "locations", id, value: officeId })}
                options={(locations || []).filter(l => l.office_id !== officeId).map(l => ({ value: l.id, label: `${l.name} — ${l.city}, ${l.country}` }))}
                placeholder="Select a location to assign"
              />
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>City</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
              <TableBody>
                {assignedLocations.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>{l.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.city}, {l.country}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => assignMut.mutate({ table: "locations", id: l.id, value: null })}><Trash2 className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
                {!assignedLocations.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">No locations assigned</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="machines" className="space-y-3">
            <div>
              <Label>Add a machine to this office</Label>
              <SearchableSelect
                value=""
                onValueChange={(id) => id && assignMut.mutate({ table: "vendx_machines", id, value: officeId })}
                options={(machines || []).filter(m => m.office_id !== officeId).map(m => ({ value: m.id, label: `${m.machine_code} — ${m.name || "Unnamed"}` }))}
                placeholder="Select a machine to assign"
              />
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
              <TableBody>
                {assignedMachines.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.machine_code}</TableCell>
                    <TableCell>{m.name || "—"}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => assignMut.mutate({ table: "vendx_machines", id: m.id, value: null })}><Trash2 className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
                {!assignedMachines.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">No machines assigned</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="staff" className="space-y-3">
            <div>
              <Label>Assign an employee to this office</Label>
              <SearchableSelect
                value=""
                onValueChange={(id) => id && assignMut.mutate({ table: "profiles", id, value: officeId })}
                options={(profiles || []).filter(p => p.office_id !== officeId).map(p => ({ value: p.id, label: `${p.full_name || "Unnamed"} (${p.email})` }))}
                placeholder="Select an employee to assign"
              />
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
              <TableBody>
                {assignedStaff.map(p => (
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

export default OfficesManager;
