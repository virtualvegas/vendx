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
import { Plus, Trash2, Download, ArrowDownToLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/hooks/useAuditLog";
import { ReceiptUpload } from "./ReceiptUpload";
import { format, subDays } from "date-fns";

const CATEGORIES = [
  "machine_revenue", "store_sales", "event_rental", "ad_revenue",
  "subscription", "deposit", "refund_received", "transfer_in",
  "interest", "other",
];

export const IncomeTab = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filter, setFilter] = useState({ category: "all", search: "" });
  const [form, setForm] = useState<any>({
    income_date: format(new Date(), "yyyy-MM-dd"),
    source: "", category: "deposit", subcategory: "", description: "",
    amount: 0, tax_collected: 0, is_taxable: true,
    payment_method: "bank", deposited_to_account_id: "",
    receipt_url: null, receipt_filename: null, status: "recorded", notes: "",
    external_reference: "",
  });
  const [importForm, setImportForm] = useState({
    from_date: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    to_date: format(new Date(), "yyyy-MM-dd"),
    account_id: "",
  });

  const { data: accounts } = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: async (): Promise<any[]> => ((await supabase.from("finance_accounts" as any).select("id, name, account_type")).data as any) || [],
  });

  const { data: income } = useQuery({
    queryKey: ["finance-income"],
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase.from("finance_income" as any).select("*").order("income_date", { ascending: false }).limit(500);
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const filtered = useMemo(() => {
    return (income || []).filter((e: any) => {
      if (filter.category !== "all" && e.category !== filter.category) return false;
      if (filter.search && !`${e.source} ${e.description || ""}`.toLowerCase().includes(filter.search.toLowerCase())) return false;
      return true;
    });
  }, [income, filter]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const tax = filtered.reduce((s: number, e: any) => s + Number(e.tax_collected || 0), 0);
    const machineRev = filtered.filter((e: any) => e.category === "machine_revenue").reduce((s: number, e: any) => s + Number(e.amount), 0);
    return { total, tax, machineRev };
  }, [filtered]);

  const resetForm = () => setForm({
    income_date: format(new Date(), "yyyy-MM-dd"), source: "", category: "deposit", subcategory: "",
    description: "", amount: 0, tax_collected: 0, is_taxable: true, payment_method: "bank",
    deposited_to_account_id: "", receipt_url: null, receipt_filename: null, status: "recorded", notes: "",
    external_reference: "",
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...form, deposited_to_account_id: form.deposited_to_account_id || null, created_by: user?.id };
      const { data, error } = await supabase.from("finance_income" as any).insert(payload).select().single();
      if (error) throw error;
      await logAuditEvent({ action: "create", entity_type: "finance_income", entity_id: (data as any).id, details: { amount: form.amount, category: form.category } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-income"] });
      qc.invalidateQueries({ queryKey: ["finance-accounts"] });
      toast({ title: "Income recorded" });
      setOpen(false); resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_income" as any).delete().eq("id", id);
      if (error) throw error;
      await logAuditEvent({ action: "delete", entity_type: "finance_income", entity_id: id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-income"] }); toast({ title: "Deleted" }); },
  });

  const importMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("import_machine_revenue_to_income" as any, {
        p_from_date: importForm.from_date,
        p_to_date: importForm.to_date,
        p_account_id: importForm.account_id || null,
      });
      if (error) throw error;
      const result = Array.isArray(data) ? (data as any)[0] : data;
      await logAuditEvent({ action: "import", entity_type: "finance_income", details: { count: result?.imported_count, total: result?.total_amount } });
      return result;
    },
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: ["finance-income"] });
      qc.invalidateQueries({ queryKey: ["finance-accounts"] });
      toast({ title: `Imported ${result?.imported_count || 0} entries`, description: `Total: $${Number(result?.total_amount || 0).toFixed(2)}` });
      setImportOpen(false);
    },
    onError: (e: any) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Income</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">${stats.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Machine Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${stats.machineRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Sales Tax Collected</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${stats.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle>Income & Deposits</CardTitle>
          <div className="flex gap-2">
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Pull from Machines</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Import Machine Revenue</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Imports machine sales into the income ledger. Duplicates are skipped automatically.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>From</Label><Input type="date" value={importForm.from_date} onChange={(e) => setImportForm({ ...importForm, from_date: e.target.value })} /></div>
                    <div><Label>To</Label><Input type="date" value={importForm.to_date} onChange={(e) => setImportForm({ ...importForm, to_date: e.target.value })} /></div>
                  </div>
                  <div><Label>Deposit to Account (optional)</Label>
                    <Select value={importForm.account_id || "none"} onValueChange={(v) => setImportForm({ ...importForm, account_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {(accounts || []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={() => importMut.mutate()} disabled={importMut.isPending}><ArrowDownToLine className="h-4 w-4 mr-2" />{importMut.isPending ? "Importing..." : "Import"}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />New Income</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Record Income / Deposit</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date</Label><Input type="date" value={form.income_date} onChange={(e) => setForm({ ...form, income_date: e.target.value })} /></div>
                    <div><Label>Source</Label><Input placeholder="Customer, machine, deposit ref" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                    <div><Label>Sales Tax Collected</Label><Input type="number" step="0.01" value={form.tax_collected} onChange={(e) => setForm({ ...form, tax_collected: Number(e.target.value) })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Payment Method</Label>
                      <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{["cash", "bank", "card", "stripe", "paypal", "machine", "other"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Deposit To Account</Label>
                      <Select value={form.deposited_to_account_id || "none"} onValueChange={(v) => setForm({ ...form, deposited_to_account_id: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {(accounts || []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2"><Switch checked={form.is_taxable} onCheckedChange={(v) => setForm({ ...form, is_taxable: v })} /><Label>Taxable income</Label></div>
                  <ReceiptUpload value={form.receipt_url} filename={form.receipt_filename} onChange={(url, fn) => setForm({ ...form, receipt_url: url, receipt_filename: fn })} />
                  <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
                </div>
                <DialogFooter><Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.amount}>Record Income</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 mb-3">
            <Input placeholder="Search source or description..." value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} />
            <Select value={filter.category} onValueChange={(v) => setFilter({ ...filter, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All categories</SelectItem>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Tax</TableHead><TableHead>Method</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{format(new Date(e.income_date), "MMM d, yy")}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{e.source}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{e.category.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="font-mono text-right text-green-600">+${Number(e.amount).toFixed(2)}</TableCell>
                  <TableCell className="font-mono text-right text-muted-foreground">{Number(e.tax_collected || 0) > 0 ? `$${Number(e.tax_collected).toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-xs">{e.payment_method || "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete?")) deleteMut.mutate(e.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No income recorded</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
