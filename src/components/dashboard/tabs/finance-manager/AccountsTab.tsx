import { useState } from "react";
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
import { Plus, Wallet, Building2, PiggyBank, CreditCard, ArrowLeftRight, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/hooks/useAuditLog";

const ACCOUNT_ICONS: Record<string, any> = {
  cash_vault: Wallet,
  bank_checking: Building2,
  bank_savings: PiggyBank,
  tax_savings: PiggyBank,
  credit_card: CreditCard,
  other: Wallet,
};

const ACCOUNT_LABELS: Record<string, string> = {
  cash_vault: "Cash Vault",
  bank_checking: "Bank Checking",
  bank_savings: "Bank Savings",
  tax_savings: "Tax Savings",
  credit_card: "Credit Card",
  other: "Other",
};

export const AccountsTab = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: "", account_type: "bank_checking", opening_balance: 0, current_balance: 0, institution: "", account_number_last4: "", description: "", is_primary: false });
  const [transfer, setTransfer] = useState({ from_id: "", to_id: "", amount: 0, description: "" });

  const { data: accounts } = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_accounts" as any).select("*").order("is_primary", { ascending: false }).order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (payload: any) => {
      if (editing) {
        const { error } = await supabase.from("finance_accounts" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
        await logAuditEvent({ action: "update", entity_type: "finance_account", entity_id: editing.id, details: payload });
      } else {
        const { data, error } = await supabase.from("finance_accounts" as any).insert({ ...payload, current_balance: payload.opening_balance }).select().single();
        if (error) throw error;
        await logAuditEvent({ action: "create", entity_type: "finance_account", entity_id: (data as any)?.id, details: payload });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-accounts"] });
      toast({ title: editing ? "Account updated" : "Account created" });
      setOpen(false); setEditing(null);
      setForm({ name: "", account_type: "bank_checking", opening_balance: 0, current_balance: 0, institution: "", account_number_last4: "", description: "", is_primary: false });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_accounts" as any).delete().eq("id", id);
      if (error) throw error;
      await logAuditEvent({ action: "delete", entity_type: "finance_account", entity_id: id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-accounts"] }); toast({ title: "Account deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const transferMut = useMutation({
    mutationFn: async () => {
      const { from_id, to_id, amount, description } = transfer;
      if (!from_id || !to_id || amount <= 0) throw new Error("Fill all fields");
      if (from_id === to_id) throw new Error("Cannot transfer to same account");
      const { data: { user } } = await supabase.auth.getUser();
      const desc = description || "Transfer between accounts";
      const txns = [
        { account_id: from_id, amount: -amount, direction: "transfer", category: "transfer", description: desc, reference_type: "transfer", related_account_id: to_id, created_by: user?.id },
        { account_id: to_id, amount: amount, direction: "transfer", category: "transfer", description: desc, reference_type: "transfer", related_account_id: from_id, created_by: user?.id },
      ];
      const { error } = await supabase.from("finance_account_transactions" as any).insert(txns);
      if (error) throw error;
      await logAuditEvent({ action: "transfer", entity_type: "finance_account", details: { from_id, to_id, amount } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-accounts"] });
      qc.invalidateQueries({ queryKey: ["finance-account-txns"] });
      toast({ title: "Transfer completed" });
      setTransferOpen(false);
      setTransfer({ from_id: "", to_id: "", amount: 0, description: "" });
    },
    onError: (e: any) => toast({ title: "Transfer failed", description: e.message, variant: "destructive" }),
  });

  const totalAssets = (accounts || []).filter((a: any) => a.account_type !== "credit_card").reduce((s: number, a: any) => s + Number(a.current_balance || 0), 0);
  const totalLiabilities = (accounts || []).filter((a: any) => a.account_type === "credit_card").reduce((s: number, a: any) => s + Number(a.current_balance || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Cash & Bank</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Credit / Liabilities</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-destructive">${Math.abs(totalLiabilities).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Net Position</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">${(totalAssets + totalLiabilities).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Accounts</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTransferOpen(true)}><ArrowLeftRight className="h-4 w-4 mr-2" />Transfer</Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm({ name: "", account_type: "bank_checking", opening_balance: 0, current_balance: 0, institution: "", account_number_last4: "", description: "", is_primary: false }); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Account</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit Account" : "Create Account"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main Checking" /></div>
                <div><Label>Type</Label>
                  <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(ACCOUNT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Institution</Label><Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="Chase, etc." /></div>
                  <div><Label>Last 4 digits</Label><Input value={form.account_number_last4} onChange={(e) => setForm({ ...form, account_number_last4: e.target.value })} maxLength={4} /></div>
                </div>
                {!editing && (
                  <div><Label>Opening Balance</Label><Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: Number(e.target.value) })} /></div>
                )}
                <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Switch checked={form.is_primary} onCheckedChange={(v) => setForm({ ...form, is_primary: v })} /><Label>Primary account</Label></div>
              </div>
              <DialogFooter><Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}>{editing ? "Update" : "Create"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(accounts || []).map((a: any) => {
          const Icon = ACCOUNT_ICONS[a.account_type] || Wallet;
          return (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-muted"><Icon className="h-5 w-5" /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{a.name}</p>
                        {a.is_primary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{ACCOUNT_LABELS[a.account_type]} {a.institution && `• ${a.institution}`} {a.account_number_last4 && `••${a.account_number_last4}`}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setForm({ name: a.name, account_type: a.account_type, opening_balance: a.opening_balance, current_balance: a.current_balance, institution: a.institution || "", account_number_last4: a.account_number_last4 || "", description: a.description || "", is_primary: a.is_primary }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${a.name}?`)) deleteMut.mutate(a.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <p className="text-3xl font-bold mt-3">${Number(a.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                {a.description && <p className="text-xs text-muted-foreground mt-2">{a.description}</p>}
              </CardContent>
            </Card>
          );
        })}
        {(!accounts || accounts.length === 0) && <p className="text-muted-foreground col-span-2 text-center py-8">No accounts yet. Create your first account to start tracking finances.</p>}
      </div>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transfer Between Accounts</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>From</Label>
              <Select value={transfer.from_id} onValueChange={(v) => setTransfer({ ...transfer, from_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>{(accounts || []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name} (${Number(a.current_balance).toFixed(2)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>To</Label>
              <Select value={transfer.to_id} onValueChange={(v) => setTransfer({ ...transfer, to_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>{(accounts || []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Amount</Label><Input type="number" step="0.01" value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: Number(e.target.value) })} /></div>
            <div><Label>Description (optional)</Label><Input value={transfer.description} onChange={(e) => setTransfer({ ...transfer, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => transferMut.mutate()} disabled={transferMut.isPending}>Transfer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
