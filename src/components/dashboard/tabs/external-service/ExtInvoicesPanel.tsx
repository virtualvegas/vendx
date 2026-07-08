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
import { Plus, Trash2, Send, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const ExtInvoicesPanel = () => {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState<any>({ client_id: "", notes: "", due_date: "" });
  const [itemForm, setItemForm] = useState<any>({ item_type: "labor", description: "", quantity: 1, unit_price: 0 });

  const { data: clients = [] } = useQuery({
    queryKey: ["ext-clients-min"],
    queryFn: async () => (await supabase.from("vendx_external_clients" as any).select("id,company_name,default_hourly_rate").order("company_name")).data || [],
  });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["ext-invoices", statusFilter],
    queryFn: async () => {
      let q = supabase.from("vendx_external_service_invoices" as any)
        .select("*, client:vendx_external_clients(company_name)")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["ext-invoice-items", open],
    queryFn: async () => {
      if (!open) return [];
      const { data } = await supabase.from("vendx_external_service_invoice_items" as any).select("*").eq("invoice_id", open).order("logged_at");
      return data || [];
    },
    enabled: !!open,
  });

  const currentInvoice = invoices.find((i: any) => i.id === open);

  const createInvoice = async () => {
    if (!newForm.client_id) { toast.error("Client required"); return; }
    const { data, error } = await supabase.from("vendx_external_service_invoices" as any).insert({
      client_id: newForm.client_id, notes: newForm.notes, due_date: newForm.due_date || null, status: "draft",
    }).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success(`Invoice ${(data as any).invoice_number} created`);
    setNewOpen(false); setNewForm({ client_id: "", notes: "", due_date: "" });
    qc.invalidateQueries({ queryKey: ["ext-invoices"] });
  };

  const addItem = async () => {
    if (!open || !itemForm.description) { toast.error("Description required"); return; }
    const { error } = await supabase.from("vendx_external_service_invoice_items" as any).insert({
      invoice_id: open, ...itemForm,
      quantity: parseFloat(itemForm.quantity) || 0, unit_price: parseFloat(itemForm.unit_price) || 0,
    });
    if (error) { toast.error(error.message); return; }
    setItemForm({ item_type: "labor", description: "", quantity: 1, unit_price: 0 });
    qc.invalidateQueries({ queryKey: ["ext-invoice-items"] });
    qc.invalidateQueries({ queryKey: ["ext-invoices"] });
  };

  const delItem = async (id: string) => {
    await supabase.from("vendx_external_service_invoice_items" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["ext-invoice-items"] });
    qc.invalidateQueries({ queryKey: ["ext-invoices"] });
  };

  const setStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    if (status === "paid") { patch.paid_at = new Date().toISOString(); patch.amount_paid = (currentInvoice as any)?.total; }
    const { error } = await supabase.from("vendx_external_service_invoices" as any).update(patch).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["ext-invoices"] }); }
  };

  const deleteInvoice = async (id: string, invoiceNumber: string) => {
    if (!confirm(`Delete invoice ${invoiceNumber}? This removes all line items and cannot be undone.`)) return;
    await supabase.from("vendx_external_service_invoice_items" as any).delete().eq("invoice_id", id);
    const { error } = await supabase.from("vendx_external_service_invoices" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Invoice deleted");
    setOpen(null);
    qc.invalidateQueries({ queryKey: ["ext-invoices"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="w-56">
          <SearchableSelect value={statusFilter} onValueChange={setStatusFilter}
            options={["all","draft","sent","paid","void"].map(s => ({ value: s, label: s }))}
            placeholder="Filter status" searchPlaceholder="Search..." />
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="w-4 h-4 mr-2" /> New Invoice</Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> :
        invoices.length === 0 ? <p className="text-muted-foreground">No invoices.</p> :
        <div className="grid gap-3">
          {invoices.map((i: any) => (
            <Card key={i.id} className="p-4 cursor-pointer hover:bg-muted/40" onClick={() => setOpen(i.id)}>
              <div className="flex justify-between items-start gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs">{i.invoice_number}</span>
                    <Badge>{i.status}</Badge>
                  </div>
                  <p className="font-semibold mt-1">{i.client?.company_name}</p>
                  <p className="text-xs text-muted-foreground">Issued: {i.issue_date} {i.due_date && `· Due: ${i.due_date}`}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">${Number(i.total).toFixed(2)}</p>
                  {Number(i.amount_paid) > 0 && <p className="text-xs text-green-500">Paid: ${Number(i.amount_paid).toFixed(2)}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      }

      {/* New invoice dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Client *</Label>
              <SearchableSelect value={newForm.client_id} onValueChange={v => setNewForm({ ...newForm, client_id: v })}
                options={clients.map((c: any) => ({ value: c.id, label: c.company_name }))} placeholder="Select client" searchPlaceholder="Search..." />
            </div>
            <div><Label>Due Date</Label><Input type="date" value={newForm.due_date} onChange={e => setNewForm({ ...newForm, due_date: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={newForm.notes} onChange={e => setNewForm({ ...newForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={createInvoice}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice details */}
      <Dialog open={!!open} onOpenChange={v => !v && setOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {currentInvoice && (() => { const ci = currentInvoice as any; return (
            <>
              <DialogHeader>
                <DialogTitle>{ci.invoice_number} — {ci.client?.company_name}</DialogTitle>
              </DialogHeader>
              <div className="flex gap-2 flex-wrap mb-3">
                <Badge>{ci.status}</Badge>
                {ci.status === "draft" && <Button size="sm" variant="outline" onClick={() => setStatus(ci.id, "sent")}><Send className="w-4 h-4 mr-1" /> Mark Sent</Button>}
                {ci.status === "sent" && <Button size="sm" variant="outline" onClick={() => setStatus(ci.id, "paid")}><CheckCircle className="w-4 h-4 mr-1" /> Mark Paid</Button>}
                {ci.status !== "void" && <Button size="sm" variant="outline" onClick={() => setStatus(ci.id, "void")}>Void</Button>}
                <Button size="sm" variant="destructive" onClick={() => deleteInvoice(ci.id, ci.invoice_number)}><Trash2 className="w-4 h-4 mr-1" /> Delete</Button>
              </div>

              <div className="space-y-2 mb-4">
                <h4 className="font-semibold text-sm">Line Items</h4>
                {items.length === 0 ? <p className="text-sm text-muted-foreground">No items yet.</p> :
                  <div className="space-y-1">
                    {items.map((it: any) => (
                      <div key={it.id} className="flex items-center justify-between gap-2 text-sm border rounded p-2">
                        <div className="flex-1">
                          <Badge variant="outline" className="mr-2">{it.item_type}</Badge>
                          {it.description}
                          <span className="text-muted-foreground"> · {it.quantity} × ${Number(it.unit_price).toFixed(2)}</span>
                        </div>
                        <div className="font-semibold">${Number(it.line_total).toFixed(2)}</div>
                        {ci.status === "draft" && (
                          <Button size="icon" variant="ghost" onClick={() => delItem(it.id)}><Trash2 className="w-4 h-4" /></Button>
                        )}
                      </div>
                    ))}
                  </div>
                }
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Total</span><span>${Number(ci.total).toFixed(2)}</span>
                </div>
              </div>

              {ci.status === "draft" && (
                <div className="border rounded p-3 grid gap-2 md:grid-cols-5">
                  <div className="md:col-span-1">
                    <Label>Type</Label>
                    <SearchableSelect value={itemForm.item_type} onValueChange={v => setItemForm({ ...itemForm, item_type: v })}
                      options={["labor","part","travel","other"].map(s => ({ value: s, label: s }))}
                      placeholder="Type" searchPlaceholder="Search..." />
                  </div>
                  <div className="md:col-span-2"><Label>Description</Label><Input value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} /></div>
                  <div><Label>Qty / Hrs</Label><Input type="number" step="0.25" value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: e.target.value })} /></div>
                  <div><Label>Unit Price</Label><Input type="number" step="0.01" value={itemForm.unit_price} onChange={e => setItemForm({ ...itemForm, unit_price: e.target.value })} /></div>
                  <div className="md:col-span-5"><Button size="sm" onClick={addItem}><Plus className="w-4 h-4 mr-1" /> Add Line</Button></div>
                </div>
              )}
            </>
          ); })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExtInvoicesPanel;
