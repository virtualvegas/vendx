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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Globe, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";

export const CurrencyTab = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [curOpen, setCurOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [curForm, setCurForm] = useState({ code: "", name: "", symbol: "", is_base: false });
  const [rateForm, setRateForm] = useState({ from_currency: "USD", to_currency: "", rate: 1, rate_date: format(new Date(), "yyyy-MM-dd"), source: "manual" });

  const currencies = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_currencies" as any).select("*").order("code");
      return (data || []) as any[];
    },
  });

  const rates = useQuery({
    queryKey: ["fx-rates"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_fx_rates" as any).select("*").order("rate_date", { ascending: false }).limit(100);
      return (data || []) as any[];
    },
  });

  const createCurrency = async () => {
    if (!curForm.code || !curForm.name) return toast({ title: "Code and name required", variant: "destructive" });
    const payload = { ...curForm, code: curForm.code.toUpperCase(), is_active: true };
    if (curForm.is_base) {
      await supabase.from("finance_currencies" as any).update({ is_base: false }).eq("is_base", true);
    }
    const { error } = await supabase.from("finance_currencies" as any).insert(payload);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setCurOpen(false); setCurForm({ code: "", name: "", symbol: "", is_base: false });
    qc.invalidateQueries({ queryKey: ["currencies"] });
  };

  const setBase = async (code: string) => {
    await supabase.from("finance_currencies" as any).update({ is_base: false }).eq("is_base", true);
    await supabase.from("finance_currencies" as any).update({ is_base: true }).eq("code", code);
    qc.invalidateQueries({ queryKey: ["currencies"] });
  };

  const toggleActive = async (code: string, active: boolean) => {
    await supabase.from("finance_currencies" as any).update({ is_active: active }).eq("code", code);
    qc.invalidateQueries({ queryKey: ["currencies"] });
  };

  const createRate = async () => {
    if (!rateForm.from_currency || !rateForm.to_currency || !rateForm.rate) return toast({ title: "All fields required", variant: "destructive" });
    const { error } = await supabase.from("finance_fx_rates" as any).insert({
      ...rateForm,
      from_currency: rateForm.from_currency.toUpperCase(),
      to_currency: rateForm.to_currency.toUpperCase(),
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setRateOpen(false); setRateForm({ from_currency: "USD", to_currency: "", rate: 1, rate_date: format(new Date(), "yyyy-MM-dd"), source: "manual" });
    qc.invalidateQueries({ queryKey: ["fx-rates"] });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Multi-Currency</h2>
        <p className="text-sm text-muted-foreground">Manage supported currencies and FX rates for cross-currency reporting.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Currencies</CardTitle>
            <Dialog open={curOpen} onOpenChange={setCurOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Currency</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Currency</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label>Code *</Label><Input maxLength={3} value={curForm.code} onChange={e => setCurForm({ ...curForm, code: e.target.value.toUpperCase() })} placeholder="USD" /></div>
                    <div className="col-span-2"><Label>Name *</Label><Input value={curForm.name} onChange={e => setCurForm({ ...curForm, name: e.target.value })} placeholder="US Dollar" /></div>
                  </div>
                  <div><Label>Symbol</Label><Input value={curForm.symbol} onChange={e => setCurForm({ ...curForm, symbol: e.target.value })} placeholder="$" /></div>
                  <div className="flex items-center gap-2"><Switch checked={curForm.is_base} onCheckedChange={v => setCurForm({ ...curForm, is_base: v })} /><Label>Set as base currency</Label></div>
                  <Button onClick={createCurrency} className="w-full">Add</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {currencies.isLoading ? <Loader2 className="animate-spin" /> :
            !currencies.data?.length ? <p className="text-sm text-muted-foreground">No currencies configured.</p> :
              <table className="w-full text-sm">
                <thead className="border-b"><tr><th className="text-left py-1">Code</th><th className="text-left">Name</th><th className="text-center">Symbol</th><th className="text-center">Base</th><th className="text-center">Active</th></tr></thead>
                <tbody>
                  {currencies.data.map((c: any) => (
                    <tr key={c.code} className="border-b border-border/30">
                      <td className="py-1 font-mono font-semibold">{c.code}</td>
                      <td>{c.name}</td>
                      <td className="text-center">{c.symbol || "—"}</td>
                      <td className="text-center">{c.is_base ? <Badge>BASE</Badge> : <Button size="sm" variant="ghost" onClick={() => setBase(c.code)}>Set base</Button>}</td>
                      <td className="text-center"><Switch checked={c.is_active} onCheckedChange={v => toggleActive(c.code, v)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" />FX Rates</CardTitle>
            <Dialog open={rateOpen} onOpenChange={setRateOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Rate</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add FX Rate</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>From</Label><Input maxLength={3} value={rateForm.from_currency} onChange={e => setRateForm({ ...rateForm, from_currency: e.target.value.toUpperCase() })} /></div>
                    <div><Label>To</Label><Input maxLength={3} value={rateForm.to_currency} onChange={e => setRateForm({ ...rateForm, to_currency: e.target.value.toUpperCase() })} /></div>
                  </div>
                  <div><Label>Rate (1 From = ? To)</Label><Input type="number" step="0.000001" value={rateForm.rate} onChange={e => setRateForm({ ...rateForm, rate: Number(e.target.value) })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Date</Label><Input type="date" value={rateForm.rate_date} onChange={e => setRateForm({ ...rateForm, rate_date: e.target.value })} /></div>
                    <div><Label>Source</Label><Input value={rateForm.source} onChange={e => setRateForm({ ...rateForm, source: e.target.value })} /></div>
                  </div>
                  <Button onClick={createRate} className="w-full">Save Rate</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {rates.isLoading ? <Loader2 className="animate-spin" /> :
            !rates.data?.length ? <p className="text-sm text-muted-foreground">No FX rates recorded.</p> :
              <table className="w-full text-sm">
                <thead className="border-b"><tr><th className="text-left py-1">Date</th><th className="text-left">Pair</th><th className="text-right">Rate</th><th className="text-left">Source</th></tr></thead>
                <tbody>
                  {rates.data.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/30">
                      <td className="py-1">{format(new Date(r.rate_date), "PP")}</td>
                      <td className="font-mono">{r.from_currency} → {r.to_currency}</td>
                      <td className="text-right font-mono">{Number(r.rate).toFixed(6)}</td>
                      <td className="text-xs text-muted-foreground">{r.source || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>}
        </CardContent>
      </Card>
    </div>
  );
};
