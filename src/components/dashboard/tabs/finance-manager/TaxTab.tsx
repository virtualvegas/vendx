import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, MapPin, Percent, Users, Calculator } from "lucide-react";
import { format, startOfQuarter, endOfQuarter } from "date-fns";

const JurisdictionsPanel = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState<any>(null);
  const [form, setForm] = useState({ name: "", country: "US", state_or_region: "", city: "", filing_frequency: "quarterly", registration_number: "" });
  const [rateForm, setRateForm] = useState({ tax_type: "sales", rate_pct: 0, effective_from: format(new Date(), "yyyy-MM-dd") });

  const jurs = useQuery({
    queryKey: ["tax-jurs"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_tax_jurisdictions" as any).select("*").order("name");
      return (data || []) as any[];
    },
  });

  const rates = useQuery({
    queryKey: ["tax-rates"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_tax_rates" as any).select("*").order("effective_from", { ascending: false });
      return (data || []) as any[];
    },
  });

  const create = async () => {
    if (!form.name) return toast({ title: "Name required", variant: "destructive" });
    const { error } = await supabase.from("finance_tax_jurisdictions" as any).insert({ ...form, is_active: true });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setOpen(false); setForm({ name: "", country: "US", state_or_region: "", city: "", filing_frequency: "quarterly", registration_number: "" });
    qc.invalidateQueries({ queryKey: ["tax-jurs"] });
  };

  const addRate = async () => {
    if (!rateOpen) return;
    const { error } = await supabase.from("finance_tax_rates" as any).insert({ ...rateForm, jurisdiction_id: rateOpen.id });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setRateOpen(null); setRateForm({ tax_type: "sales", rate_pct: 0, effective_from: format(new Date(), "yyyy-MM-dd") });
    qc.invalidateQueries({ queryKey: ["tax-rates"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Jurisdiction</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Tax Jurisdiction</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. California Sales Tax" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Country</Label><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
                <div><Label>State</Label><Input value={form.state_or_region} onChange={e => setForm({ ...form, state_or_region: e.target.value })} /></div>
                <div><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Filing</Label><Input value={form.filing_frequency} onChange={e => setForm({ ...form, filing_frequency: e.target.value })} /></div>
                <div><Label>Reg #</Label><Input value={form.registration_number} onChange={e => setForm({ ...form, registration_number: e.target.value })} /></div>
              </div>
              <Button onClick={create} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {jurs.isLoading ? <Loader2 className="animate-spin" /> :
        !jurs.data?.length ? <p className="text-sm text-muted-foreground">No jurisdictions.</p> :
          <div className="space-y-2">
            {jurs.data.map((j: any) => {
              const jr = (rates.data || []).filter((r: any) => r.jurisdiction_id === j.id);
              return (
                <Card key={j.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium flex items-center gap-2"><MapPin className="h-4 w-4" />{j.name}</div>
                        <div className="text-xs text-muted-foreground">{[j.city, j.state_or_region, j.country].filter(Boolean).join(", ")} · {j.filing_frequency}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setRateOpen(j)}><Percent className="h-3 w-3 mr-1" />Add Rate</Button>
                    </div>
                    {jr.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {jr.map((r: any) => (
                          <Badge key={r.id} variant="secondary">{r.tax_type} {Number(r.rate_pct).toFixed(3)}% · from {format(new Date(r.effective_from), "MMM d, yyyy")}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>}

      <Dialog open={!!rateOpen} onOpenChange={o => !o && setRateOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Rate — {rateOpen?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Type</Label><Input value={rateForm.tax_type} onChange={e => setRateForm({ ...rateForm, tax_type: e.target.value })} placeholder="sales, use, income..." /></div>
            <div><Label>Rate %</Label><Input type="number" step="0.001" value={rateForm.rate_pct} onChange={e => setRateForm({ ...rateForm, rate_pct: Number(e.target.value) })} /></div>
            <div><Label>Effective From</Label><Input type="date" value={rateForm.effective_from} onChange={e => setRateForm({ ...rateForm, effective_from: e.target.value })} /></div>
            <Button onClick={addRate} className="w-full">Add Rate</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const QuarterlyEstimatesPanel = () => {
  const now = new Date();
  const qStart = format(startOfQuarter(now), "yyyy-MM-dd");
  const qEnd = format(endOfQuarter(now), "yyyy-MM-dd");
  const [settingsPct, setSettingsPct] = useState<number>(25);

  const pnl = useQuery({
    queryKey: ["tax-pnl", qStart, qEnd],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_pnl_report" as any, { p_from: qStart, p_to: qEnd });
      return (data || []) as any[];
    },
  });

  const settings = useQuery({
    queryKey: ["tax-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_tax_settings" as any).select("*").limit(1).maybeSingle();
      if (data) setSettingsPct(Number((data as any).setaside_percent) || 25);
      return data as any;
    },
  });

  const income = (pnl.data || []).filter(r => r.kind === "income").reduce((s, r) => s + Number(r.total), 0);
  const expense = (pnl.data || []).filter(r => r.kind === "expense").reduce((s, r) => s + Number(r.total), 0);
  const netProfit = income - expense;
  const estimate = Math.max(0, netProfit * (settingsPct / 100));

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />Quarterly Tax Estimate</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">Period: {format(new Date(qStart), "PP")} – {format(new Date(qEnd), "PP")}</div>
        {pnl.isLoading || settings.isLoading ? <Loader2 className="animate-spin" /> : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div><div className="text-xs text-muted-foreground">Income</div><div className="text-lg font-bold text-green-500">${income.toLocaleString()}</div></div>
              <div><div className="text-xs text-muted-foreground">Expenses</div><div className="text-lg font-bold text-red-500">${expense.toLocaleString()}</div></div>
              <div><div className="text-xs text-muted-foreground">Net Profit</div><div className={`text-lg font-bold ${netProfit >= 0 ? "text-green-500" : "text-red-500"}`}>${netProfit.toLocaleString()}</div></div>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1"><Label>Set-Aside %</Label><Input type="number" step="0.5" value={settingsPct} onChange={e => setSettingsPct(Number(e.target.value))} /></div>
              <div className="flex-1 p-3 border rounded-lg bg-muted/40">
                <div className="text-xs text-muted-foreground">Estimated Tax Due</div>
                <div className="text-2xl font-bold">${estimate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const Form1099Panel = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [form, setForm] = useState({ recipient_name: "", recipient_tin: "", recipient_email: "", form_type: "1099-NEC", total_paid: 0 });

  const list = useQuery({
    queryKey: ["1099s", year],
    queryFn: async () => {
      const { data } = await supabase.from("finance_1099_recipients" as any).select("*").eq("tax_year", year).order("recipient_name");
      return (data || []) as any[];
    },
  });

  const create = async () => {
    if (!form.recipient_name) return toast({ title: "Name required", variant: "destructive" });
    const { error } = await supabase.from("finance_1099_recipients" as any).insert({ ...form, tax_year: year, status: "draft" });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setOpen(false); setForm({ recipient_name: "", recipient_tin: "", recipient_email: "", form_type: "1099-NEC", total_paid: 0 });
    qc.invalidateQueries({ queryKey: ["1099s"] });
  };

  const total = (list.data || []).reduce((s, r) => s + Number(r.total_paid || 0), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />1099 Recipients</CardTitle>
          <div className="flex items-center gap-2">
            <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-24" />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Recipient</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New 1099 Recipient ({year})</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name *</Label><Input value={form.recipient_name} onChange={e => setForm({ ...form, recipient_name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>TIN/SSN</Label><Input value={form.recipient_tin} onChange={e => setForm({ ...form, recipient_tin: e.target.value })} /></div>
                    <div><Label>Email</Label><Input value={form.recipient_email} onChange={e => setForm({ ...form, recipient_email: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Form Type</Label><Input value={form.form_type} onChange={e => setForm({ ...form, form_type: e.target.value })} /></div>
                    <div><Label>Total Paid</Label><Input type="number" step="0.01" value={form.total_paid} onChange={e => setForm({ ...form, total_paid: Number(e.target.value) })} /></div>
                  </div>
                  <Button onClick={create} className="w-full">Add</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {list.isLoading ? <Loader2 className="animate-spin" /> :
          !list.data?.length ? <p className="text-sm text-muted-foreground">No recipients for {year}.</p> :
            <>
              <div className="text-sm text-muted-foreground mb-2">Total reportable: <span className="text-foreground font-semibold">${total.toLocaleString()}</span></div>
              <table className="w-full text-sm">
                <thead className="border-b"><tr><th className="text-left py-1">Name</th><th className="text-left">TIN</th><th className="text-left">Form</th><th className="text-right">Amount</th><th className="text-center">Status</th></tr></thead>
                <tbody>
                  {list.data.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/30">
                      <td className="py-1">{r.recipient_name}</td>
                      <td>{r.recipient_tin ? `***-**-${String(r.recipient_tin).slice(-4)}` : "—"}</td>
                      <td>{r.form_type}</td>
                      <td className="text-right">${Number(r.total_paid).toLocaleString()}</td>
                      <td className="text-center"><Badge variant="outline">{r.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>}
      </CardContent>
    </Card>
  );
};

export const TaxTab = () => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Advanced Tax</h2>
        <p className="text-sm text-muted-foreground">Sales tax jurisdictions, quarterly estimates, and 1099 preparation.</p>
      </div>
      <Tabs defaultValue="estimates">
        <TabsList>
          <TabsTrigger value="estimates">Quarterly Estimates</TabsTrigger>
          <TabsTrigger value="jurisdictions">Jurisdictions & Rates</TabsTrigger>
          <TabsTrigger value="forms">1099s</TabsTrigger>
        </TabsList>
        <TabsContent value="estimates"><QuarterlyEstimatesPanel /></TabsContent>
        <TabsContent value="jurisdictions"><JurisdictionsPanel /></TabsContent>
        <TabsContent value="forms"><Form1099Panel /></TabsContent>
      </Tabs>
    </div>
  );
};
