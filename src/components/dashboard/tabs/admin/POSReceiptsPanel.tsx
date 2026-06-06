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

  const loadReceipts = async () => {
    const { data } = await supabase
      .from("vendx_pos_receipts")
      .select("*")
      .order("receipt_date", { ascending: false })
      .limit(200);
    setReceipts((data as POSReceipt[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadReceipts(); }, []);

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
            <Button onClick={handleSyncNow} disabled={syncing} size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
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
    </Card>
  );
};

export default POSReceiptsPanel;
