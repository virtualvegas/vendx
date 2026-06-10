import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, TrendingUp, Trash2, Edit, Search, Download, Copy,
  PauseCircle, PlayCircle, DollarSign, Eye, Target, BarChart3,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format } from "date-fns";

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string | null;
  budget: number;
  spend: number;
  impressions: number;
  conversions: number;
  description?: string | null;
}

const CAMPAIGN_TYPES = [
  "email", "social", "search", "display", "video", "influencer",
  "affiliate", "event", "print", "referral", "sms", "other",
];

const emptyForm = {
  name: "",
  type: "email",
  status: "active",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  budget: 0,
  spend: 0,
  impressions: 0,
  conversions: 0,
  description: "",
};

const Marketing = () => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["marketing-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_campaigns")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const reset = () => { setForm(emptyForm); setEditing(null); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        end_date: form.end_date || null,
        budget: Number(form.budget) || 0,
        spend: Number(form.spend) || 0,
        impressions: Number(form.impressions) || 0,
        conversions: Number(form.conversions) || 0,
      };
      if (editing) {
        const { error } = await supabase.from("marketing_campaigns").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("marketing_campaigns").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-campaigns"] });
      toast({ title: editing ? "Campaign updated" : "Campaign created" });
      setOpen(false); reset();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Campaign> }) => {
      const { error } = await supabase.from("marketing_campaigns").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-campaigns"] });
      toast({ title: "Campaign deleted" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (c: Campaign) => {
      const { id, ...rest } = c;
      const { error } = await supabase.from("marketing_campaigns").insert([{
        ...rest, name: `${c.name} (copy)`, status: "draft", spend: 0, impressions: 0, conversions: 0,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-campaigns"] });
      toast({ title: "Campaign duplicated" });
    },
  });

  const handleEdit = (c: Campaign) => {
    setEditing(c);
    setForm({
      name: c.name, type: c.type, status: c.status,
      start_date: c.start_date, end_date: c.end_date || "",
      budget: c.budget, spend: c.spend || 0,
      impressions: c.impressions, conversions: c.conversions,
      description: c.description || "",
    });
    setOpen(true);
  };

  const filtered = useMemo(() => campaigns.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.type.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [campaigns, search, statusFilter, typeFilter]);

  // Aggregate metrics
  const totals = useMemo(() => {
    const t = { budget: 0, spend: 0, imp: 0, conv: 0 };
    filtered.forEach((c) => {
      t.budget += Number(c.budget) || 0;
      t.spend += Number(c.spend) || 0;
      t.imp += Number(c.impressions) || 0;
      t.conv += Number(c.conversions) || 0;
    });
    return t;
  }, [filtered]);

  const ctr = totals.imp > 0 ? (totals.conv / totals.imp) * 100 : 0;
  const cpc = totals.conv > 0 ? totals.spend / totals.conv : 0;
  const cpm = totals.imp > 0 ? (totals.spend / totals.imp) * 1000 : 0;
  const budgetUsed = totals.budget > 0 ? (totals.spend / totals.budget) * 100 : 0;

  const chartData = useMemo(() => filtered.slice(0, 10).map((c) => ({
    name: c.name.length > 14 ? c.name.slice(0, 14) + "…" : c.name,
    Impressions: c.impressions,
    Conversions: c.conversions,
    Spend: Number(c.spend) || 0,
  })), [filtered]);

  const exportCSV = () => {
    const rows = [["Name", "Type", "Status", "Start", "End", "Budget", "Spend", "Impressions", "Conversions", "CVR%", "CPA"]];
    filtered.forEach((c) => {
      const cvr = c.impressions > 0 ? ((c.conversions / c.impressions) * 100).toFixed(2) : "0";
      const cpa = c.conversions > 0 ? (Number(c.spend) / c.conversions).toFixed(2) : "0";
      rows.push([c.name, c.type, c.status, c.start_date, c.end_date || "", String(c.budget), String(c.spend || 0), String(c.impressions), String(c.conversions), cvr, cpa]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `campaigns-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast({ title: "Exported", description: `${filtered.length} campaigns` });
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      active: "bg-green-500/10 text-green-500 border-green-500/30",
      paused: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
      completed: "bg-blue-500/10 text-blue-500 border-blue-500/30",
      draft: "bg-gray-500/10 text-gray-400 border-gray-500/30",
    };
    return map[s] || "bg-muted text-muted-foreground";
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold mb-1">Marketing &amp; Sales</h2>
          <p className="text-muted-foreground">Track campaigns, budgets, and performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" />Export
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button onClick={reset}><Plus className="w-4 h-4 mr-2" />New Campaign</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Name</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CAMPAIGN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Start Date</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Budget ($)</Label>
                    <Input type="number" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: parseFloat(e.target.value) || 0 })} required />
                  </div>
                  <div>
                    <Label>Spend ($)</Label>
                    <Input type="number" step="0.01" value={form.spend} onChange={(e) => setForm({ ...form, spend: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>Impressions</Label>
                    <Input type="number" value={form.impressions} onChange={(e) => setForm({ ...form, impressions: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>Conversions</Label>
                    <Input type="number" value={form.conversions} onChange={(e) => setForm({ ...form, conversions: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="col-span-2">
                    <Label>Notes</Label>
                    <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Targeting, channel notes, creative links…" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={saveMutation.isPending}>{editing ? "Update" : "Create"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Campaigns</p>
              <p className="text-2xl font-bold">{filtered.length}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-primary/30" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Budget</p>
              <p className="text-2xl font-bold">${totals.budget.toLocaleString()}</p>
            </div>
            <DollarSign className="w-8 h-8 text-primary/30" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Spend</p>
          <p className="text-2xl font-bold">${totals.spend.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">{budgetUsed.toFixed(0)}% of budget</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Impressions</p>
              <p className="text-2xl font-bold">{totals.imp.toLocaleString()}</p>
            </div>
            <Eye className="w-8 h-8 text-primary/30" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Conversions</p>
              <p className="text-2xl font-bold">{totals.conv.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">CVR {ctr.toFixed(2)}%</p>
            </div>
            <Target className="w-8 h-8 text-primary/30" />
          </div>
        </CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Cost per Acquisition</p>
          <p className="text-2xl font-bold">${cpc.toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">CPM</p>
          <p className="text-2xl font-bold">${cpm.toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Active Campaigns</p>
          <p className="text-2xl font-bold text-green-500">{filtered.filter((c) => c.status === "active").length}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Campaigns</TabsTrigger>
          <TabsTrigger value="chart">Performance Chart</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Filter bar */}
          <Card>
            <CardContent className="p-4 flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Search by name or type…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {CAMPAIGN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Campaigns ({filtered.length})</CardTitle></CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No campaigns match your filters</p>
              ) : (
                <div className="space-y-3">
                  {filtered.map((c) => {
                    const cvr = c.impressions > 0 ? ((c.conversions / c.impressions) * 100).toFixed(2) : "0.00";
                    const cpa = c.conversions > 0 ? (Number(c.spend) / c.conversions).toFixed(2) : "—";
                    const budgetPct = c.budget > 0 ? Math.min(100, (Number(c.spend) / c.budget) * 100) : 0;
                    return (
                      <div key={c.id} className="rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold">{c.name}</h3>
                              <Badge variant="outline" className={statusBadge(c.status)}>{c.status}</Badge>
                              <Badge variant="outline" className="text-xs">{c.type}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                              <span>{new Date(c.start_date).toLocaleDateString()}{c.end_date ? ` → ${new Date(c.end_date).toLocaleDateString()}` : ""}</span>
                              <span>{c.impressions.toLocaleString()} imp</span>
                              <span>{c.conversions.toLocaleString()} conv</span>
                              <span>CVR {cvr}%</span>
                              <span>CPA ${cpa}</span>
                            </div>
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">${Number(c.spend || 0).toLocaleString()} of ${Number(c.budget).toLocaleString()}</span>
                                <span className="font-medium">{budgetPct.toFixed(0)}%</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full transition-all ${budgetPct >= 95 ? "bg-red-500" : budgetPct >= 70 ? "bg-yellow-500" : "bg-primary"}`} style={{ width: `${budgetPct}%` }} />
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            <Button variant="ghost" size="sm" title={c.status === "active" ? "Pause" : "Activate"}
                              onClick={() => patchMutation.mutate({ id: c.id, patch: { status: c.status === "active" ? "paused" : "active" } })}>
                              {c.status === "active" ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => duplicateMutation.mutate(c)} title="Duplicate"><Copy className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(c)} title="Edit"><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => {
                              if (confirm(`Delete "${c.name}"?`)) deleteMutation.mutate(c.id);
                            }} title="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chart">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5" />Top Campaign Performance</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Bar dataKey="Impressions" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Conversions" fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Marketing;
