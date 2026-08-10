import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Send, CheckCircle, ExternalLink, DollarSign, FileText, Save } from "lucide-react";
import { toast } from "sonner";

interface Props {
  requestId: string;
  clientId?: string | null;
  quotedPrice?: number | string | null;
  requestNumber?: string;
}

/**
 * Invoicing for a custom arcade build — reuses the external-service invoice tables
 * so builds get the same line items, partial payments, PayPal links and finance sync.
 */
const CustomBuildInvoices = ({ requestId, clientId, quotedPrice, requestNumber }: Props) => {
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newForm, setNewForm] = useState<any>({ client_id: clientId || "", due_date: "", paypal_invoice_url: "", notes: "" });
  const [itemForm, setItemForm] = useState<any>({ item_type: "other", description: "", quantity: 1, unit_price: 0 });
  const [paypalUrl, setPaypalUrl] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payAmt, setPayAmt] = useState(0);

  const { data: clients = [] } = useQuery({
    queryKey: ["ext-clients-min"],
    queryFn: async () =>
      (await supabase.from("vendx_external_clients" as any).select("id,company_name,contact_name").order("company_name")).data || [],
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["custom-build-invoices", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_external_service_invoices" as any)
        .select("*, client:vendx_external_clients(company_name,contact_name)")
        .eq("custom_arcade_request_id", requestId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!requestId,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["custom-build-invoice-items", openId],
    queryFn: async () => {
      if (!openId) return [];
      const { data } = await supabase
        .from("vendx_external_service_invoice_items" as any)
        .select("*")
        .eq("invoice_id", openId)
        .order("logged_at");
      return data || [];
    },
    enabled: !!openId,
  });

  const current: any = invoices.find((i: any) => i.id === openId);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["custom-build-invoices", requestId] });
    qc.invalidateQueries({ queryKey: ["custom-build-invoice-items"] });
    qc.invalidateQueries({ queryKey: ["ext-invoices"] });
  };

  const createInvoice = async () => {
    const cid = newForm.client_id || clientId;
    if (!cid) return toast.error("Link a client account first");
    const { data, error } = await supabase
      .from("vendx_external_service_invoices" as any)
      .insert({
        client_id: cid,
        custom_arcade_request_id: requestId,
        due_date: newForm.due_date || null,
        paypal_invoice_url: newForm.paypal_invoice_url || null,
        notes: newForm.notes || `Custom arcade build ${requestNumber || ""}`.trim(),
        status: "draft",
      })
      .select()
      .single();
    if (error) return toast.error(error.message);

    if (newForm.seed_quote && Number(quotedPrice) > 0) {
      await supabase.from("vendx_external_service_invoice_items" as any).insert({
        invoice_id: (data as any).id,
        item_type: "other",
        description: `Custom arcade build ${requestNumber || ""}`.trim(),
        quantity: 1,
        unit_price: Number(quotedPrice),
      });
    }
    toast.success(`Invoice ${(data as any).invoice_number} created`);
    setNewOpen(false);
    setNewForm({ client_id: clientId || "", due_date: "", paypal_invoice_url: "", notes: "" });
    refresh();
  };

  const addItem = async () => {
    if (!openId || !itemForm.description) return toast.error("Description required");
    const { error } = await supabase.from("vendx_external_service_invoice_items" as any).insert({
      invoice_id: openId,
      ...itemForm,
      quantity: parseFloat(itemForm.quantity) || 0,
      unit_price: parseFloat(itemForm.unit_price) || 0,
    });
    if (error) return toast.error(error.message);
    setItemForm({ item_type: "other", description: "", quantity: 1, unit_price: 0 });
    refresh();
  };

  const delItem = async (id: string) => {
    await supabase.from("vendx_external_service_invoice_items" as any).delete().eq("id", id);
    refresh();
  };

  const setStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    if (status === "paid") { patch.paid_at = new Date().toISOString(); patch.amount_paid = current?.total; }
    const { error } = await supabase.from("vendx_external_service_invoices" as any).update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    refresh();
  };

  const savePaypalUrl = async (id: string) => {
    const { error } = await supabase.from("vendx_external_service_invoices" as any).update({ paypal_invoice_url: paypalUrl || null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("PayPal link saved");
    refresh();
  };

  const recordPayment = async () => {
    if (!openId || payAmt <= 0) return toast.error("Enter a valid amount");
    const total = Number(current?.total || 0);
    const prev = Number(current?.amount_paid || 0);
    const newPaid = Math.min(total, prev + payAmt);
    const patch: any = { amount_paid: newPaid };
    if (newPaid >= total && total > 0) { patch.status = "paid"; patch.paid_at = new Date().toISOString(); }
    else if (current?.status === "draft") { patch.status = "sent"; patch.sent_at = new Date().toISOString(); }
    const { error } = await supabase.from("vendx_external_service_invoices" as any).update(patch).eq("id", openId);
    if (error) return toast.error(error.message);
    toast.success(newPaid >= total ? "Invoice fully paid" : `Recorded $${payAmt.toFixed(2)}`);
    setPayOpen(false); setPayAmt(0);
    refresh();
  };

  const deleteInvoice = async (id: string, num: string) => {
    if (!confirm(`Delete invoice ${num}? This removes all line items.`)) return;
    await supabase.from("vendx_external_service_invoice_items" as any).delete().eq("invoice_id", id);
    const { error } = await supabase.from("vendx_external_service_invoices" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invoice deleted");
    setOpenId(null);
    refresh();
  };

  const billed = invoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  const paid = invoices.reduce((s: number, i: any) => s + Number(i.amount_paid || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-semibold text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Invoices</h4>
        <Button size="sm" onClick={() => { setNewForm({ client_id: clientId || "", due_date: "", paypal_invoice_url: "", notes: "", seed_quote: true }); setNewOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> New Invoice
        </Button>
      </div>

      {invoices.length > 0 && (
        <div className="flex flex-wrap gap-4 text-xs bg-muted/40 rounded p-2">
          <span>Billed: <b>${billed.toFixed(2)}</b></span>
          <span className="text-green-500">Paid: <b>${paid.toFixed(2)}</b></span>
          <span>Balance: <b>${(billed - paid).toFixed(2)}</b></span>
        </div>
      )}

      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices for this build yet.</p>
      ) : (
        <div className="space-y-2">
          {invoices.map((i: any) => (
            <Card key={i.id} className="p-3 cursor-pointer hover:bg-muted/40" onClick={() => { setOpenId(i.id); setPaypalUrl(i.paypal_invoice_url || ""); }}>
              <div className="flex justify-between items-start gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs">{i.invoice_number}</span>
                    <Badge className="capitalize">{i.status}</Badge>
                    {i.paypal_invoice_url && <Badge variant="outline" className="text-[10px]">PayPal link</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {i.client?.company_name || i.client?.contact_name} · Issued {i.issue_date}{i.due_date ? ` · Due ${i.due_date}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">${Number(i.total).toFixed(2)}</p>
                  {Number(i.amount_paid) > 0 && <p className="text-[11px] text-green-500">Paid ${Number(i.amount_paid).toFixed(2)}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New invoice */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Build Invoice</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Client *</Label>
              <SearchableSelect
                value={newForm.client_id}
                onValueChange={(v) => setNewForm({ ...newForm, client_id: v })}
                options={clients.map((c: any) => ({ value: c.id, label: c.company_name || c.contact_name || "Residential Client" }))}
                placeholder="Select client" searchPlaceholder="Search clients..."
              />
            </div>
            <div><Label>Due date</Label><Input type="date" value={newForm.due_date} onChange={(e) => setNewForm({ ...newForm, due_date: e.target.value })} /></div>
            <div>
              <Label>PayPal invoice link (optional)</Label>
              <Input placeholder="https://www.paypal.com/invoice/..." value={newForm.paypal_invoice_url} onChange={(e) => setNewForm({ ...newForm, paypal_invoice_url: e.target.value })} />
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={newForm.notes} onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })} /></div>
            {Number(quotedPrice) > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!newForm.seed_quote} onChange={(e) => setNewForm({ ...newForm, seed_quote: e.target.checked })} />
                Pre-fill a line item with the quoted price (${Number(quotedPrice).toFixed(2)})
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={createInvoice}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice detail */}
      <Dialog open={!!openId} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {current && (
            <>
              <DialogHeader>
                <DialogTitle>{current.invoice_number} — {current.client?.company_name || current.client?.contact_name}</DialogTitle>
              </DialogHeader>
              <div className="flex gap-2 flex-wrap mb-3">
                <Badge className="capitalize">{current.status}</Badge>
                {current.status === "draft" && <Button size="sm" variant="outline" onClick={() => setStatus(current.id, "sent")}><Send className="w-4 h-4 mr-1" /> Mark Sent</Button>}
                {(current.status === "sent" || current.status === "draft") && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { setPayAmt(Number(current.total) - Number(current.amount_paid || 0)); setPayOpen(true); }}>
                      <DollarSign className="w-4 h-4 mr-1" /> Record Payment
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus(current.id, "paid")}><CheckCircle className="w-4 h-4 mr-1" /> Mark Fully Paid</Button>
                  </>
                )}
                {current.status !== "void" && <Button size="sm" variant="outline" onClick={() => setStatus(current.id, "void")}>Void</Button>}
                <Button size="sm" variant="destructive" onClick={() => deleteInvoice(current.id, current.invoice_number)}><Trash2 className="w-4 h-4 mr-1" /> Delete</Button>
              </div>

              <div className="border rounded p-3 mb-3 space-y-2">
                <Label className="text-xs font-semibold">PayPal Invoice Link</Label>
                <div className="flex gap-2 flex-wrap">
                  <Input className="flex-1 min-w-[240px]" placeholder="https://www.paypal.com/invoice/..." value={paypalUrl} onChange={(e) => setPaypalUrl(e.target.value)} />
                  <Button size="sm" variant="outline" onClick={() => savePaypalUrl(current.id)}><Save className="w-4 h-4 mr-1" /> Save</Button>
                  {current.paypal_invoice_url && (
                    <Button size="sm" variant="outline" onClick={() => window.open(current.paypal_invoice_url, "_blank")}><ExternalLink className="w-4 h-4 mr-1" /> Open</Button>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <h4 className="font-semibold text-sm">Line Items</h4>
                {items.length === 0 ? <p className="text-sm text-muted-foreground">No items yet.</p> : (
                  <div className="space-y-1">
                    {items.map((it: any) => (
                      <div key={it.id} className="flex items-center justify-between gap-2 text-sm border rounded p-2">
                        <div className="flex-1">
                          <Badge variant="outline" className="mr-2">{it.item_type}</Badge>
                          {it.description}
                          <span className="text-muted-foreground"> · {it.quantity} × ${Number(it.unit_price).toFixed(2)}</span>
                        </div>
                        <div className="font-semibold">${Number(it.line_total).toFixed(2)}</div>
                        {current.status === "draft" && (
                          <Button size="icon" variant="ghost" onClick={() => delItem(it.id)}><Trash2 className="w-4 h-4" /></Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Total</span><span>${Number(current.total).toFixed(2)}</span>
                </div>
              </div>

              {current.status === "draft" && (
                <div className="border rounded p-3 grid gap-2 md:grid-cols-5">
                  <div>
                    <Label>Type</Label>
                    <SearchableSelect value={itemForm.item_type} onValueChange={(v) => setItemForm({ ...itemForm, item_type: v })}
                      options={["labor", "part", "travel", "other"].map((s) => ({ value: s, label: s }))}
                      placeholder="Type" searchPlaceholder="Search..." />
                  </div>
                  <div className="md:col-span-2"><Label>Description</Label><Input value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} /></div>
                  <div><Label>Qty</Label><Input type="number" step="0.25" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} /></div>
                  <div><Label>Unit Price</Label><Input type="number" step="0.01" value={itemForm.unit_price} onChange={(e) => setItemForm({ ...itemForm, unit_price: e.target.value })} /></div>
                  <div className="md:col-span-5"><Button size="sm" onClick={addItem}><Plus className="w-4 h-4 mr-1" /> Add Line</Button></div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          {current && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Total ${Number(current.total).toFixed(2)} · Paid ${Number(current.amount_paid || 0).toFixed(2)} ·
                Balance ${(Number(current.total) - Number(current.amount_paid || 0)).toFixed(2)}
              </div>
              <div>
                <Label>Amount received</Label>
                <Input type="number" step="0.01" min="0" value={payAmt} onChange={(e) => setPayAmt(Number(e.target.value))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={recordPayment}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomBuildInvoices;
