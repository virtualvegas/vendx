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
import { Plus, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  new: "default", scheduled: "secondary", in_progress: "secondary",
  completed: "default", invoiced: "default", cancelled: "outline",
};

const empty: any = {
  id: "", client_id: "", location_id: "", machine_id: "",
  subject: "", description: "", priority: "normal", status: "new", source: "admin",
  scheduled_date: "",
  intake_company_name: "", intake_contact_name: "", intake_contact_email: "",
  intake_contact_phone: "", intake_address: "", intake_machine_description: "",
};

const ExtTicketsPanel = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: clients = [] } = useQuery({
    queryKey: ["ext-clients-min"],
    queryFn: async () => (await supabase.from("vendx_external_clients" as any).select("id,company_name,contact_name").order("company_name")).data || [],
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["ext-locations-for-ticket", form.client_id],
    queryFn: async () => {
      if (!form.client_id) return [];
      const { data } = await supabase.from("vendx_external_locations" as any).select("id,name").eq("client_id", form.client_id);
      return data || [];
    },
  });
  const { data: machines = [] } = useQuery({
    queryKey: ["ext-machines-for-ticket", form.client_id],
    queryFn: async () => {
      if (!form.client_id) return [];
      const { data } = await supabase.from("vendx_external_machines" as any).select("id,asset_label").eq("client_id", form.client_id);
      return data || [];
    },
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["ext-tickets", statusFilter],
    queryFn: async () => {
      let q = supabase.from("vendx_external_service_tickets" as any)
        .select("*, client:vendx_external_clients(company_name), location:vendx_external_locations(name), machine:vendx_external_machines(asset_label)")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const save = async () => {
    if (!form.subject) { toast.error("Subject required"); return; }
    const payload: any = { ...form };
    delete payload.client; delete payload.location; delete payload.machine;
    ["client_id","location_id","machine_id","scheduled_date"].forEach(k => { if (!payload[k]) payload[k] = null; });
    const id = payload.id; delete payload.id;
    const { error } = id
      ? await supabase.from("vendx_external_service_tickets" as any).update(payload).eq("id", id)
      : await supabase.from("vendx_external_service_tickets" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved"); setOpen(false); setForm(empty);
    qc.invalidateQueries({ queryKey: ["ext-tickets"] });
  };

  const convertToInvoice = async (t: any) => {
    if (!t.client_id) { toast.error("Ticket needs a client first"); return; }
    const { data, error } = await supabase.from("vendx_external_service_invoices" as any)
      .insert({ client_id: t.client_id, ticket_id: t.id, status: "draft", notes: `From ticket ${t.ticket_number}: ${t.subject}` })
      .select().single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("vendx_external_service_tickets" as any).update({ status: "invoiced" }).eq("id", t.id);
    toast.success(`Invoice ${(data as any).invoice_number} created`);
    qc.invalidateQueries({ queryKey: ["ext-tickets"] });
    qc.invalidateQueries({ queryKey: ["ext-invoices"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="w-56">
          <SearchableSelect value={statusFilter} onValueChange={setStatusFilter}
            options={["all","new","scheduled","in_progress","completed","invoiced","cancelled"].map(s => ({ value: s, label: s }))}
            placeholder="Filter status" searchPlaceholder="Search..." />
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Ticket
        </Button>
      </div>
      {isLoading ? <p className="text-muted-foreground">Loading...</p> :
        tickets.length === 0 ? <p className="text-muted-foreground">No tickets.</p> :
        <div className="grid gap-3">
          {tickets.map((t: any) => (
            <Card key={t.id} className="p-4">
              <div className="flex justify-between items-start gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs">{t.ticket_number}</span>
                    <Badge variant={(statusColors[t.status] as any) || "outline"}>{t.status}</Badge>
                    <Badge variant="outline">{t.priority}</Badge>
                    <Badge variant="outline">{t.source}</Badge>
                  </div>
                  <h3 className="font-semibold mt-1">{t.subject}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t.client?.company_name || t.intake_company_name || "(unassigned)"}
                    {t.location?.name && ` · ${t.location.name}`}
                    {t.machine?.asset_label && ` · ${t.machine.asset_label}`}
                  </p>
                  {t.scheduled_date && <p className="text-xs text-muted-foreground">Scheduled: {t.scheduled_date}</p>}
                  {t.description && <p className="text-sm mt-2 line-clamp-2">{t.description}</p>}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => { setForm({ ...t, scheduled_date: t.scheduled_date || "" }); setOpen(true); }}>
                    <ExternalLink className="w-4 h-4 mr-1" /> Open
                  </Button>
                  {t.status !== "invoiced" && t.client_id && (
                    <Button size="sm" variant="ghost" onClick={() => convertToInvoice(t)}>
                      <FileText className="w-4 h-4 mr-1" /> Invoice
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      }

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? `Ticket ${form.ticket_number || ""}` : "New Ticket"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Client</Label>
              <SearchableSelect value={form.client_id || ""} onValueChange={v => setForm({ ...form, client_id: v, location_id: "", machine_id: "" })}
                options={[{ value: "", label: "— (intake / unassigned)" }, ...clients.map((c: any) => ({ value: c.id, label: c.company_name }))]}
                placeholder="Select client" searchPlaceholder="Search..." />
            </div>
            <div>
              <Label>Status</Label>
              <SearchableSelect value={form.status} onValueChange={v => setForm({ ...form, status: v })}
                options={["new","scheduled","in_progress","completed","invoiced","cancelled"].map(s => ({ value: s, label: s }))}
                placeholder="Status" searchPlaceholder="Search..." />
            </div>
            <div>
              <Label>Site</Label>
              <SearchableSelect value={form.location_id || ""} onValueChange={v => setForm({ ...form, location_id: v })}
                options={[{ value: "", label: "—" }, ...locations.map((l: any) => ({ value: l.id, label: l.name }))]}
                placeholder="Optional site" searchPlaceholder="Search..." />
            </div>
            <div>
              <Label>Machine</Label>
              <SearchableSelect value={form.machine_id || ""} onValueChange={v => setForm({ ...form, machine_id: v })}
                options={[{ value: "", label: "—" }, ...machines.map((m: any) => ({ value: m.id, label: m.asset_label }))]}
                placeholder="Optional machine" searchPlaceholder="Search..." />
            </div>
            <div>
              <Label>Priority</Label>
              <SearchableSelect value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}
                options={["low","normal","high","critical"].map(s => ({ value: s, label: s }))}
                placeholder="Priority" searchPlaceholder="Search..." />
            </div>
            <div><Label>Scheduled Date</Label><Input type="date" value={form.scheduled_date || ""} onChange={e => setForm({...form, scheduled_date: e.target.value})} /></div>
            <div className="md:col-span-2"><Label>Subject *</Label><Input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} /></div>
            <div className="md:col-span-2"><Label>Description</Label><Textarea rows={4} value={form.description || ""} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="md:col-span-2"><Label>Resolution</Label><Textarea rows={2} value={form.resolution || ""} onChange={e => setForm({...form, resolution: e.target.value})} /></div>

            <div className="md:col-span-2 pt-2 border-t"><p className="text-xs text-muted-foreground font-semibold">Service details</p></div>
            <div>
              <Label>Service Package</Label>
              <SearchableSelect value={form.service_package || ""} onValueChange={v => setForm({...form, service_package: v})}
                options={[
                  { value: "", label: "—" },
                  { value: "diagnostic_visit", label: "Diagnostic Visit" },
                  { value: "monitor_repair", label: "Monitor / Display Repair" },
                  { value: "board_repair", label: "PCB / Board Repair" },
                  { value: "full_restoration", label: "Full Restoration" },
                  { value: "delivery_setup", label: "Delivery & Setup" },
                  { value: "tune_up", label: "Annual Tune-Up" },
                ]}
                placeholder="Package" searchPlaceholder="Search..." />
            </div>
            <div>
              <Label>Service Location</Label>
              <SearchableSelect value={form.service_location_type || ""} onValueChange={v => setForm({...form, service_location_type: v})}
                options={[
                  { value: "", label: "—" },
                  { value: "in_home", label: "Private Home / Residence" },
                  { value: "business", label: "Business / Commercial" },
                  { value: "warehouse", label: "Warehouse / Storage" },
                  { value: "other", label: "Other" },
                ]}
                placeholder="Location type" searchPlaceholder="Search..." />
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input type="checkbox" id="stairs-admin" checked={!!form.has_stairs} onChange={e => setForm({...form, has_stairs: e.target.checked})} />
              <Label htmlFor="stairs-admin" className="cursor-pointer">Machine is up or down stairs</Label>
            </div>
            <div className="md:col-span-2"><Label>Access notes</Label><Textarea rows={2} value={form.access_notes || ""} onChange={e => setForm({...form, access_notes: e.target.value})} /></div>
            <div className="md:col-span-2"><Label>Preferred contact / visit time</Label><Input value={form.preferred_contact_time || ""} onChange={e => setForm({...form, preferred_contact_time: e.target.value})} /></div>

            <div className="md:col-span-2 pt-2 border-t"><p className="text-xs text-muted-foreground font-semibold">Arcade / cabinet (if applicable)</p></div>
            <div><Label>Cabinet brand</Label><Input value={form.arcade_cabinet_brand || ""} onChange={e => setForm({...form, arcade_cabinet_brand: e.target.value})} /></div>
            <div><Label>Cabinet model</Label><Input value={form.arcade_cabinet_model || ""} onChange={e => setForm({...form, arcade_cabinet_model: e.target.value})} /></div>
            <div><Label>Game title</Label><Input value={form.arcade_game_title || ""} onChange={e => setForm({...form, arcade_game_title: e.target.value})} /></div>
            <div><Label>Year</Label><Input type="number" value={form.arcade_year_manufactured || ""} onChange={e => setForm({...form, arcade_year_manufactured: e.target.value ? parseInt(e.target.value, 10) : null})} /></div>
            <div><Label>Monitor</Label><Input value={form.arcade_monitor_type || ""} onChange={e => setForm({...form, arcade_monitor_type: e.target.value})} placeholder="CRT / LCD / DMD..." /></div>
            <div><Label>Controls</Label><Input value={form.arcade_control_type || ""} onChange={e => setForm({...form, arcade_control_type: e.target.value})} placeholder="Joystick, trackball..." /></div>
            <div className="md:col-span-2"><Label>Power</Label><Input value={form.arcade_power_type || ""} onChange={e => setForm({...form, arcade_power_type: e.target.value})} placeholder="120V / 220V / iso transformer" /></div>

            {!form.client_id && (
              <>
                <div className="md:col-span-2 pt-2 border-t"><p className="text-xs text-muted-foreground">Intake details (when no client selected)</p></div>
                <div><Label>Company</Label><Input value={form.intake_company_name || ""} onChange={e => setForm({...form, intake_company_name: e.target.value})} /></div>
                <div><Label>Contact Name</Label><Input value={form.intake_contact_name || ""} onChange={e => setForm({...form, intake_contact_name: e.target.value})} /></div>
                <div><Label>Email</Label><Input value={form.intake_contact_email || ""} onChange={e => setForm({...form, intake_contact_email: e.target.value})} /></div>
                <div><Label>Phone</Label><Input value={form.intake_contact_phone || ""} onChange={e => setForm({...form, intake_contact_phone: e.target.value})} /></div>
                <div className="md:col-span-2"><Label>Address</Label><Input value={form.intake_address || ""} onChange={e => setForm({...form, intake_address: e.target.value})} /></div>
                <div className="md:col-span-2"><Label>Machine description</Label><Input value={form.intake_machine_description || ""} onChange={e => setForm({...form, intake_machine_description: e.target.value})} /></div>
              </>
            )}
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

export default ExtTicketsPanel;
