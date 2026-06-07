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
import { Plus, Wrench, FileText } from "lucide-react";
import { toast } from "sonner";

const BusinessExternalService = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ client_id: "", location_id: "", machine_id: "", subject: "", description: "", priority: "normal" });

  const { data: clients = [] } = useQuery({
    queryKey: ["my-ext-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("vendx_external_clients" as any).select("id,company_name").order("company_name");
      return data || [];
    },
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["my-ext-locations", form.client_id],
    queryFn: async () => {
      if (!form.client_id) return [];
      const { data } = await supabase.from("vendx_external_locations" as any).select("id,name").eq("client_id", form.client_id);
      return data || [];
    },
  });
  const { data: machines = [] } = useQuery({
    queryKey: ["my-ext-machines-form", form.client_id],
    queryFn: async () => {
      if (!form.client_id) return [];
      const { data } = await supabase.from("vendx_external_machines" as any).select("id,asset_label").eq("client_id", form.client_id);
      return data || [];
    },
  });
  const { data: myMachines = [] } = useQuery({
    queryKey: ["my-ext-machines-all"],
    queryFn: async () => {
      const { data } = await supabase.from("vendx_external_machines" as any).select("*, location:vendx_external_locations(name)").order("asset_label");
      return data || [];
    },
  });
  const { data: tickets = [] } = useQuery({
    queryKey: ["my-ext-tickets"],
    queryFn: async () => {
      const { data } = await supabase.from("vendx_external_service_tickets" as any)
        .select("*, machine:vendx_external_machines(asset_label)").order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["my-ext-invoices"],
    queryFn: async () => {
      const { data } = await supabase.from("vendx_external_service_invoices" as any).select("*").order("issue_date", { ascending: false }).limit(50);
      return data || [];
    },
  });

  const submit = async () => {
    if (!form.client_id || !form.subject) { toast.error("Client and subject required"); return; }
    const payload: any = { ...form, source: "business_owner", status: "new" };
    ["location_id","machine_id"].forEach(k => { if (!payload[k]) payload[k] = null; });
    const { error } = await supabase.from("vendx_external_service_tickets" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Request submitted");
    setOpen(false); setForm({ client_id: "", location_id: "", machine_id: "", subject: "", description: "", priority: "normal" });
    qc.invalidateQueries({ queryKey: ["my-ext-tickets"] });
  };

  if (clients.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Wrench className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
        <h3 className="font-semibold">No client account linked</h3>
        <p className="text-sm text-muted-foreground">Contact VendX support to link your company account so you can submit service requests for your machines.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">External Service</h2>
          <p className="text-sm text-muted-foreground">Request VendX technicians to service your machines.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Request Service</Button>
      </div>

      <div>
        <h3 className="font-semibold mb-2">My Machines</h3>
        {myMachines.length === 0 ? <p className="text-sm text-muted-foreground">No machines on file yet.</p> :
          <div className="grid gap-2 md:grid-cols-2">
            {myMachines.map((m: any) => (
              <Card key={m.id} className="p-3">
                <p className="font-medium">{m.asset_label}</p>
                <p className="text-xs text-muted-foreground">{[m.make, m.model].filter(Boolean).join(" · ")} {m.location?.name && `· ${m.location.name}`}</p>
              </Card>
            ))}
          </div>
        }
      </div>

      <div>
        <h3 className="font-semibold mb-2">My Service Tickets</h3>
        {tickets.length === 0 ? <p className="text-sm text-muted-foreground">No tickets.</p> :
          <div className="grid gap-2">
            {tickets.map((t: any) => (
              <Card key={t.id} className="p-3">
                <div className="flex justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2"><span className="font-mono text-xs">{t.ticket_number}</span><Badge>{t.status}</Badge></div>
                    <p className="font-medium">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">{t.machine?.asset_label}</p>
                  </div>
                  {t.scheduled_date && <Badge variant="outline">Scheduled {t.scheduled_date}</Badge>}
                </div>
              </Card>
            ))}
          </div>
        }
      </div>

      <div>
        <h3 className="font-semibold mb-2 flex items-center gap-2"><FileText className="w-4 h-4" /> My Invoices</h3>
        {invoices.length === 0 ? <p className="text-sm text-muted-foreground">No invoices.</p> :
          <div className="grid gap-2">
            {invoices.map((i: any) => (
              <Card key={i.id} className="p-3 flex justify-between items-center">
                <div>
                  <p className="font-mono text-xs">{i.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">{i.issue_date} · {i.status}</p>
                </div>
                <p className="font-bold">${Number(i.total).toFixed(2)}</p>
              </Card>
            ))}
          </div>
        }
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Service</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Account *</Label>
              <SearchableSelect value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v, location_id: "", machine_id: "" })}
                options={clients.map((c: any) => ({ value: c.id, label: c.company_name }))} placeholder="Select" searchPlaceholder="Search..." />
            </div>
            <div>
              <Label>Site</Label>
              <SearchableSelect value={form.location_id} onValueChange={v => setForm({ ...form, location_id: v })}
                options={[{ value: "", label: "—" }, ...locations.map((l: any) => ({ value: l.id, label: l.name }))]}
                placeholder="Optional" searchPlaceholder="Search..." />
            </div>
            <div>
              <Label>Machine</Label>
              <SearchableSelect value={form.machine_id} onValueChange={v => setForm({ ...form, machine_id: v })}
                options={[{ value: "", label: "—" }, ...machines.map((m: any) => ({ value: m.id, label: m.asset_label }))]}
                placeholder="Optional" searchPlaceholder="Search..." />
            </div>
            <div>
              <Label>Priority</Label>
              <SearchableSelect value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}
                options={["low","normal","high","critical"].map(s => ({ value: s, label: s }))}
                placeholder="Priority" searchPlaceholder="Search..." />
            </div>
            <div><Label>Subject *</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
            <div><Label>Describe the issue</Label><Textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessExternalService;
