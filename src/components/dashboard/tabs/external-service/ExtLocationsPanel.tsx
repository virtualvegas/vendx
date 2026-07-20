import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = { id: "", client_id: "", name: "", address: "", city: "", state: "", postal_code: "", country: "", contact_name: "", contact_phone: "", access_notes: "", hours: "", notes: "" };

const ExtLocationsPanel = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [filterClient, setFilterClient] = useState("all");

  const { data: clients = [] } = useQuery({
    queryKey: ["ext-clients-min"],
    queryFn: async () => (await supabase.from("vendx_external_clients" as any).select("id,company_name,contact_name").order("company_name")).data || [],
  });
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["ext-locations", filterClient],
    queryFn: async () => {
      let q = supabase.from("vendx_external_locations" as any).select("*, client:vendx_external_clients(company_name)").order("name");
      if (filterClient !== "all") q = q.eq("client_id", filterClient);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const save = async () => {
    if (!form.client_id || !form.name) { toast.error("Client and site name required"); return; }
    const payload = { ...form }; delete payload.client;
    const id = payload.id; delete payload.id;
    const { error } = id
      ? await supabase.from("vendx_external_locations" as any).update(payload).eq("id", id)
      : await supabase.from("vendx_external_locations" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved"); setOpen(false); setForm(empty);
    qc.invalidateQueries({ queryKey: ["ext-locations"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this site?")) return;
    const { error } = await supabase.from("vendx_external_locations" as any).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["ext-locations"] }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="w-64">
          <SearchableSelect
            value={filterClient}
            onValueChange={setFilterClient}
            options={[{ value: "all", label: "All clients" }, ...clients.map((c: any) => ({ value: c.id, label: c.company_name }))]}
            placeholder="Filter by client"
            searchPlaceholder="Search clients..."
          />
        </div>
        <Button onClick={() => { setForm({ ...empty, client_id: filterClient !== "all" ? filterClient : "" }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Site
        </Button>
      </div>
      {isLoading ? <p className="text-muted-foreground">Loading...</p> :
        locations.length === 0 ? <p className="text-muted-foreground">No sites yet.</p> :
        <div className="grid gap-3">
          {locations.map((l: any) => (
            <Card key={l.id} className="p-4">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{l.name}</h3>
                  <p className="text-sm text-muted-foreground">{l.client?.company_name}</p>
                  <p className="text-sm">{l.address}{l.city ? `, ${l.city}` : ""}{l.state ? `, ${l.state}` : ""} {l.postal_code}</p>
                  {l.contact_name && <p className="text-xs text-muted-foreground mt-1">Contact: {l.contact_name} {l.contact_phone}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => { setForm(l); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(l.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      }
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit" : "New"} Client Site</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Client *</Label>
              <SearchableSelect
                value={form.client_id}
                onValueChange={v => setForm({ ...form, client_id: v })}
                options={clients.map((c: any) => ({ value: c.id, label: c.company_name }))}
                placeholder="Select client"
                searchPlaceholder="Search..."
              />
            </div>
            <div className="md:col-span-2"><Label>Site Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div className="md:col-span-2"><Label>Address</Label><Input value={form.address || ""} onChange={e => setForm({...form, address: e.target.value})} /></div>
            <div><Label>City</Label><Input value={form.city || ""} onChange={e => setForm({...form, city: e.target.value})} /></div>
            <div><Label>State</Label><Input value={form.state || ""} onChange={e => setForm({...form, state: e.target.value})} /></div>
            <div><Label>Postal Code</Label><Input value={form.postal_code || ""} onChange={e => setForm({...form, postal_code: e.target.value})} /></div>
            <div><Label>Country</Label><Input value={form.country || ""} onChange={e => setForm({...form, country: e.target.value})} /></div>
            <div><Label>On-site Contact</Label><Input value={form.contact_name || ""} onChange={e => setForm({...form, contact_name: e.target.value})} /></div>
            <div><Label>Contact Phone</Label><Input value={form.contact_phone || ""} onChange={e => setForm({...form, contact_phone: e.target.value})} /></div>
            <div className="md:col-span-2"><Label>Hours / Access Window</Label><Input value={form.hours || ""} onChange={e => setForm({...form, hours: e.target.value})} /></div>
            <div className="md:col-span-2"><Label>Access Notes</Label><Textarea value={form.access_notes || ""} onChange={e => setForm({...form, access_notes: e.target.value})} /></div>
            <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes || ""} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExtLocationsPanel;
