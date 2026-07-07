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

export const ApBillsTab = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<any>(null);
  const [form, setForm] = useState({ vendor: "", bill_number: "", bill_date: format(new Date(), "yyyy-MM-dd"), due_date: format(new Date(Date.now() + 30 * 864e5), "yyyy-MM-dd"), amount: 0, category: "operating", description: "" });
  const [payAmt, setPayAmt] = useState(0);

  const bills = useQuery({
    queryKey: ["ap-bills"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_ap_bills" as any).select("*").order("due_date");
      return (data || []) as any[];
    },
  });

  const create = async () => {
    if (!form.vendor || !form.amount) return toast({ title: "Vendor and amount required", variant: "destructive" });
    const { error } = await supabase.from("finance_ap_bills" as any).insert({ ...form, status: "open" });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Bill created" });
    setOpen(false); setForm({ vendor: "", bill_number: "", bill_date: format(new Date(), "yyyy-MM-dd"), due_date: format(new Date(Date.now() + 30 * 864e5), "yyyy-MM-dd"), amount: 0, category: "operating", description: "" });
    qc.invalidateQueries({ queryKey: ["ap-bills"] });
  };

  const recordPayment = async () => {
    if (!payOpen || payAmt <= 0) return;
    const { error } = await supabase.from("finance_ap_bill_payments" as any).insert({
      bill_id: payOpen.id, amount: payAmt, payment_date: format(new Date(), "yyyy-MM-dd"),
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Payment recorded" });
    setPayOpen(null); setPayAmt(0);
    qc.invalidateQueries({ queryKey: ["ap-bills"] });
  };

  const aging = (dueDate: string) => {
    const days = differenceInDays(new Date(dueDate), new Date());
    if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: "destructive" as const };
    if (days <= 7) return { label: `${days}d`, cls: "secondary" as const };
    return { label: `${days}d`, cls: "outline" as const };
  };

  const totalOwed = (bills.data || []).reduce((s, b: any) => s + (Number(b.amount) - Number(b.amount_paid || 0)), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><div className="text-sm text-muted-foreground">Total outstanding</div><div className="text-2xl font-bold text-red-500">${totalOwed.toLocaleString()}</div></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Bill</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New AP Bill</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Vendor *</Label><Input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Bill #</Label><Input value={form.bill_number} onChange={e => setForm({ ...form, bill_number: e.target.value })} /></div>
                <div><Label>Amount *</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Bill Date</Label><Input type="date" value={form.bill_date} onChange={e => setForm({ ...form, bill_date: e.target.value })} /></div>
                <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
              <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <Button onClick={create} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Accounts Payable</CardTitle></CardHeader>
        <CardContent>
          {bills.isLoading ? <Loader2 className="animate-spin" /> :
            !bills.data?.length ? <p className="text-sm text-muted-foreground">No bills.</p> :
              <table className="w-full text-sm">
                <thead className="border-b"><tr><th className="text-left py-1">Vendor</th><th className="text-left">Bill</th><th className="text-left">Due</th><th className="text-right">Amount</th><th className="text-right">Paid</th><th className="text-center">Status</th><th></th></tr></thead>
                <tbody>
                  {bills.data.map((b: any) => {
                    const a = aging(b.due_date);
                    const remaining = Number(b.amount) - Number(b.amount_paid || 0);
                    return (
                      <tr key={b.id} className="border-b border-border/30">
                        <td className="py-1">{b.vendor}</td>
                        <td>{b.bill_number || "—"}</td>
                        <td>{format(new Date(b.due_date), "PP")} <Badge variant={a.cls} className="ml-1 text-xs">{a.label}</Badge></td>
                        <td className="text-right">${Number(b.amount).toLocaleString()}</td>
                        <td className="text-right">${Number(b.amount_paid || 0).toLocaleString()}</td>
                        <td className="text-center"><Badge variant={b.status === "paid" ? "default" : "secondary"}>{b.status}</Badge></td>
                        <td>{remaining > 0 && <Button size="sm" variant="ghost" onClick={() => { setPayOpen(b); setPayAmt(remaining); }}><DollarSign className="h-4 w-4" /></Button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>}
        </CardContent>
      </Card>

      <Dialog open={!!payOpen} onOpenChange={o => !o && setPayOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment — {payOpen?.vendor}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Amount</Label><Input type="number" step="0.01" value={payAmt} onChange={e => setPayAmt(Number(e.target.value))} /></div>
            <Button onClick={recordPayment} className="w-full">Record Payment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
