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
import { Plus, Trash2, Pencil, Receipt, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/hooks/useAuditLog";
import { ReceiptUpload } from "./ReceiptUpload";
import { format } from "date-fns";

const CATEGORIES = ["inventory", "rent", "fuel", "software", "utilities", "repair", "salaries", "marketing", "insurance", "supplies", "shipping", "professional_services", "other"];
const STATUS_COLORS: Record<string, string> = { draft: "secondary", recorded: "default", reconciled: "default", disputed: "destructive", void: "outline" };

interface Split { id?: string; machine_id?: string; location_id?: string; category?: string; allocation_type: "amount" | "percent"; allocation_value: number; allocated_amount: number; notes?: string; }

export const ExpensesTab = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({
    expense_date: format(new Date(), "yyyy-MM-dd"), vendor: "", category: "inventory", subcategory: "", description: "",
    amount: 0, tax_amount: 0, is_tax_deductible: true, is_inventory_reinvestment: false,
    payment_method: "bank", paid_from_account_id: "", receipt_url: null, receipt_filename: null, status: "recorded", notes: "",
    external_reference: "",
  });
  const [splits, setSplits] = useState<Split[]>([]);
  const [filter, setFilter] = useState({ category: "all", status: "all", search: "" });

  const { data: accounts } = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: async () => (await supabase.from("finance_accounts" as any).select("id, name, account_type")).data || [],
  });

  const { data: machines } = useQuery({
    queryKey: ["fm-machines"],
    queryFn: async () => (await supabase.from("vendx_machines").select("id, name, machine_code").order("name")).data || [],
  });

  const { data: locations } = useQuery({
    queryKey: ["fm-locations"],
    queryFn: async () => (await supabase.from("locations").select("id, name, city").order("city")).data || [],
  });

  const { data: expenses } = useQuery({
    queryKey: ["finance-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_expenses" as any).select("*").order("expense_date", { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: existingSplits } = useQuery({
    queryKey: ["finance-expense-splits", editing?.id],
    enabled: !!editing?.id,
    queryFn: async () => (await supabase.from("finance_expense_splits" as any).select("*").eq("expense_id", editing.id)).data || [],
  });

  const filtered = useMemo(() => {
    return (expenses || []).filter((e: any) => {
      if (filter.category !== "all" && e.category !== filter.category) return false;
      if (filter.status !== "all" && e.status !== filter.status) return false;
      if (filter.search && !`${e.vendor} ${e.description}`.toLowerCase().includes(filter.search.toLowerCase())) return false;
      return true;
    });
  }, [expenses, filter]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const deductible = filtered.filter((e: any) => e.is_tax_deductible).reduce((s: number, e: any) => s + Number(e.amount), 0);
    const reinvestment = filtered.filter((e: any) => e.is_inventory_reinvestment).reduce((s: number, e: any) => s + Number(e.amount), 0);
    return { total, deductible, reinvestment };
  }, [filtered]);

  const resetForm = () => {
    setForm({ expense_date: format(new Date(), "yyyy-MM-dd"), vendor: "", category: "inventory", subcategory: "", description: "", amount: 0, tax_amount: 0, is_tax_deductible: true, is_inventory_reinvestment: false, payment_method: "bank", paid_from_account_id: "", receipt_url: null, receipt_filename: null, status: "recorded", notes: "", external_reference: "" });
    setSplits([]);
    setEditing(null);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = { ...form, paid_from_account_id: form.paid_from_account_id || null };
      let expenseId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("finance_expenses" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
        await supabase.from("finance_expense_splits" as any).delete().eq("expense_id", editing.id);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.from("finance_expenses" as any).insert({ ...payload, created_by: user?.id }).select().single();
        if (error) throw error;
        expenseId = (data as any).id;
        // Auto-create account txn if account selected
        if (form.paid_from_account_id) {
          await supabase.from("finance_account_transactions" as any).insert({
            account_id: form.paid_from_account_id, amount: -Math.abs(form.amount), direction: "out",
            category: form.category, description: `${form.vendor || ""} ${form.description || ""}`.trim() || "Expense",
            reference_type: "expense", reference_id: expenseId, created_by: user?.id,
          });
        }
        // Auto-create reinvestment record
        if (form.is_inventory_reinvestment) {
          await supabase.from("finance_inventory_reinvestments" as any).insert({
            reinvestment_date: form.expense_date, amount: form.amount,
            source_account_id: form.paid_from_account_id || null, expense_id: expenseId,
            description: form.description, created_by: user?.id,
          });
        }
      }
      // Insert splits
      if (splits.length > 0) {
        const splitRows = splits.map(s => ({
          expense_id: expenseId,
          machine_id: s.machine_id || null,
          location_id: s.location_id || null,
          category: s.category || null,
          allocation_type: s.allocation_type,
          allocation_value: s.allocation_value,
          allocated_amount: s.allocation_type === "percent" ? (form.amount * s.allocation_value / 100) : s.allocation_value,
          notes: s.notes || null,
        }));
        const { error } = await supabase.from("finance_expense_splits" as any).insert(splitRows);
        if (error) throw error;
      }
      await logAuditEvent({ action: editing ? "update" : "create", entity_type: "finance_expense", entity_id: expenseId, details: { amount: form.amount, category: form.category, vendor: form.vendor } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-expenses"] });
      qc.invalidateQueries({ queryKey: ["finance-accounts"] });
      qc.invalidateQueries({ queryKey: ["finance-reinvestments"] });
      toast({ title: editing ? "Expense updated" : "Expense recorded" });
      setOpen(false); resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_expenses" as any).delete().eq("id", id);
      if (error) throw error;
      await logAuditEvent({ action: "delete", entity_type: "finance_expense", entity_id: id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-expenses"] }); toast({ title: "Deleted" }); },
  });

  const splitTotal = splits.reduce((s, x) => s + (x.allocation_type === "percent" ? (form.amount * x.allocation_value / 100) : x.allocation_value), 0);
  const splitRemaining = Number(form.amount) - splitTotal;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total (filtered)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${stats.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Tax Deductible</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">${stats.deductible.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Inventory Reinvest</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${stats.reinvestment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Expenses</CardTitle>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Expense</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Edit Expense" : "Record Expense"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Date</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
                  <div><Label>Vendor</Label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Subcategory</Label><Input value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} /></div>
                </div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                  <div><Label>Tax Paid</Label><Input type="number" step="0.01" value={form.tax_amount} onChange={(e) => setForm({ ...form, tax_amount: Number(e.target.value) })} /></div>
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["draft", "recorded", "reconciled", "disputed", "void"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Transaction # / Invoice / Receipt #</Label>
                  <Input placeholder="Used to detect duplicates per vendor" value={form.external_reference} onChange={(e) => setForm({ ...form, external_reference: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Payment Method</Label>
                    <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["cash", "bank", "credit_card", "check", "other"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Paid From Account</Label>
                    <Select value={form.paid_from_account_id || "none"} onValueChange={(v) => setForm({ ...form, paid_from_account_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {(accounts || []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2"><Switch checked={form.is_tax_deductible} onCheckedChange={(v) => setForm({ ...form, is_tax_deductible: v })} /><Label>Tax deductible</Label></div>
                  <div className="flex items-center gap-2"><Switch checked={form.is_inventory_reinvestment} onCheckedChange={(v) => setForm({ ...form, is_inventory_reinvestment: v })} /><Label>Inventory reinvestment</Label></div>
                </div>
                <ReceiptUpload value={form.receipt_url} filename={form.receipt_filename} onChange={(url, fn) => setForm({ ...form, receipt_url: url, receipt_filename: fn })} />
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>

                {/* Splits */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Splits across machines/locations (double-entry)</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSplits([...splits, { allocation_type: "amount", allocation_value: 0, allocated_amount: 0 }])}><Plus className="h-3 w-3 mr-1" />Add Split</Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Allocated: ${splitTotal.toFixed(2)} / ${Number(form.amount).toFixed(2)} • Remaining: <span className={splitRemaining < 0 ? "text-destructive" : ""}>${splitRemaining.toFixed(2)}</span></p>
                  {splits.map((s, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end mb-2 p-2 bg-muted/30 rounded">
                      <div className="col-span-3">
                        <Label className="text-xs">Machine</Label>
                        <Select value={s.machine_id || "none"} onValueChange={(v) => { const ns = [...splits]; ns[i].machine_id = v === "none" ? undefined : v; setSplits(ns); }}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent><SelectItem value="none">—</SelectItem>{(machines || []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs">Location</Label>
                        <Select value={s.location_id || "none"} onValueChange={(v) => { const ns = [...splits]; ns[i].location_id = v === "none" ? undefined : v; setSplits(ns); }}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent><SelectItem value="none">—</SelectItem>{(locations || []).map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name || l.city}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Type</Label>
                        <Select value={s.allocation_type} onValueChange={(v: any) => { const ns = [...splits]; ns[i].allocation_type = v; setSplits(ns); }}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="amount">$</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs">{s.allocation_type === "percent" ? "%" : "Amount"}</Label>
                        <Input className="h-8" type="number" step="0.01" value={s.allocation_value} onChange={(e) => { const ns = [...splits]; ns[i].allocation_value = Number(e.target.value); setSplits(ns); }} />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSplits(splits.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter><Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.amount}>{editing ? "Update" : "Record Expense"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-3 mb-3">
            <Input placeholder="Search vendor or description..." value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} />
            <Select value={filter.category} onValueChange={(v) => setFilter({ ...filter, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All categories</SelectItem>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All statuses</SelectItem>{["draft", "recorded", "reconciled", "disputed", "void"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Vendor</TableHead><TableHead>Category</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Tags</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>{format(new Date(e.expense_date), "MMM d, yy")}</TableCell>
                  <TableCell>{e.vendor || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                  <TableCell className="font-mono">${Number(e.amount).toFixed(2)}</TableCell>
                  <TableCell><Badge variant={STATUS_COLORS[e.status] as any}>{e.status}</Badge></TableCell>
                  <TableCell className="space-x-1">
                    {e.is_tax_deductible && <Badge variant="secondary" className="text-xs">Tax-Ded</Badge>}
                    {e.is_inventory_reinvestment && <Badge variant="secondary" className="text-xs">Reinvest</Badge>}
                    {e.receipt_url && <FileText className="h-3 w-3 inline" />}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(e); setForm({ ...e, paid_from_account_id: e.paid_from_account_id || "" }); setSplits((existingSplits as any) || []); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete?")) deleteMut.mutate(e.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No expenses</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
