import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { PiggyBank, TrendingUp, AlertCircle, ArrowDownToLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/hooks/useAuditLog";
import { startOfYear, startOfQuarter, format } from "date-fns";

export const TaxVaultTab = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [setOpen, setSetOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [settings, setSettings] = useState<any>({ setaside_percent: 25, sales_tax_percent: 0, fiscal_year_start_month: 1, tax_savings_account_id: "" });
  const [transfer, setTransfer] = useState({ from_id: "", amount: 0 });

  const { data: accounts } = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: async () => (await supabase.from("finance_accounts" as any).select("*")).data || [],
  });

  const { data: taxSettings } = useQuery({
    queryKey: ["finance-tax-settings"],
    queryFn: async (): Promise<any> => {
      const { data } = await supabase.from("finance_tax_settings" as any).select("*").order("effective_from", { ascending: false }).limit(1);
      return (data as any)?.[0] || null;
    },
  });

  // Revenue for current year (synced + machine txns)
  const { data: yearRevenue } = useQuery({
    queryKey: ["tax-year-revenue"],
    queryFn: async () => {
      const yearStart = startOfYear(new Date()).toISOString();
      const { data } = await supabase.from("synced_transactions").select("amount").eq("status", "completed").eq("transaction_type", "revenue").gte("created_at", yearStart);
      return (data || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
    },
  });

  const { data: quarterRevenue } = useQuery({
    queryKey: ["tax-quarter-revenue"],
    queryFn: async () => {
      const qStart = startOfQuarter(new Date()).toISOString();
      const { data } = await supabase.from("synced_transactions").select("amount").eq("status", "completed").eq("transaction_type", "revenue").gte("created_at", qStart);
      return (data || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
    },
  });

  const { data: yearExpenses } = useQuery({
    queryKey: ["tax-year-expenses"],
    queryFn: async () => {
      const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");
      const { data } = await supabase.from("finance_expenses" as any).select("amount, is_tax_deductible").gte("expense_date", yearStart).neq("status", "void");
      const all = (data || []).reduce((s: number, e: any) => s + Number(e.amount), 0);
      const ded = (data || []).filter((e: any) => e.is_tax_deductible).reduce((s: number, e: any) => s + Number(e.amount), 0);
      return { all, ded };
    },
  });

  const taxAccount = useMemo(() => (accounts || []).find((a: any) => a.id === taxSettings?.tax_savings_account_id), [accounts, taxSettings]);

  const stats = useMemo(() => {
    const setasidePct = Number(taxSettings?.setaside_percent || 25);
    const taxableIncomeYTD = Math.max(0, (yearRevenue || 0) - (yearExpenses?.ded || 0));
    const estimatedTaxYTD = taxableIncomeYTD * setasidePct / 100;
    const estimatedTaxQuarter = (quarterRevenue || 0) * setasidePct / 100;
    const setAside = Number(taxAccount?.current_balance || 0);
    const shortfall = estimatedTaxYTD - setAside;
    const progress = estimatedTaxYTD > 0 ? Math.min(100, (setAside / estimatedTaxYTD) * 100) : 0;
    return { setasidePct, taxableIncomeYTD, estimatedTaxYTD, estimatedTaxQuarter, setAside, shortfall, progress };
  }, [yearRevenue, yearExpenses, quarterRevenue, taxSettings, taxAccount]);

  const saveSettingsMut = useMutation({
    mutationFn: async () => {
      const payload = { ...settings, tax_savings_account_id: settings.tax_savings_account_id || null };
      if (taxSettings) {
        const { error } = await supabase.from("finance_tax_settings" as any).update(payload).eq("id", taxSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("finance_tax_settings" as any).insert(payload);
        if (error) throw error;
      }
      await logAuditEvent({ action: "update", entity_type: "finance_tax_settings", details: payload });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-tax-settings"] }); toast({ title: "Tax settings saved" }); setSetOpen(false); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const setasideMut = useMutation({
    mutationFn: async () => {
      if (!transfer.from_id || !taxSettings?.tax_savings_account_id || transfer.amount <= 0) throw new Error("Configure tax account and fill all fields");
      if (transfer.from_id === taxSettings.tax_savings_account_id) throw new Error("Cannot transfer to same account");
      const { data: { user } } = await supabase.auth.getUser();
      const desc = `Tax setaside (${stats.setasidePct}%)`;
      await supabase.from("finance_account_transactions" as any).insert([
        { account_id: transfer.from_id, amount: -transfer.amount, direction: "transfer", category: "tax_setaside", description: desc, reference_type: "tax_setaside", related_account_id: taxSettings.tax_savings_account_id, created_by: user?.id },
        { account_id: taxSettings.tax_savings_account_id, amount: transfer.amount, direction: "transfer", category: "tax_setaside", description: desc, reference_type: "tax_setaside", related_account_id: transfer.from_id, created_by: user?.id },
      ]);
      await logAuditEvent({ action: "tax_setaside", entity_type: "finance_account", details: { amount: transfer.amount } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-accounts"] }); toast({ title: "Tax money set aside" }); setTransferOpen(false); setTransfer({ from_id: "", amount: 0 }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">YTD Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${(yearRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">YTD Deductible Expenses</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${(yearExpenses?.ded || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Estimated Tax Owed (YTD)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">${stats.estimatedTaxYTD.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">@ {stats.setasidePct}% of taxable</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Set Aside</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">${stats.setAside.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><PiggyBank className="h-5 w-5" />Tax Savings Vault</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setSettings(taxSettings || { setaside_percent: 25, sales_tax_percent: 0, fiscal_year_start_month: 1, tax_savings_account_id: "" }); setSetOpen(true); }}>Settings</Button>
              <Button onClick={() => setTransferOpen(true)} disabled={!taxSettings?.tax_savings_account_id}><ArrowDownToLine className="h-4 w-4 mr-2" />Set Aside Funds</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!taxSettings?.tax_savings_account_id && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm">Configure your tax settings and link a savings account to start tracking your tax vault.</div>
            </div>
          )}
          {taxAccount && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Vault: <strong>{taxAccount.name}</strong></span>
                <span>${stats.setAside.toFixed(2)} / ${stats.estimatedTaxYTD.toFixed(2)}</span>
              </div>
              <Progress value={stats.progress} />
              {stats.shortfall > 0 ? (
                <p className="text-sm text-amber-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />Shortfall: ${stats.shortfall.toFixed(2)} — set aside more to stay covered.</p>
              ) : (
                <p className="text-sm text-green-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" />Fully covered • surplus ${Math.abs(stats.shortfall).toFixed(2)}</p>
              )}
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2 pt-2 border-t">
            <div className="p-3 rounded-md bg-muted/30">
              <p className="text-xs text-muted-foreground">This Quarter Revenue</p>
              <p className="text-xl font-semibold">${(quarterRevenue || 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Suggested quarterly setaside: <strong>${stats.estimatedTaxQuarter.toFixed(2)}</strong></p>
            </div>
            <div className="p-3 rounded-md bg-muted/30">
              <p className="text-xs text-muted-foreground">Sales Tax Rate</p>
              <p className="text-xl font-semibold">{taxSettings?.sales_tax_percent || 0}%</p>
              <p className="text-xs text-muted-foreground mt-1">Sales tax estimate: <strong>${((yearRevenue || 0) * Number(taxSettings?.sales_tax_percent || 0) / 100).toFixed(2)}</strong></p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={setOpen} onOpenChange={setSetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tax Settings</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tax setaside % (estimated income tax)</Label><Input type="number" step="0.5" value={settings.setaside_percent} onChange={(e) => setSettings({ ...settings, setaside_percent: Number(e.target.value) })} /></div>
            <div><Label>Sales tax %</Label><Input type="number" step="0.001" value={settings.sales_tax_percent} onChange={(e) => setSettings({ ...settings, sales_tax_percent: Number(e.target.value) })} /></div>
            <div><Label>Fiscal year start month (1-12)</Label><Input type="number" min={1} max={12} value={settings.fiscal_year_start_month} onChange={(e) => setSettings({ ...settings, fiscal_year_start_month: Number(e.target.value) })} /></div>
            <div><Label>Tax Savings Account</Label>
              <Select value={settings.tax_savings_account_id || "none"} onValueChange={(v) => setSettings({ ...settings, tax_savings_account_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{(accounts || []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={() => saveSettingsMut.mutate()} disabled={saveSettingsMut.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Aside Tax Money</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>From Account</Label>
              <Select value={transfer.from_id} onValueChange={(v) => setTransfer({ ...transfer, from_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>{(accounts || []).filter((a: any) => a.id !== taxSettings?.tax_savings_account_id).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name} (${Number(a.current_balance).toFixed(2)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Amount</Label><Input type="number" step="0.01" value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: Number(e.target.value) })} /></div>
            <p className="text-xs text-muted-foreground">Suggested: ${Math.max(0, stats.shortfall).toFixed(2)} to fully cover YTD estimate.</p>
          </div>
          <DialogFooter><Button onClick={() => setasideMut.mutate()} disabled={setasideMut.isPending}>Transfer to Vault</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
