import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, CheckCircle2, AlertTriangle, Repeat, Pause, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/hooks/useAuditLog";
import { format, addDays, addMonths, addWeeks, addYears, differenceInDays, parseISO } from "date-fns";

const CYCLES = ["weekly", "monthly", "quarterly", "yearly", "custom"];
const CATEGORIES = ["software", "hosting", "insurance", "utility", "lease", "subscription_service", "other"];

const advanceDate = (d: string, cycle: string, customDays?: number) => {
  const date = parseISO(d);
  switch (cycle) {
    case "weekly": return format(addWeeks(date, 1), "yyyy-MM-dd");
    case "monthly": return format(addMonths(date, 1), "yyyy-MM-dd");
    case "quarterly": return format(addMonths(date, 3), "yyyy-MM-dd");
    case "yearly": return format(addYears(date, 1), "yyyy-MM-dd");
    case "custom": return format(addDays(date, customDays || 30), "yyyy-MM-dd");
    default: return d;
  }
};

const monthlyEquivalent = (amt: number, cycle: string, customDays?: number) => {
  switch (cycle) {
    case "weekly": return amt * 4.33;
    case "monthly": return amt;
    case "quarterly": return amt / 3;
    case "yearly": return amt / 12;
    case "custom": return (amt / (customDays || 30)) * 30;
    default: return amt;
  }
};

export const SubscriptionsTab = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({
    vendor_name: "", service_name: "", category: "software", amount: 0, currency: "USD",
    billing_cycle: "monthly", custom_interval_days: 30, billing_day: 1, next_due_date: format(new Date(), "yyyy-MM-dd"),
    auto_pay: false, paid_from_account_id: "", is_tax_deductible: true, reminder_days_before: 3,
    status: "active", cancellation_url: "", notes: "",
  });

  const { data: subs } = useQuery({
    queryKey: ["finance-subscriptions"],
    queryFn: async () => (await supabase.from("finance_subscriptions" as any).select("*").order("next_due_date")).data || [],
  });

  const { data: accounts } = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: async () => (await supabase.from("finance_accounts" as any).select("id, name")).data || [],
  });

  const stats = useMemo(() => {
    const active = (subs || []).filter((s: any) => s.status === "active");
    const monthlyTotal = active.reduce((sum: number, s: any) => sum + monthlyEquivalent(Number(s.amount), s.billing_cycle, s.custom_interval_days), 0);
    const yearlyTotal = monthlyTotal * 12;
    const dueSoon = active.filter((s: any) => differenceInDays(parseISO(s.next_due_date), new Date()) <= 7);
    const overdue = active.filter((s: any) => differenceInDays(parseISO(s.next_due_date), new Date()) < 0);
    return { count: active.length, monthlyTotal, yearlyTotal, dueSoon: dueSoon.length, overdue: overdue.length };
  }, [subs]);

  const resetForm = () => {
    setForm({ vendor_name: "", service_name: "", category: "software", amount: 0, currency: "USD", billing_cycle: "monthly", custom_interval_days: 30, billing_day: 1, next_due_date: format(new Date(), "yyyy-MM-dd"), auto_pay: false, paid_from_account_id: "", is_tax_deductible: true, reminder_days_before: 3, status: "active", cancellation_url: "", notes: "" });
    setEditing(null);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = { ...form, paid_from_account_id: form.paid_from_account_id || null };
      if (editing) {
        const { error } = await supabase.from("finance_subscriptions" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("finance_subscriptions" as any).insert(payload);
        if (error) throw error;
      }
      await logAuditEvent({ action: editing ? "update" : "create", entity_type: "finance_subscription", entity_id: editing?.id, details: { vendor: form.vendor_name, amount: form.amount } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-subscriptions"] }); toast({ title: editing ? "Updated" : "Subscription added" }); setOpen(false); resetForm(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_subscriptions" as any).delete().eq("id", id);
      if (error) throw error;
      await logAuditEvent({ action: "delete", entity_type: "finance_subscription", entity_id: id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-subscriptions"] }); toast({ title: "Deleted" }); },
  });

  const toggleStatusMut = useMutation({
    mutationFn: async ({ id, status }: any) => {
      const { error } = await supabase.from("finance_subscriptions" as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-subscriptions"] }),
  });

  const markPaidMut = useMutation({
    mutationFn: async ({ sub, accountId, amount }: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const today = format(new Date(), "yyyy-MM-dd");
      // Create expense
      const { data: exp, error: e1 } = await supabase.from("finance_expenses" as any).insert({
        expense_date: today, vendor: sub.vendor_name, category: sub.category || "software",
        description: `${sub.service_name || sub.vendor_name} subscription`, amount, payment_method: "bank",
        paid_from_account_id: accountId || sub.paid_from_account_id || null,
        is_tax_deductible: sub.is_tax_deductible, status: "recorded", created_by: user?.id,
      }).select().single();
      if (e1) throw e1;
      // Account txn
      if (accountId || sub.paid_from_account_id) {
        await supabase.from("finance_account_transactions" as any).insert({
          account_id: accountId || sub.paid_from_account_id, amount: -Math.abs(amount), direction: "out",
          category: sub.category, description: `Subscription: ${sub.vendor_name}`,
          reference_type: "subscription", reference_id: sub.id, created_by: user?.id,
        });
      }
      // Payment record
      await supabase.from("finance_subscription_payments" as any).insert({
        subscription_id: sub.id, payment_date: today, amount,
        paid_from_account_id: accountId || sub.paid_from_account_id || null,
        expense_id: (exp as any).id, created_by: user?.id,
      });
      // Advance next_due_date
      const newDue = advanceDate(sub.next_due_date, sub.billing_cycle, sub.custom_interval_days);
      await supabase.from("finance_subscriptions" as any).update({ last_paid_date: today, next_due_date: newDue }).eq("id", sub.id);
      await logAuditEvent({ action: "payment", entity_type: "finance_subscription", entity_id: sub.id, details: { amount, vendor: sub.vendor_name } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["finance-expenses"] });
      qc.invalidateQueries({ queryKey: ["finance-accounts"] });
      toast({ title: "Payment recorded" });
      setPayOpen(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Subscriptions</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.count}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Monthly Burn</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${stats.monthlyTotal.toFixed(2)}</p><p className="text-xs text-muted-foreground">${stats.yearlyTotal.toFixed(0)}/yr</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Due This Week</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{stats.dueSoon}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{stats.overdue}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recurring Subscriptions</CardTitle>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Subscription</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Edit Subscription" : "Add Subscription"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Vendor</Label><Input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} placeholder="Adobe, AWS, etc." /></div>
                  <div><Label>Service</Label><Input value={form.service_name} onChange={(e) => setForm({ ...form, service_name: e.target.value })} placeholder="Creative Cloud" /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                  <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} maxLength={3} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Billing Cycle</Label>
                    <Select value={form.billing_cycle} onValueChange={(v) => setForm({ ...form, billing_cycle: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CYCLES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {form.billing_cycle === "custom" && <div><Label>Every X days</Label><Input type="number" value={form.custom_interval_days} onChange={(e) => setForm({ ...form, custom_interval_days: Number(e.target.value) })} /></div>}
                  <div><Label>Next Due Date</Label><Input type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} /></div>
                </div>
                <div><Label>Paid From Account</Label>
                  <Select value={form.paid_from_account_id || "none"} onValueChange={(v) => setForm({ ...form, paid_from_account_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">None</SelectItem>{(accounts || []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Reminder days before due</Label><Input type="number" value={form.reminder_days_before} onChange={(e) => setForm({ ...form, reminder_days_before: Number(e.target.value) })} /></div>
                  <div><Label>Cancel URL</Label><Input value={form.cancellation_url} onChange={(e) => setForm({ ...form, cancellation_url: e.target.value })} placeholder="https://..." /></div>
                </div>
                <div className="flex gap-4"><div className="flex items-center gap-2"><Switch checked={form.auto_pay} onCheckedChange={(v) => setForm({ ...form, auto_pay: v })} /><Label>Auto-pay enabled</Label></div>
                  <div className="flex items-center gap-2"><Switch checked={form.is_tax_deductible} onCheckedChange={(v) => setForm({ ...form, is_tax_deductible: v })} /><Label>Tax deductible</Label></div></div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.vendor_name || !form.amount}>{editing ? "Update" : "Add"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>Cycle</TableHead><TableHead>Amount</TableHead><TableHead>Next Due</TableHead><TableHead>Status</TableHead><TableHead className="w-40"></TableHead></TableRow></TableHeader>
            <TableBody>
              {(subs || []).map((s: any) => {
                const days = differenceInDays(parseISO(s.next_due_date), new Date());
                const overdue = days < 0;
                const dueSoon = days >= 0 && days <= s.reminder_days_before;
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium">{s.vendor_name}</p>
                      <p className="text-xs text-muted-foreground">{s.service_name}</p>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize"><Repeat className="h-3 w-3 mr-1" />{s.billing_cycle}</Badge></TableCell>
                    <TableCell className="font-mono">${Number(s.amount).toFixed(2)}<p className="text-xs text-muted-foreground">${monthlyEquivalent(Number(s.amount), s.billing_cycle, s.custom_interval_days).toFixed(2)}/mo</p></TableCell>
                    <TableCell>
                      <p>{format(parseISO(s.next_due_date), "MMM d, yyyy")}</p>
                      {s.status === "active" && (
                        <p className={`text-xs ${overdue ? "text-destructive" : dueSoon ? "text-amber-600" : "text-muted-foreground"}`}>
                          {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `in ${days}d`}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                      {s.auto_pay && <Badge variant="outline" className="text-xs ml-1">Auto</Badge>}
                    </TableCell>
                    <TableCell className="space-x-1">
                      {s.status === "active" && (overdue || dueSoon) && (
                        <Button size="sm" variant="default" onClick={() => setPayOpen({ sub: s, amount: s.amount, accountId: s.paid_from_account_id || "" })}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />Pay
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => toggleStatusMut.mutate({ id: s.id, status: s.status === "active" ? "paused" : "active" })}>
                        {s.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setForm({ ...s, paid_from_account_id: s.paid_from_account_id || "" }); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete?")) deleteMut.mutate(s.id); }}><Trash2 className="h-3 w-3" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!subs || subs.length === 0) && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No subscriptions</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!payOpen} onOpenChange={(v) => !v && setPayOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark {payOpen?.sub?.vendor_name} as Paid</DialogTitle></DialogHeader>
          {payOpen && (
            <div className="space-y-3">
              <div><Label>Amount</Label><Input type="number" step="0.01" value={payOpen.amount} onChange={(e) => setPayOpen({ ...payOpen, amount: Number(e.target.value) })} /></div>
              <div><Label>From Account</Label>
                <Select value={payOpen.accountId || "none"} onValueChange={(v) => setPayOpen({ ...payOpen, accountId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None (just record expense)</SelectItem>{(accounts || []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">This creates an expense, debits the account, and advances the next due date.</p>
            </div>
          )}
          <DialogFooter><Button onClick={() => markPaidMut.mutate(payOpen)} disabled={markPaidMut.isPending}>Confirm Payment</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
