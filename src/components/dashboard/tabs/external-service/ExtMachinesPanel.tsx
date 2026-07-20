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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Wrench, FileText, X } from "lucide-react";
import { toast } from "sonner";
import MachineServiceHistory from "./MachineServiceHistory";

const empty = {
  id: "", client_id: "", location_id: "", asset_label: "", machine_type: "",
  make: "", model: "", serial_number: "", install_date: "", warranty_expires_on: "",
  hourly_rate_override: "", photo_url: "", contract_terms: "", notes: "", status: "active",
  purchased_from_us: false, custom_arcade_request_id: "", sale_date: "", sale_price: "",
  warranty_pdf_url: "", manual_urls: [] as Array<{ label: string; url: string }>,
};

const ExtMachinesPanel = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [historyMachine, setHistoryMachine] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);
  const [filterClient, setFilterClient] = useState("all");
  const [manualDraft, setManualDraft] = useState({ label: "", url: "" });

  const { data: clients = [] } = useQuery({
    queryKey: ["ext-clients-min"],
    queryFn: async () => (await supabase.from("vendx_external_clients" as any).select("id,company_name,contact_name").order("company_name")).data || [],
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["ext-locations-min", form.client_id],
    queryFn: async () => {
      if (!form.client_id) return [];
      const { data } = await supabase.from("vendx_external_locations" as any).select("id,name").eq("client_id", form.client_id).order("name");
      return data || [];
    },
  });
  const { data: customRequests = [] } = useQuery({
    queryKey: ["custom-arcade-requests-min"],
    queryFn: async () => {
      const { data } = await supabase.from("vendx_custom_arcade_requests")
        .select("id, request_number, full_name, status")
        .in("status", ["accepted", "completed", "quoted"])
        .order("created_at", { ascending: false }).limit(200);
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

  const addManual = () => {
    if (!manualDraft.url.trim()) return;
    setForm({ ...form, manual_urls: [...(form.manual_urls || []), { label: manualDraft.label.trim() || "Manual", url: manualDraft.url.trim() }] });
    setManualDraft({ label: "", url: "" });
  };
  const removeManual = (idx: number) => {
    setForm({ ...form, manual_urls: (form.manual_urls || []).filter((_: any, i: number) => i !== idx) });
  };

  const save = async () => {
    if (!form.client_id || !form.asset_label) { toast.error("Client and asset label required"); return; }
    const payload: any = { ...form };
    delete payload.client; delete payload.location;
    ["install_date","warranty_expires_on","location_id","sale_date","custom_arcade_request_id"].forEach(k => { if (!payload[k]) payload[k] = null; });
    payload.hourly_rate_override = payload.hourly_rate_override === "" ? null : parseFloat(payload.hourly_rate_override);
    payload.sale_price = payload.sale_price === "" ? null : parseFloat(payload.sale_price);
    payload.manual_urls = Array.isArray(payload.manual_urls) ? payload.manual_urls : [];
    const id = payload.id; delete payload.id;
    const { error } = id
      ? await supabase.from("vendx_external_machines" as any).update(payload).eq("id", id)
      : await supabase.from("vendx_external_machines" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved"); setOpen(false); setForm(empty);
    qc.invalidateQueries({ queryKey: ["ext-machines"] });
    qc.invalidateQueries({ queryKey: ["sold-machines-stats"] });
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
        <div className="grid gap-2.5 md:grid-cols-2">
          {machines.map((m: any) => (
            <Card key={m.id} className="p-3.5">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-semibold truncate">{m.asset_label}</h3>
                    <Badge variant={m.status === "active" ? "default" : "outline"} className="text-[10px]">{m.status}</Badge>
                    {m.purchased_from_us && <Badge className="text-[10px] bg-primary/20 text-primary border-primary/40">VendX-built</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{m.client?.company_name}{m.location?.name ? ` · ${m.location.name}` : ""}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{[m.machine_type, m.make, m.model, m.serial_number].filter(Boolean).join(" · ")}</p>
                  {Array.isArray(m.manual_urls) && m.manual_urls.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {m.manual_urls.slice(0, 3).map((mn: any, i: number) => (
                        <a key={i} href={mn.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/70">
                          <FileText className="w-3 h-3" /> {mn.label || "Manual"}
                        </a>
                      ))}
                      {m.manual_urls.length > 3 && <span className="text-[10px] text-muted-foreground">+{m.manual_urls.length - 3}</span>}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="icon" variant="ghost" title="Service history" onClick={() => setHistoryMachine(m)}><Wrench className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => {
                    setForm({
                      ...empty, ...m,
                      install_date: m.install_date || "", warranty_expires_on: m.warranty_expires_on || "",
                      sale_date: m.sale_date || "", sale_price: m.sale_price ?? "",
                      hourly_rate_override: m.hourly_rate_override ?? "",
                      custom_arcade_request_id: m.custom_arcade_request_id || "",
                      manual_urls: Array.isArray(m.manual_urls) ? m.manual_urls : [],
                    });
                    setOpen(true);
                  }}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(m.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      }

      <Dialog open={!!historyMachine} onOpenChange={(v) => !v && setHistoryMachine(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Wrench className="w-5 h-5 text-primary" />{historyMachine?.asset_label}</DialogTitle></DialogHeader>
          {historyMachine && <MachineServiceHistory machineId={historyMachine.id} />}
        </DialogContent>
      </Dialog>

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

            <div className="md:col-span-2 pt-3 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Sales / VendX-built tracking</p>
              <label className="flex items-center gap-2 text-sm mb-2">
                <Checkbox checked={!!form.purchased_from_us} onCheckedChange={v => setForm({ ...form, purchased_from_us: !!v })} />
                This machine was sold or built by VendX
              </label>
            </div>
            {form.purchased_from_us && (
              <>
                <div><Label>Sale Date</Label><Input type="date" value={form.sale_date || ""} onChange={e => setForm({...form, sale_date: e.target.value})} /></div>
                <div><Label>Sale Price</Label><Input type="number" step="0.01" value={form.sale_price} onChange={e => setForm({...form, sale_price: e.target.value})} /></div>
                <div className="md:col-span-2">
                  <Label>Linked custom arcade request</Label>
                  <SearchableSelect value={form.custom_arcade_request_id || ""} onValueChange={v => setForm({ ...form, custom_arcade_request_id: v })}
                    options={[{ value: "", label: "— none —" }, ...customRequests.map((r: any) => ({ value: r.id, label: `${r.request_number} — ${r.full_name} (${r.status})` }))]}
                    placeholder="Optional" searchPlaceholder="Search by request # or name..." />
                </div>
              </>
            )}

            <div className="md:col-span-2 pt-3 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Documentation</p>
            </div>
            <div className="md:col-span-2"><Label>Warranty PDF URL</Label><Input value={form.warranty_pdf_url || ""} onChange={e => setForm({...form, warranty_pdf_url: e.target.value})} placeholder="https://..." /></div>
            <div className="md:col-span-2">
              <Label>Manuals / PDFs</Label>
              <div className="space-y-1.5 mt-1">
                {(form.manual_urls || []).map((m: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-muted/40 p-1.5 rounded">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{m.label}</span>
                    <a href={m.url} target="_blank" rel="noreferrer" className="text-xs text-primary truncate flex-1">{m.url}</a>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeManual(i)}><X className="w-3 h-3" /></Button>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_2fr_auto] gap-1.5">
                  <Input placeholder="Label" value={manualDraft.label} onChange={e => setManualDraft({ ...manualDraft, label: e.target.value })} />
                  <Input placeholder="PDF URL" value={manualDraft.url} onChange={e => setManualDraft({ ...manualDraft, url: e.target.value })} />
                  <Button type="button" size="sm" variant="outline" onClick={addManual}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>

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
