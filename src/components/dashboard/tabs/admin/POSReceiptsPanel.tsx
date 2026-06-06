import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Receipt, Search, RefreshCw, DollarSign, Settings } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDisplayDate } from "@/lib/dateUtils";

interface POSReceipt {
  id: string;
  user_id: string | null;
  external_id: string;
  receipt_number: string | null;
  store_name: string | null;
  pos_customer_email: string | null;
  pos_customer_name: string | null;
  matched_by: string | null;
  total_amount: number;
  tax_total: number;
  tip_total: number;
  discount_total: number;
  payment_method: string | null;
  points_earned: number;
  receipt_date: string;
  currency: string;
}

interface ReceiptItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

const POSReceiptsPanel = () => {
  const [receipts, setReceipts] = useState<POSReceipt[]>([]);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [selected, setSelected] = useState<POSReceipt | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [financeSyncing, setFinanceSyncing] = useState(false);
  const [financeDate, setFinanceDate] = useState<string>(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return y.toISOString().slice(0, 10);
  });

  const [configOpen, setConfigOpen] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [config, setConfig] = useState<any>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const loadReceipts = async () => {
    const { data } = await supabase
      .from("vendx_pos_receipts")
      .select("*")
      .order("receipt_date", { ascending: false })
      .limit(200);
    setReceipts((data as POSReceipt[]) || []);
    setLoading(false);
  };

  const loadConfig = async () => {
    const [{ data: accs }, { data: cfg }] = await Promise.all([
      supabase.from("finance_accounts").select("id,name").eq("is_active", true).order("name"),
      supabase.from("vendx_pos_revenue_config").select("*").eq("source", "loyverse").maybeSingle(),
    ]);
    setAccounts((accs as any) || []);
    setConfig(cfg || { source: "loyverse", display_name: "Loyverse POS", revenue_category: "pos_revenue", expense_category: "cogs", payment_method: "pos", cogs_payment_method: "internal" });
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const payload = {
        source: "loyverse",
        display_name: config.display_name || "Loyverse POS",
        deposit_account_id: config.deposit_account_id || null,
        expense_account_id: config.expense_account_id || null,
        revenue_category: config.revenue_category || "pos_revenue",
        revenue_subcategory: config.revenue_subcategory || null,
        expense_category: config.expense_category || "cogs",
        expense_subcategory: config.expense_subcategory || null,
        payment_method: config.payment_method || "pos",
        cogs_payment_method: config.cogs_payment_method || "internal",
        is_active: true,
      };
      const { error } = await supabase
        .from("vendx_pos_revenue_config")
        .upsert(payload, { onConflict: "source" });
      if (error) throw error;
      toast.success("POS revenue config saved");
      setConfigOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save config");
    } finally {
      setSavingConfig(false);
    }
  };

  useEffect(() => { loadReceipts(); loadConfig(); }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("loyverse-sync", { body: {} });
      if (error) throw error;
      toast.success(`Synced ${data?.processed ?? 0} receipt(s)`);
      await loadReceipts();
    } catch (e: any) {
      toast.error(e?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleFinanceSync = async () => {
    setFinanceSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("loyverse-daily-finance-sync", {
        body: { date: financeDate },
      });
      if (error) throw error;
      const r = data?.results?.[0];
      if (r) {
        toast.success(
          `${financeDate}: ${r.receipts} receipts · Revenue $${r.net_revenue.toFixed(2)} · COGS $${r.cogs.toFixed(2)} · Profit $${r.profit.toFixed(2)}`
        );
      } else {
        toast.success("Finance sync completed");
      }
    } catch (e: any) {
      toast.error(e?.message || "Finance sync failed");
    } finally {
      setFinanceSyncing(false);
    }
  };

  const openReceipt = async (r: POSReceipt) => {
    setSelected(r);
    const { data } = await supabase
      .from("vendx_pos_receipt_items")
      .select("*")
      .eq("receipt_id", r.id);
    setItems((data as ReceiptItem[]) || []);
  };

  const filtered = receipts.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [r.receipt_number, r.pos_customer_email, r.pos_customer_name, r.store_name, r.external_id]
      .some((v) => v?.toLowerCase().includes(s));
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" /> POS Receipts (Loyverse)
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Auto-syncs every 5 min. Daily revenue + COGS posts to Finance at 2am UTC (or trigger manually for any date).
            </p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <div className="flex items-center gap-2">
              <Button onClick={() => setConfigOpen(true)} size="sm" variant="outline">
                <Settings className="w-4 h-4 mr-2" /> Configure
              </Button>
              <Button onClick={handleSyncNow} disabled={syncing} size="sm">
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={financeDate}
                onChange={(e) => setFinanceDate(e.target.value)}
                className="w-[150px] h-9"
              />
              <Button onClick={handleFinanceSync} disabled={financeSyncing} size="sm" variant="secondary">
                <DollarSign className={`w-4 h-4 mr-2 ${financeSyncing ? "animate-pulse" : ""}`} />
                {financeSyncing ? "Posting..." : "Post Day to Finance"}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by receipt #, customer, email, store..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading ? <p className="text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No POS receipts yet. Click "Sync Now" to pull from Loyverse.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Receipt #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Matched</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openReceipt(r)}>
                  <TableCell className="text-sm">{formatDisplayDate(r.receipt_date)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.receipt_number || r.external_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <div className="text-sm">{r.pos_customer_name || "Guest"}</div>
                    <div className="text-xs text-muted-foreground">{r.pos_customer_email}</div>
                  </TableCell>
                  <TableCell className="font-semibold">${r.total_amount.toFixed(2)}</TableCell>
                  <TableCell>
                    {r.points_earned > 0 ? <Badge className="bg-primary/20 text-primary">+{r.points_earned} pts</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {r.user_id ? <Badge variant="outline">{r.matched_by}</Badge> : <Badge variant="secondary">unmatched</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receipt {selected?.receipt_number || selected?.external_id}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Date:</span> {formatDisplayDate(selected.receipt_date)}</div>
                <div><span className="text-muted-foreground">Store:</span> {selected.store_name || "—"}</div>
                <div><span className="text-muted-foreground">Customer:</span> {selected.pos_customer_name || "Guest"}</div>
                <div><span className="text-muted-foreground">Payment:</span> {selected.payment_method || "—"}</div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Price</TableHead><TableHead>Total</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.item_name}</TableCell>
                      <TableCell>{it.quantity}</TableCell>
                      <TableCell>${it.unit_price.toFixed(2)}</TableCell>
                      <TableCell>${it.line_total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="space-y-1 text-sm border-t pt-3">
                <div className="flex justify-between"><span>Tax</span><span>${selected.tax_total.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tip</span><span>${selected.tip_total.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Discounts</span><span>-${selected.discount_total.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-base"><span>Total</span><span>${selected.total_amount.toFixed(2)}</span></div>
                {selected.points_earned > 0 && (
                  <div className="flex justify-between text-primary font-medium"><span>Points earned</span><span>+{selected.points_earned} pts</span></div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>POS Revenue Configuration</DialogTitle>
          </DialogHeader>
          {config && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Controls where Loyverse daily revenue is deposited and where COGS is paid from when posted to Finance.
              </p>
              <div className="space-y-1.5">
                <Label>Deposit Account (revenue)</Label>
                <Select
                  value={config.deposit_account_id || "__none"}
                  onValueChange={(v) => setConfig({ ...config, deposit_account_id: v === "__none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— None (don't post to account) —</SelectItem>
                    {accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Expense Account (COGS paid from)</Label>
                <Select
                  value={config.expense_account_id || "__none"}
                  onValueChange={(v) => setConfig({ ...config, expense_account_id: v === "__none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— None —</SelectItem>
                    {accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Revenue Category</Label>
                  <Input value={config.revenue_category || ""} onChange={(e) => setConfig({ ...config, revenue_category: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Revenue Subcategory</Label>
                  <Input value={config.revenue_subcategory || ""} onChange={(e) => setConfig({ ...config, revenue_subcategory: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Expense Category</Label>
                  <Input value={config.expense_category || ""} onChange={(e) => setConfig({ ...config, expense_category: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Expense Subcategory</Label>
                  <Input value={config.expense_subcategory || ""} onChange={(e) => setConfig({ ...config, expense_subcategory: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Revenue Payment Method</Label>
                  <Input value={config.payment_method || ""} onChange={(e) => setConfig({ ...config, payment_method: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>COGS Payment Method</Label>
                  <Input value={config.cogs_payment_method || ""} onChange={(e) => setConfig({ ...config, cogs_payment_method: e.target.value })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancel</Button>
            <Button onClick={saveConfig} disabled={savingConfig}>{savingConfig ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default POSReceiptsPanel;
