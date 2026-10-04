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
import { Plus, ExternalLink, FileText, Calendar, User, Merge, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import ExtTicketDetailDialog from "./ExtTicketDetailDialog";
import { formatDisplayDate } from "@/lib/dateUtils";

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
  const [techFilter, setTechFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");

  const { data: techs = [] } = useQuery({
    queryKey: ["ext-tech-filter"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_ext_service_technicians" as any);
      if (error) console.error("tech list error:", error);
      return (data as any[]) || [];
    },
  });

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

  const { data: tickets = [], isLoading, error: ticketsError } = useQuery({
    queryKey: ["ext-tickets", statusFilter, techFilter, fromDate, toDate, techs],
    queryFn: async () => {
      let q = supabase.from("vendx_external_service_tickets" as any)
        .select("*, client:vendx_external_clients(company_name,contact_name), location:vendx_external_locations(name), machine:vendx_external_machines(asset_label), ticket_machines:vendx_external_service_ticket_machines(machine_id, machine:vendx_external_machines(asset_label))")
        .order("scheduled_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (techFilter !== "all") q = techFilter === "unassigned" ? q.is("assigned_technician_id", null) : q.eq("assigned_technician_id", techFilter);
      if (fromDate) q = q.gte("scheduled_date", fromDate);
      if (toDate) q = q.lte("scheduled_date", toDate);
      const { data, error } = await q;
      if (error) throw error;
      const techMap = new Map((techs as any[]).map((u: any) => [u.id, u]));
      return (data || []).map((t: any) => ({ ...t, technician: t.assigned_technician_id ? techMap.get(t.assigned_technician_id) || null : null }));
    },
  });
  if (ticketsError) console.error("ext-tickets query error:", ticketsError);

  const machineLabels = (t: any): string[] => {
    const labels = (t.ticket_machines || []).map((m: any) => m.machine?.asset_label).filter(Boolean);
    if (labels.length === 0 && t.machine?.asset_label) labels.push(t.machine.asset_label);
    return labels;
  };

  const save = async () => {
    if (!form.subject) { toast.error("Subject required"); return; }
    const machineIds: string[] = form.machine_ids || [];
    const payload: any = { ...form, machine_id: machineIds[0] || null };
    delete payload.client; delete payload.location; delete payload.machine; delete payload.technician;
    delete payload.ticket_machines; delete payload.machine_ids;
    ["client_id","location_id","machine_id","scheduled_date"].forEach(k => { if (!payload[k]) payload[k] = null; });
    const id = payload.id; delete payload.id;
    const res = id
      ? await supabase.from("vendx_external_service_tickets" as any).update(payload).eq("id", id).select("id").single()
      : await supabase.from("vendx_external_service_tickets" as any).insert(payload).select("id").single();
    if (res.error) { toast.error(res.error.message); return; }
    const ticketId = (res.data as any).id;
    const tm = supabase.from("vendx_external_service_ticket_machines" as any);
    if (machineIds.length) {
      await tm.delete().eq("ticket_id", ticketId).not("machine_id", "in", `(${machineIds.join(",")})`);
      const { error: e2 } = await supabase.from("vendx_external_service_ticket_machines" as any)
        .upsert(machineIds.map(m => ({ ticket_id: ticketId, machine_id: m })), { onConflict: "ticket_id,machine_id", ignoreDuplicates: true });
      if (e2) toast.error(e2.message);
    } else {
      await tm.delete().eq("ticket_id", ticketId);
    }
    toast.success("Saved"); setOpen(false); setForm(empty);
    qc.invalidateQueries({ queryKey: ["ext-tickets"] });
  };

  const toggleSel = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const selectedTickets = (tickets as any[]).filter(t => selected.includes(t.id));
  const sameSite = selectedTickets.length >= 2 && !!selectedTickets[0].location_id &&
    selectedTickets.every(t => t.location_id === selectedTickets[0].location_id);

  const doMerge = async () => {
    if (!mergeTarget) return;
    const { error } = await supabase.rpc("merge_ext_service_tickets" as any, {
      _target: mergeTarget, _sources: selected.filter(id => id !== mergeTarget),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Tickets merged");
    setMergeOpen(false); setSelected([]);
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
      <div className="flex flex-wrap justify-between items-end gap-2">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="w-44">
            <Label className="text-xs">Status</Label>
            <SearchableSelect value={statusFilter} onValueChange={setStatusFilter}
              options={["all","new","scheduled","in_progress","on_hold","completed","invoiced","cancelled"].map(s => ({ value: s, label: s }))}
              placeholder="Status" searchPlaceholder="Search..." />
          </div>
          <div className="w-56">
            <Label className="text-xs">Technician</Label>
            <SearchableSelect value={techFilter} onValueChange={setTechFilter}
              options={[{ value: "all", label: "All" }, { value: "unassigned", label: "Unassigned" }, ...techs.map((u: any) => ({ value: u.id, label: u.full_name || u.email }))]}
              placeholder="Technician" searchPlaceholder="Search..." />
          </div>
          <div><Label className="text-xs">From</Label><Input type="date" className="w-36" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
          <div><Label className="text-xs">To</Label><Input type="date" className="w-36" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
          {(fromDate || toDate || techFilter !== "all" || statusFilter !== "all") && (
            <Button size="sm" variant="ghost" onClick={() => { setFromDate(""); setToDate(""); setTechFilter("all"); setStatusFilter("all"); }}>Reset</Button>
          )}
        </div>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>Clear ({selected.length})</Button>
              <Button variant="outline" disabled={!sameSite} title={sameSite ? "" : "Select 2+ tickets at the same site"}
                onClick={() => { setMergeTarget(selectedTickets[selectedTickets.length - 1]?.id || ""); setMergeOpen(true); }}>
                <Merge className="w-4 h-4 mr-2" /> Merge {selected.length}
              </Button>
            </>
          )}
          <Button onClick={() => { setForm(empty); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New Ticket
          </Button>
        </div>
      </div>
      {selected.length > 0 && !sameSite && (
        <p className="text-xs text-muted-foreground">Only tickets at the same site can be merged.</p>
      )}
      {isLoading ? <p className="text-muted-foreground">Loading...</p> :
        tickets.length === 0 ? <p className="text-muted-foreground">No tickets match filters.</p> :
        <div className="grid gap-3">
          {tickets.map((t: any) => (
            <Card key={t.id} className={`p-4 hover:border-primary/40 transition cursor-pointer ${selected.includes(t.id) ? "border-primary" : ""}`} onClick={() => setDetailId(t.id)}>
              <div className="flex justify-between items-start gap-2 flex-wrap">
                <div onClick={e => e.stopPropagation()} className="pt-1">
                  <Checkbox checked={selected.includes(t.id)} onCheckedChange={() => toggleSel(t.id)}
                    disabled={!!t.merged_into_ticket_id} aria-label={`Select ticket ${t.ticket_number}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs">{t.ticket_number}</span>
                    <Badge variant={(statusColors[t.status] as any) || "outline"}>{t.status}</Badge>
                    <Badge variant="outline">{t.priority}</Badge>
                    <Badge variant="outline">{t.source}</Badge>
                    {machineLabels(t).length > 1 && <Badge variant="secondary">{machineLabels(t).length} machines</Badge>}
                    {t.merged_into_ticket_id && <Badge variant="outline">merged</Badge>}
                    {t.reschedule_count > 0 && <Badge variant="secondary" className="text-[10px]">{t.reschedule_count}× resched</Badge>}
                  </div>
                  <h3 className="font-semibold mt-1">{t.subject}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t.client?.company_name || t.client?.contact_name || t.intake_company_name || "(unassigned)"}
                    {t.location?.name && ` · ${t.location.name}`}
                    {machineLabels(t).length > 0 && ` · ${machineLabels(t).join(", ")}`}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                    {t.scheduled_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDisplayDate(t.scheduled_date)}{t.scheduled_time ? ` @ ${t.scheduled_time.slice(0,5)}` : ""}</span>}
                    {t.assigned_technician_id && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {t.technician ? (t.technician.full_name || t.technician.email) : "Assigned"}</span>}
                    {(t.labor_cost || t.parts_cost) && <span>${(Number(t.labor_cost||0) + Number(t.parts_cost||0)).toFixed(2)}</span>}
                  </div>
                  {t.description && <p className="text-sm mt-2 line-clamp-2">{t.description}</p>}
                </div>
                <div className="flex flex-col gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={() => setDetailId(t.id)}>
                    <ExternalLink className="w-4 h-4 mr-1" /> Open
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    const ids = (t.ticket_machines || []).map((m: any) => m.machine_id);
                    if (ids.length === 0 && t.machine_id) ids.push(t.machine_id);
                    setForm({ ...t, scheduled_date: t.scheduled_date || "", machine_ids: ids }); setOpen(true);
                  }}>
                    Edit
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

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Merge {selected.length} tickets</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Pick the ticket to keep. Machines, notes, activity and follow-ups from the others move into it, and the others are closed as merged.</p>
          <div>
            <Label>Keep ticket</Label>
            <SearchableSelect value={mergeTarget} onValueChange={setMergeTarget}
              options={selectedTickets.map((t: any) => ({ value: t.id, label: `${t.ticket_number} — ${t.subject}` }))}
              placeholder="Select ticket" searchPlaceholder="Search..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>Cancel</Button>
            <Button onClick={doMerge} disabled={!mergeTarget}>Merge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? `Ticket ${form.ticket_number || ""}` : "New Ticket"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Client</Label>
              <SearchableSelect value={form.client_id || ""} onValueChange={v => setForm({ ...form, client_id: v, location_id: "", machine_id: "", machine_ids: [] })}
                options={[{ value: "", label: "— (intake / unassigned)" }, ...clients.map((c: any) => ({ value: c.id, label: c.company_name || c.contact_name || "Residential Client" }))]}
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
            <div className="md:col-span-2">
              <Label>Machines ({(form.machine_ids || []).length} selected)</Label>
              <SearchableSelect value="" onValueChange={v => { if (v && !(form.machine_ids || []).includes(v)) setForm({ ...form, machine_ids: [...(form.machine_ids || []), v] }); }}
                options={machines.filter((m: any) => !(form.machine_ids || []).includes(m.id)).map((m: any) => ({ value: m.id, label: m.asset_label }))}
                placeholder={form.client_id ? "Add a machine..." : "Select a client first"} searchPlaceholder="Search machines..." />
              {(form.machine_ids || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(form.machine_ids as string[]).map(id => {
                    const m: any = machines.find((x: any) => x.id === id);
                    return (
                      <Badge key={id} variant="secondary" className="gap-1">
                        {m?.asset_label || "Machine"}
                        <button type="button" aria-label="Remove machine" onClick={() => setForm({ ...form, machine_ids: form.machine_ids.filter((x: string) => x !== id) })}><X className="w-3 h-3" /></button>
                      </Badge>
                    );
                  })}
                </div>
              )}
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
      <ExtTicketDetailDialog ticketId={detailId} open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)} />
    </div>
  );
};

export default ExtTicketsPanel;
