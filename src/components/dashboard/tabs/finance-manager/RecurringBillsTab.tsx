import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Repeat, PlayCircle, Trash2 } from "lucide-react";
import { format, addDays, addWeeks, addMonths, addYears, differenceInDays } from "date-fns";

const FREQS = ["weekly", "biweekly", "monthly", "quarterly", "yearly"] as const;
const advance = (d: Date, f: string) => {
  switch (f) {
    case "weekly": return addWeeks(d, 1);
    case "biweekly": return addWeeks(d, 2);
    case "quarterly": return addMonths(d, 3);
    case "yearly": return addYears(d, 1);
    default: return addMonths(d, 1);
  }
};

export const RecurringBillsTab = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vendor: "", category: "operating", amount: 0, frequency: "monthly",
    next_due_date: format(new Date(), "yyyy-MM-dd"), reminder_days_before: 3,
    auto_create_bill: true, description: "",
  });

  const list = useQuery({
    queryKey: ["recurring-bills"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_recurring_bills" as any).select("*").order("next_due_date");
      return (data || []) as any[];
    },
  });

  const create = async () => {
    if (!form.vendor || !form.amount) return toast({ title: "Vendor and amount required", variant: "destructive" });
    const { error } = await supabase.from("finance_recurring_bills" as any).insert({ ...form, is_active: true });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Recurring bill created" });
    setOpen(false);
    setForm({ vendor: "", category: "operating", amount: 0, frequency: "monthly", next_due_date: format(new Date(), "yyyy-MM-dd"), reminder_days_before: 3, auto_create_bill: true, description: "" });
    qc.invalidateQueries({ queryKey: ["recurring-bills"] });
  };

  const generateNow = async (r: any) => {
    const { error } = await supabase.from("finance_ap_bills" as any).insert({
      vendor: r.vendor, amount: r.amount, category: r.category,
      description: r.description || `Recurring: ${r.vendor}`,
      bill_date: format(new Date(), "yyyy-MM-dd"),
      due_date: r.next_due_date, status: "open",
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    const nextDue = format(advance(new Date(r.next_due_date), r.frequency), "yyyy-MM-dd");
    await supabase.from("finance_recurring_bills" as any).update({ next_due_date: nextDue }).eq("id", r.id);
    toast({ title: "Bill generated and next cycle rolled" });
    qc.invalidateQueries({ queryKey: ["recurring-bills"] });
    qc.invalidateQueries({ queryKey: ["ap-bills"] });
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("finance_recurring_bills" as any).update({ is_active: active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["recurring-bills"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this recurring bill template?")) return;
    await supabase.from("finance_recurring_bills" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["recurring-bills"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><Repeat className="h-5 w-5" />Recurring Bills</h2>
          <p className="text-sm text-muted-foreground">Templates that auto-generate AP bills on schedule.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Template</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Recurring Bill</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Vendor *</Label><Input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Amount *</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                <div>
                  <Label>Frequency</Label>
                  <Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FREQS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Next Due</Label><Input type="date" value={form.next_due_date} onChange={e => setForm({ ...form, next_due_date: e.target.value })} /></div>
                <div><Label>Remind (days before)</Label><Input type="number" value={form.reminder_days_before} onChange={e => setForm({ ...form, reminder_days_before: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.auto_create_bill} onCheckedChange={v => setForm({ ...form, auto_create_bill: v })} /><Label>Auto-create bills</Label></div>
              <Button onClick={create} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Templates</CardTitle></CardHeader>
        <CardContent>
          {list.isLoading ? <Loader2 className="animate-spin" /> :
            !list.data?.length ? <p className="text-sm text-muted-foreground">No recurring bills configured.</p> :
              <table className="w-full text-sm">
                <thead className="border-b"><tr><th className="text-left py-1">Vendor</th><th className="text-left">Frequency</th><th className="text-left">Next Due</th><th className="text-right">Amount</th><th className="text-center">Active</th><th></th></tr></thead>
                <tbody>
                  {list.data.map((r: any) => {
                    const days = differenceInDays(new Date(r.next_due_date), new Date());
                    const soon = days <= (r.reminder_days_before || 3);
                    return (
                      <tr key={r.id} className="border-b border-border/30">
                        <td className="py-1">
                          <div className="font-medium">{r.vendor}</div>
                          <div className="text-xs text-muted-foreground">{r.category}</div>
                        </td>
                        <td className="capitalize">{r.frequency}</td>
                        <td>
                          {format(new Date(r.next_due_date), "PP")}
                          {soon && <Badge variant={days < 0 ? "destructive" : "secondary"} className="ml-2 text-xs">{days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`}</Badge>}
                        </td>
                        <td className="text-right">${Number(r.amount).toLocaleString()}</td>
                        <td className="text-center"><Switch checked={r.is_active} onCheckedChange={v => toggle(r.id, v)} /></td>
                        <td className="flex justify-end gap-1 py-1">
                          <Button size="sm" variant="ghost" title="Generate bill now" onClick={() => generateNow(r)}><PlayCircle className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>}
        </CardContent>
      </Card>
    </div>
  );
};
