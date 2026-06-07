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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = { id: "", client_id: "", location_id: "", asset_label: "", machine_type: "", make: "", model: "", serial_number: "", install_date: "", warranty_expires_on: "", hourly_rate_override: "", photo_url: "", contract_terms: "", notes: "", status: "active" };

const ExtMachinesPanel = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [filterClient, setFilterClient] = useState("all");

  const { data: clients = [] } = useQuery({
    queryKey: ["ext-clients-min"],
    queryFn: async () => (await supabase.from("vendx_external_clients" as any).select("id,company_name").order("company_name")).data || [],
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["ext-locations-min", form.client_id],
    queryFn: async () => {
      if (!form.client_id) return [];
      const { data } = await supabase.from("vendx_external_locations" as any).select("id,name").eq("client_id", form.client_id).order("name");
      return data || [];
    },
  });
  const { data: machines = [], isLoading } = useQuery({
    queryKey: ["ext-machines", filterClient],
    queryFn: async () => {
      let q = supabase.from("vendx_external_machines" as any).select("*, client:vendx_external_clients(company_name), location:vendx_external_locations(name)").order("asset_label");
      if (filterClient !== "all") q = q.eq("client_id", filterClient);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const save = async () => {
    if (!form.client_id || !form.asset_label) { toast.error("Client and asset label required"); return; }
    const payload: any = { ...form };
    delete payload.client; delete payload.location;
    ["install_date","warranty_expires_on","location_id"].forEach(k => { if (!payload[k]) payload[k] = null; });
    payload.hourly_rate_override = payload.hourly_rate_override === "" ? null : parseFloat(payload.hourly_rate_override);
    const id = payload.id; delete payload.id;
    const { error } = id
      ? await supabase.from("vendx_external_machines" as any).update(payload).eq("id", id)
      : await supabase.from("vendx_external_machines" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved"); setOpen(false); setForm(empty);
    qc.invalidateQueries({ queryKey: ["ext-machines"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this machine?")) return;
    const { error } = await supabase.from("vendx_external_machines" as any).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["ext-machines"] }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="w-64">
          <SearchableSelect value={filterClient} onValueChange={setFilterClient}
            options={[{ value: "all", label: "All clients" }, ...clients.map((c: any) => ({ value: c.id, label: c.company_name }))]}
            placeholder="Filter by client" searchPlaceholder="Search clients..." />
        </div>
        <Button onClick={() => { setForm({ ...empty, client_id: filterClient !== "all" ? filterClient : "" }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Machine
        </Button>
      </div>
      {isLoading ? <p className="text-muted-foreground">Loading...</p> :
        machines.length === 0 ? <p className="text-muted-foreground">No machines yet.</p> :
        <div className="grid gap-3">
          {machines.map((m: any) => (
            <Card key={m.id} className="p-4">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{m.asset_label}</h3>
                    {m.machine_type && <Badge variant="outline">{m.machine_type}</Badge>}
                    <Badge variant={m.status === "active" ? "default" : "outline"}>{m.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{m.client?.company_name}{m.location?.name ? ` · ${m.location.name}` : ""}</p>
                  <p className="text-xs text-muted-foreground">{[m.make, m.model, m.serial_number].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => { setForm({ ...m, install_date: m.install_date || "", warranty_expires_on: m.warranty_expires_on || "", hourly_rate_override: m.hourly_rate_override ?? "" }); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(m.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      }
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit" : "New"} Client Machine</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Client *</Label>
              <SearchableSelect value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v, location_id: "" })}
                options={clients.map((c: any) => ({ value: c.id, label: c.company_name }))} placeholder="Select client" searchPlaceholder="Search..." />
            </div>
            <div>
              <Label>Site</Label>
              <SearchableSelect value={form.location_id || ""} onValueChange={v => setForm({ ...form, location_id: v })}
                options={[{ value: "", label: "—" }, ...locations.map((l: any) => ({ value: l.id, label: l.name }))]} placeholder="Optional site" searchPlaceholder="Search..." />
            </div>
            <div className="md:col-span-2"><Label>Asset Label *</Label><Input value={form.asset_label} onChange={e => setForm({...form, asset_label: e.target.value})} /></div>
            <div><Label>Machine Type</Label>
              <SearchableSelect value={form.machine_type || ""} onValueChange={v => setForm({...form, machine_type: v})}
                options={[
                  { value: "vending_snack", label: "Vending – Snack" },
                  { value: "vending_beverage", label: "Vending – Beverage" },
                  { value: "vending_combo", label: "Vending – Combo" },
                  { value: "vending_fresh", label: "Vending – Fresh / Cold Food" },
                  { value: "coin_operated", label: "Coin-Operated Machine" },
                  { value: "arcade_commercial", label: "Arcade – Commercial" },
                  { value: "arcade_home", label: "Arcade – In-Home" },
                  { value: "pinball", label: "Pinball Machine" },
                  { value: "bowling_pinsetter", label: "Bowling Lane Pinsetter" },
                  { value: "redemption", label: "Redemption / Ticket Game" },
                  { value: "claw_crane", label: "Claw / Crane" },
                  { value: "jukebox", label: "Jukebox" },
                  { value: "pool_table", label: "Pool / Billiards Table" },
                  { value: "atm", label: "ATM" },
                  { value: "kiosk", label: "Self-Service Kiosk" },
                  { value: "other", label: "Other" },
                ]} placeholder="Select machine type" searchPlaceholder="Search types..." />
            </div>
            <div><Label>Status</Label>
              <SearchableSelect value={form.status} onValueChange={v => setForm({ ...form, status: v })}
                options={["active","inactive","retired"].map(s => ({ value: s, label: s }))} placeholder="Status" searchPlaceholder="Search..." />
            </div>
            <div><Label>Make</Label><Input value={form.make || ""} onChange={e => setForm({...form, make: e.target.value})} /></div>
            <div><Label>Model</Label><Input value={form.model || ""} onChange={e => setForm({...form, model: e.target.value})} /></div>
            <div><Label>Serial Number</Label><Input value={form.serial_number || ""} onChange={e => setForm({...form, serial_number: e.target.value})} /></div>
            <div><Label>Hourly Rate Override</Label><Input type="number" step="0.01" value={form.hourly_rate_override} onChange={e => setForm({...form, hourly_rate_override: e.target.value})} placeholder="(uses client default)" /></div>
            <div><Label>Install Date</Label><Input type="date" value={form.install_date || ""} onChange={e => setForm({...form, install_date: e.target.value})} /></div>
            <div><Label>Warranty Expires</Label><Input type="date" value={form.warranty_expires_on || ""} onChange={e => setForm({...form, warranty_expires_on: e.target.value})} /></div>
            <div className="md:col-span-2"><Label>Photo URL</Label><Input value={form.photo_url || ""} onChange={e => setForm({...form, photo_url: e.target.value})} /></div>
            <div className="md:col-span-2"><Label>Contract Terms</Label><Textarea value={form.contract_terms || ""} onChange={e => setForm({...form, contract_terms: e.target.value})} /></div>
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

export default ExtMachinesPanel;
