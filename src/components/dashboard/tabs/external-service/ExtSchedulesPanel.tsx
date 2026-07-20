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
import { Switch } from "@/components/ui/switch";
import { Plus, CalendarClock, Repeat, PlayCircle, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { formatDisplayDate } from "@/lib/dateUtils";

const RECURRENCE = [
  { value: "none", label: "One-off (future date)" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const empty: any = {
  id: "",
  client_id: "", location_id: "", machine_id: "",
  subject: "", description: "", priority: "normal",
  service_package: "", service_location_type: "",
  access_notes: "", notes: "",
  recurrence: "monthly", interval_count: 1,
  next_run_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  active: true,
};

const ExtSchedulesPanel = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [showInactive, setShowInactive] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["ext-clients-min-sched"],
    queryFn: async () => (await supabase.from("vendx_external_clients" as any).select("id,company_name,contact_name").order("company_name")).data || [],
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["ext-locations-sched", form.client_id],
    queryFn: async () => {
      if (!form.client_id) return [];
      const { data } = await supabase.from("vendx_external_locations" as any).select("id,name").eq("client_id", form.client_id);
      return data || [];
    },
  });
  const { data: machines = [] } = useQuery({
    queryKey: ["ext-machines-sched", form.client_id],
    queryFn: async () => {
      if (!form.client_id) return [];
      const { data } = await supabase.from("vendx_external_machines" as any).select("id,asset_label").eq("client_id", form.client_id);
      return data || [];
    },
  });

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["ext-schedules", showInactive],
    queryFn: async () => {
      let q = supabase.from("vendx_external_service_schedules" as any)
        .select("*, client:vendx_external_clients(company_name), location:vendx_external_locations(name), machine:vendx_external_machines(asset_label)")
        .order("next_run_date", { ascending: true });
      if (!showInactive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const save = async () => {
    if (!form.subject) { toast.error("Subject required"); return; }
    if (!form.next_run_date) { toast.error("Next run date required"); return; }
    const payload: any = { ...form };
    delete payload.client; delete payload.location; delete payload.machine;
    ["client_id","location_id","machine_id","service_package","service_location_type","end_date"].forEach(k => {
      if (!payload[k]) payload[k] = null;
    });
    payload.interval_count = Math.max(1, parseInt(payload.interval_count || 1, 10));
    const id = payload.id; delete payload.id;
    const { error } = id
      ? await supabase.from("vendx_external_service_schedules" as any).update(payload).eq("id", id)
      : await supabase.from("vendx_external_service_schedules" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Schedule saved");
    setOpen(false); setForm(empty);
    qc.invalidateQueries({ queryKey: ["ext-schedules"] });
  };

  const runNow = async () => {
    const { data, error } = await supabase.rpc("generate_due_external_service_tickets" as any);
    if (error) { toast.error(error.message); return; }
    toast.success(`Generated ${data || 0} ticket(s)`);
    qc.invalidateQueries({ queryKey: ["ext-schedules"] });
    qc.invalidateQueries({ queryKey: ["ext-tickets"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this schedule?")) return;
    const { error } = await supabase.from("vendx_external_service_schedules" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["ext-schedules"] });
  };

  const toggleActive = async (s: any) => {
    const { error } = await supabase.from("vendx_external_service_schedules" as any).update({ active: !s.active }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["ext-schedules"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" /> Scheduled & Recurring Service
          </h2>
          <p className="text-xs text-muted-foreground">Auto-creates a service ticket on the next run date. Runs daily.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} id="show-inactive" />
            <Label htmlFor="show-inactive" className="cursor-pointer">Show inactive</Label>
          </div>
          <Button variant="outline" size="sm" onClick={runNow}>
            <PlayCircle className="w-4 h-4 mr-1" /> Run due now
          </Button>
          <Button size="sm" onClick={() => { setForm(empty); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> New schedule
          </Button>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> :
        schedules.length === 0 ? <p className="text-sm text-muted-foreground">No schedules yet.</p> :
        <div className="grid gap-2">
          {schedules.map((s: any) => (
            <Card key={s.id} className={`p-3 ${!s.active ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={s.active ? "default" : "outline"}>{s.active ? "active" : "inactive"}</Badge>
                    {s.recurrence !== "none" ? (
                      <Badge variant="secondary" className="gap-1">
                        <Repeat className="w-3 h-3" /> every {s.interval_count} {s.recurrence.replace(/ly$/, "")}
                        {s.interval_count > 1 ? "s" : ""}
                      </Badge>
                    ) : <Badge variant="outline">one-off</Badge>}
                    <Badge variant="outline">{s.priority}</Badge>
                    {s.service_package && <Badge variant="outline">{s.service_package.replace(/_/g, " ")}</Badge>}
                  </div>
                  <div className="font-semibold mt-1">{s.subject}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.client?.company_name || "(no client)"}
                    {s.location?.name && ` · ${s.location.name}`}
                    {s.machine?.asset_label && ` · ${s.machine.asset_label}`}
                  </div>
                  <div className="text-xs mt-1">
                    <span className="font-medium">Next run:</span> {formatDisplayDate(s.next_run_date)}
                    {s.end_date && <span className="text-muted-foreground"> · Ends {formatDisplayDate(s.end_date)}</span>}
                    {s.generated_count > 0 && <span className="text-muted-foreground"> · {s.generated_count} generated</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => { setForm({ ...s, end_date: s.end_date || "" }); setOpen(true); }}>
                    <Edit className="w-4 h-4 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(s)}>
                    {s.active ? "Pause" : "Resume"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                    <Trash2 className="w-4 h-4 mr-1 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      }

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit schedule" : "New scheduled service"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Client</Label>
              <SearchableSelect value={form.client_id || ""} onValueChange={v => setForm({ ...form, client_id: v, location_id: "", machine_id: "" })}
                options={[{ value: "", label: "—" }, ...clients.map((c: any) => ({ value: c.id, label: c.company_name || c.contact_name || "Residential Client" }))]}
                placeholder="Select client" searchPlaceholder="Search..." />
            </div>
            <div>
              <Label>Priority</Label>
              <SearchableSelect value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}
                options={["low","normal","high","critical"].map(s => ({ value: s, label: s }))}
                placeholder="Priority" searchPlaceholder="Search..." />
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
            <div className="md:col-span-2"><Label>Subject *</Label><Input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="e.g. Quarterly preventive maintenance" /></div>
            <div className="md:col-span-2"><Label>Description</Label><Textarea rows={3} value={form.description || ""} onChange={e => setForm({...form, description: e.target.value})} /></div>

            <div className="md:col-span-2 pt-2 border-t"><p className="text-xs font-semibold text-muted-foreground">Schedule</p></div>
            <div>
              <Label>Recurrence</Label>
              <SearchableSelect value={form.recurrence} onValueChange={v => setForm({ ...form, recurrence: v })}
                options={RECURRENCE} placeholder="Recurrence" searchPlaceholder="Search..." />
            </div>
            <div>
              <Label>Repeat every</Label>
              <Input type="number" min={1} value={form.interval_count}
                disabled={form.recurrence === "none"}
                onChange={e => setForm({...form, interval_count: parseInt(e.target.value || "1", 10)})} />
            </div>
            <div><Label>{form.recurrence === "none" ? "Service date" : "Next run date"} *</Label>
              <Input type="date" value={form.next_run_date} onChange={e => setForm({...form, next_run_date: e.target.value})} /></div>
            <div><Label>End date (optional)</Label>
              <Input type="date" value={form.end_date || ""} disabled={form.recurrence === "none"}
                onChange={e => setForm({...form, end_date: e.target.value})} /></div>

            <div className="md:col-span-2 pt-2 border-t"><p className="text-xs font-semibold text-muted-foreground">Service details</p></div>
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
            <div className="md:col-span-2"><Label>Access notes</Label><Textarea rows={2} value={form.access_notes || ""} onChange={e => setForm({...form, access_notes: e.target.value})} /></div>
            <div className="md:col-span-2"><Label>Internal note (added to each generated ticket)</Label><Textarea rows={2} value={form.notes || ""} onChange={e => setForm({...form, notes: e.target.value})} /></div>

            <div className="md:col-span-2 flex items-center gap-2">
              <Switch checked={!!form.active} onCheckedChange={v => setForm({...form, active: v})} id="active-toggle" />
              <Label htmlFor="active-toggle" className="cursor-pointer">Active</Label>
            </div>
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

export default ExtSchedulesPanel;
