import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, RefreshCw, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { formatDisplayDate } from "@/lib/dateUtils";

interface Cfg {
  id?: string;
  source: string;
  display_name: string;
  deposit_account_id: string | null;
  expense_account_id: string | null;
  revenue_category: string;
  revenue_subcategory: string | null;
  expense_category: string;
  expense_subcategory: string | null;
  payment_method: string | null;
  cogs_payment_method: string | null;
  is_active: boolean;
}

const blank: Cfg = {
  source: "paypal_zettle",
  display_name: "PayPal Zettle POS",
  deposit_account_id: null,
  expense_account_id: null,
  revenue_category: "pos_revenue",
  revenue_subcategory: "paypal_zettle",
  expense_category: "cogs",
  expense_subcategory: "paypal_zettle",
  payment_method: "pos",
  cogs_payment_method: "internal",
  is_active: true,
};

const money = (n: number) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const POSFinancePanel = () => {
  const [cfg, setCfg] = useState<Cfg>(blank);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [posted, setPosted] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(today());
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = async () => {
    const [{ data: c }, { data: a }, { data: inc }, { data: exp }] = await Promise.all([
      supabase.from("vendx_pos_revenue_config").select("*").in("source", ["paypal_zettle", "loyverse"]).maybeSingle(),
      supabase.from("finance_accounts").select("id,name").eq("is_active", true).order("name"),
      supabase
        .from("finance_income")
        .select("id,income_date,source,amount,tax_collected,external_reference,notes,location_id")
        .eq("reference_type", "loyverse_daily_revenue")
        .order("income_date", { ascending: false })
        .limit(200),
      supabase
        .from("finance_expenses")
        .select("id,expense_date,vendor,amount,external_reference")
        .like("external_reference", "loyverse_cogs_%")
        .order("expense_date", { ascending: false })
        .limit(200),
    ]);
    if (c) setCfg({ ...blank, ...(c as any) });
    setAccounts((a as any) || []);
    setPosted(inc || []);
    setExpenses(exp || []);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...cfg, source: "paypal_zettle" };
      delete (payload as any).id;
      const { error } = cfg.id
        ? await supabase.from("vendx_pos_revenue_config").update(payload).eq("id", cfg.id)
        : await supabase.from("vendx_pos_revenue_config").insert(payload);
      if (error) throw error;
      toast.success("Finance posting settings saved");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const postRange = async () => {
    setPosting(true);
    try {
      const { data, error } = await supabase.functions.invoke("loyverse-daily-finance-sync", { body: { from, to } });
      if (error) throw error;
      toast.success(`Posted sales for ${data?.days?.length ?? 0} day(s) to finance`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Posting failed");
    } finally {
      setPosting(false);
    }
  };

  const totalPosted = posted.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalCogs = expenses.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2"><Banknote className="w-5 h-5" /> Finance Posting</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                PayPal Zettle sales post once per store per day into Income (and cost of goods into Expenses),
                so they appear on the financial tabs without being counted twice.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input value={cfg.display_name} onChange={(e) => setCfg({ ...cfg, display_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Deposit Account (revenue)</Label>
              <Select value={cfg.deposit_account_id || "__none"} onValueChange={(v) => setCfg({ ...cfg, deposit_account_id: v === "__none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— None —</SelectItem>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Expense Account (COGS)</Label>
              <Select value={cfg.expense_account_id || "__none"} onValueChange={(v) => setCfg({ ...cfg, expense_account_id: v === "__none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— None —</SelectItem>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Revenue Category</Label>
              <Input value={cfg.revenue_category} onChange={(e) => setCfg({ ...cfg, revenue_category: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Revenue Subcategory</Label>
              <Input value={cfg.revenue_subcategory || ""} onChange={(e) => setCfg({ ...cfg, revenue_subcategory: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Revenue Payment Method</Label>
              <Input value={cfg.payment_method || ""} onChange={(e) => setCfg({ ...cfg, payment_method: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Expense Category</Label>
              <Input value={cfg.expense_category} onChange={(e) => setCfg({ ...cfg, expense_category: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Expense Subcategory</Label>
              <Input value={cfg.expense_subcategory || ""} onChange={(e) => setCfg({ ...cfg, expense_subcategory: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>COGS Payment Method</Label>
              <Input value={cfg.cogs_payment_method || ""} onChange={(e) => setCfg({ ...cfg, cogs_payment_method: e.target.value })} />
            </div>
          </div>
          <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? "Saving..." : "Save Settings"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Post Sales to Finance</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[170px]" />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[170px]" />
            </div>
            <Button onClick={postRange} disabled={posting}>
              <Upload className={`w-4 h-4 mr-2 ${posting ? "animate-pulse" : ""}`} />
              {posting ? "Posting..." : "Post to Finance"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Re-posting a day replaces that day's entries, so totals never double up.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Posted Income · {money(totalPosted)}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {posted.length === 0 ? <p className="text-sm text-muted-foreground">Nothing posted yet.</p> : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Date</TableHead><TableHead>Store</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">Tax</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {posted.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{formatDisplayDate(r.income_date)}</TableCell>
                      <TableCell className="text-sm">{r.source}</TableCell>
                      <TableCell className="text-right font-medium">{money(r.amount)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{money(r.tax_collected)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Posted Cost of Goods · {money(totalCogs)}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {expenses.length === 0 ? <p className="text-sm text-muted-foreground">No cost entries posted.</p> : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Date</TableHead><TableHead>Vendor</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{formatDisplayDate(r.expense_date)}</TableCell>
                      <TableCell className="text-sm">{r.vendor}</TableCell>
                      <TableCell className="text-right font-medium">{money(r.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-2">
        <Badge variant="outline">Single source</Badge>
        Sales come in through the connected register feed and post as PayPal Zettle POS revenue only.
      </p>
    </div>
  );
};

export default POSFinancePanel;
