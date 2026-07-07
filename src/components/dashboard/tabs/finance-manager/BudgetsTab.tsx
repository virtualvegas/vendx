import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export const BudgetsTab = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM-01"));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "", subcategory: "", budget_amount: 0, notes: "" });

  const budgets = useQuery({
    queryKey: ["budgets", month],
    queryFn: async () => {
      const { data } = await supabase.from("finance_budgets" as any).select("*").eq("budget_month", month).order("category");
      return (data || []) as any[];
    },
  });

  const variance = useQuery({
    queryKey: ["budget-variance", month],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_budget_variance" as any, { p_month: month });
      return (data || []) as any[];
    },
  });

  const save = async () => {
    if (!form.category || !form.budget_amount) return toast({ title: "Category & amount required", variant: "destructive" });
    const { error } = await supabase.from("finance_budgets" as any).insert({
      budget_month: month, category: form.category, subcategory: form.subcategory || null,
      budget_amount: form.budget_amount, notes: form.notes || null,
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Budget saved" });
    setOpen(false); setForm({ category: "", subcategory: "", budget_amount: 0, notes: "" });
    qc.invalidateQueries({ queryKey: ["budgets"] });
    qc.invalidateQueries({ queryKey: ["budget-variance"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div><Label>Month</Label><Input type="month" value={month.slice(0, 7)} onChange={e => setMonth(e.target.value + "-01")} /></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Add Budget</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Budget Line</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Category *</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. cogs, marketing, payroll" /></div>
              <div><Label>Subcategory</Label><Input value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })} /></div>
              <div><Label>Amount *</Label><Input type="number" step="0.01" value={form.budget_amount} onChange={e => setForm({ ...form, budget_amount: Number(e.target.value) })} /></div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={save} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Budget vs Actual — {format(new Date(month), "MMMM yyyy")}</CardTitle></CardHeader>
        <CardContent>
          {variance.isLoading ? <Loader2 className="animate-spin" /> :
            !variance.data?.length ? <p className="text-sm text-muted-foreground">No budgets set for this month yet.</p> :
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr><th className="text-left py-1">Category</th><th className="text-left">Sub</th><th className="text-right">Budget</th><th className="text-right">Actual</th><th className="text-right">Variance</th><th className="text-right">%</th></tr>
                </thead>
                <tbody>
                  {variance.data.map((r: any, i) => {
                    const over = Number(r.actual) > Number(r.budgeted) && Number(r.budgeted) > 0;
                    return (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-1 capitalize">{r.category}</td>
                        <td>{r.subcategory || "—"}</td>
                        <td className="text-right">${Number(r.budgeted).toLocaleString()}</td>
                        <td className="text-right">${Number(r.actual).toLocaleString()}</td>
                        <td className={`text-right ${Number(r.variance) < 0 ? "text-red-500" : "text-green-500"}`}>${Number(r.variance).toLocaleString()}</td>
                        <td className={`text-right ${over ? "text-red-500 font-bold" : ""}`}>
                          {r.variance_pct !== null && `${r.variance_pct > 0 ? "+" : ""}${r.variance_pct}%`}
                          {over && <AlertTriangle className="inline h-3 w-3 ml-1" />}
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
