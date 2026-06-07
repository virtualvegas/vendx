import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = {
  id: "" as string | undefined,
  company_name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  billing_address: "",
  billing_city: "",
  billing_state: "",
  billing_postal_code: "",
  billing_country: "",
  tax_id: "",
  default_hourly_rate: 125,
  default_payment_terms_days: 30,
  status: "active",
  notes: "",
};

const ExtClientsPanel = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["ext-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_external_clients" as any)
        .select("*")
        .order("company_name");
      if (error) throw error;
      return data || [];
    },
  });

  const save = async () => {
    if (!form.company_name?.trim()) { toast.error("Company name required"); return; }
    const payload = { ...form };
    delete payload.id;
    const { error } = form.id
      ? await supabase.from("vendx_external_clients" as any).update(payload).eq("id", form.id)
      : await supabase.from("vendx_external_clients" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Client updated" : "Client created");
    setOpen(false); setForm(empty);
    qc.invalidateQueries({ queryKey: ["ext-clients"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this client and all its sites/machines?")) return;
    const { error } = await supabase.from("vendx_external_clients" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["ext-clients"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setForm(empty); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Client
        </Button>
      </div>
      {isLoading ? <p className="text-muted-foreground">Loading...</p> :
        clients.length === 0 ? <p className="text-muted-foreground">No clients yet.</p> :
        <div className="grid gap-3">
          {clients.map((c: any) => (
            <Card key={c.id} className="p-4">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{c.company_name}</h3>
                    <Badge variant={c.status === "active" ? "default" : "outline"}>{c.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {c.contact_name} · {c.contact_email} · {c.contact_phone}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Rate: ${c.default_hourly_rate}/hr · Net {c.default_payment_terms_days} days
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => { setForm(c); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      }

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit" : "New"} Client</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2"><Label>Company Name *</Label><Input value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} /></div>
            <div><Label>Contact Name</Label><Input value={form.contact_name || ""} onChange={e => setForm({...form, contact_name: e.target.value})} /></div>
            <div><Label>Contact Email</Label><Input type="email" value={form.contact_email || ""} onChange={e => setForm({...form, contact_email: e.target.value})} /></div>
            <div><Label>Contact Phone</Label><Input value={form.contact_phone || ""} onChange={e => setForm({...form, contact_phone: e.target.value})} /></div>
            <div><Label>Tax ID</Label><Input value={form.tax_id || ""} onChange={e => setForm({...form, tax_id: e.target.value})} /></div>
            <div className="md:col-span-2"><Label>Billing Address</Label><Input value={form.billing_address || ""} onChange={e => setForm({...form, billing_address: e.target.value})} /></div>
            <div><Label>City</Label><Input value={form.billing_city || ""} onChange={e => setForm({...form, billing_city: e.target.value})} /></div>
            <div><Label>State</Label><Input value={form.billing_state || ""} onChange={e => setForm({...form, billing_state: e.target.value})} /></div>
            <div><Label>Postal Code</Label><Input value={form.billing_postal_code || ""} onChange={e => setForm({...form, billing_postal_code: e.target.value})} /></div>
            <div><Label>Country</Label><Input value={form.billing_country || ""} onChange={e => setForm({...form, billing_country: e.target.value})} /></div>
            <div><Label>Default Hourly Rate ($)</Label><Input type="number" step="0.01" value={form.default_hourly_rate} onChange={e => setForm({...form, default_hourly_rate: parseFloat(e.target.value) || 0})} /></div>
            <div><Label>Payment Terms (days)</Label><Input type="number" value={form.default_payment_terms_days} onChange={e => setForm({...form, default_payment_terms_days: parseInt(e.target.value) || 30})} /></div>
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

export default ExtClientsPanel;
