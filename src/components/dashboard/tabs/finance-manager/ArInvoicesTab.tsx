import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, DollarSign } from "lucide-react";
import { format, differenceInDays } from "date-fns";

export const ArInvoicesTab = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<any>(null);
  const [form, setForm] = useState({ customer_name: "", customer_email: "", invoice_date: format(new Date(), "yyyy-MM-dd"), due_date: format(new Date(Date.now() + 30 * 864e5), "yyyy-MM-dd"), description: "", amount: 0 });
  const [payAmt, setPayAmt] = useState(0);

  const invoices = useQuery({
    queryKey: ["ar-invoices"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_ar_invoices" as any).select("*").order("due_date");
      return (data || []) as any[];
    },
  });

  const create = async () => {
    if (!form.customer_name || !form.amount) return toast({ title: "Customer and amount required", variant: "destructive" });
    const { data: inv, error } = await supabase.from("finance_ar_invoices" as any).insert({
      customer_name: form.customer_name, customer_email: form.customer_email || null,
      invoice_date: form.invoice_date, due_date: form.due_date, status: "sent",
    }).select().single();
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await supabase.from("finance_ar_invoice_items" as any).insert({
      invoice_id: (inv as any).id, description: form.description || "Service", quantity: 1, unit_price: form.amount, line_total: form.amount,
    });
    toast({ title: "Invoice created" });
    setOpen(false);
    setForm({ customer_name: "", customer_email: "", invoice_date: format(new Date(), "yyyy-MM-dd"), due_date: format(new Date(Date.now() + 30 * 864e5), "yyyy-MM-dd"), description: "", amount: 0 });
    qc.invalidateQueries({ queryKey: ["ar-invoices"] });
  };

  const recordPayment = async () => {
    if (!payOpen || payAmt <= 0) return;
    const { error } = await supabase.from("finance_ar_invoice_payments" as any).insert({
      invoice_id: payOpen.id, amount: payAmt, payment_date: format(new Date(), "yyyy-MM-dd"),
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Payment recorded" });
    setPayOpen(null); setPayAmt(0);
    qc.invalidateQueries({ queryKey: ["ar-invoices"] });
  };

  const aging = (dueDate: string) => {
    const days = differenceInDays(new Date(dueDate), new Date());
    if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: "destructive" as const };
    if (days <= 7) return { label: `${days}d`, cls: "secondary" as const };
    return { label: `${days}d`, cls: "outline" as const };
  };

  const totalOwed = (invoices.data || []).reduce((s, i: any) => s + (Number(i.total) - Number(i.amount_paid || 0)), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><div className="text-sm text-muted-foreground">Total receivable</div><div className="text-2xl font-bold text-green-500">${totalOwed.toLocaleString()}</div></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Invoice</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New AR Invoice</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Customer *</Label><Input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Invoice Date</Label><Input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} /></div>
                <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Amount *</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></div>
              <Button onClick={create} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Accounts Receivable</CardTitle></CardHeader>
        <CardContent>
          {invoices.isLoading ? <Loader2 className="animate-spin" /> :
            !invoices.data?.length ? <p className="text-sm text-muted-foreground">No invoices.</p> :
              <table className="w-full text-sm">
                <thead className="border-b"><tr><th className="text-left py-1">Invoice #</th><th className="text-left">Customer</th><th className="text-left">Due</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-center">Status</th><th></th></tr></thead>
                <tbody>
                  {invoices.data.map((inv: any) => {
                    const a = aging(inv.due_date);
                    const remaining = Number(inv.total) - Number(inv.amount_paid || 0);
                    return (
                      <tr key={inv.id} className="border-b border-border/30">
                        <td className="py-1 font-mono text-xs">{inv.invoice_number}</td>
                        <td>{inv.customer_name}</td>
                        <td>{format(new Date(inv.due_date), "PP")} <Badge variant={a.cls} className="ml-1 text-xs">{a.label}</Badge></td>
                        <td className="text-right">${Number(inv.total).toLocaleString()}</td>
                        <td className="text-right">${Number(inv.amount_paid || 0).toLocaleString()}</td>
                        <td className="text-center"><Badge variant={inv.status === "paid" ? "default" : "secondary"}>{inv.status}</Badge></td>
                        <td>{remaining > 0 && <Button size="sm" variant="ghost" onClick={() => { setPayOpen(inv); setPayAmt(remaining); }}><DollarSign className="h-4 w-4" /></Button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>}
        </CardContent>
      </Card>

      <Dialog open={!!payOpen} onOpenChange={o => !o && setPayOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment — {payOpen?.customer_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Amount</Label><Input type="number" step="0.01" value={payAmt} onChange={e => setPayAmt(Number(e.target.value))} /></div>
            <Button onClick={recordPayment} className="w-full">Record Payment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
