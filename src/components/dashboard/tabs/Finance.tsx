import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign, Trash2, Edit, RefreshCw, CreditCard, Loader2, Download, TrendingUp } from "lucide-react";
import { format, subDays } from "date-fns";
import { formatDisplayDate } from "@/lib/dateUtils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line,
} from "recharts";

interface Transaction {
  id: string;
  transaction_type: string;
  category: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  division_id: string | null;
}

interface SyncedTransaction {
  id: string;
  provider: string;
  provider_transaction_id: string;
  transaction_type: string;
  category: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  customer_email: string | null;
  customer_name: string | null;
  transaction_date: string;
  synced_at: string;
  metadata: Record<string, unknown> | null;
}

interface SyncStatus {
  id: string;
  provider: string;
  last_sync_at: string | null;
  sync_status: string;
  error_message: string | null;
  transactions_synced: number;
}

const COLORS = ["hsl(var(--primary))", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];

const Finance = () => {
  const [open, setOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [formData, setFormData] = useState({
    transaction_type: "revenue",
    category: "",
    amount: 0,
    description: "",
    transaction_date: new Date().toISOString().split("T")[0],
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["financial-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });

  const { data: syncedTransactions, isLoading: syncedLoading } = useQuery({
    queryKey: ["synced-transactions", providerFilter],
    queryFn: async () => {
      let query = supabase
        .from("synced_transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .limit(100);
      
      if (providerFilter !== "all") {
        query = query.eq("provider", providerFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as SyncedTransaction[];
    },
  });

  const { data: syncStatus } = useQuery({
    queryKey: ["sync-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transaction_sync_status")
        .select("*");
      if (error) throw error;
      return data as SyncStatus[];
    },
    refetchInterval: 5000,
  });

  const { data: divisions } = useQuery({
    queryKey: ["finance-divisions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("divisions")
        .select("*")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (provider?: string) => {
      const { data, error } = await supabase.functions.invoke("sync-payment-transactions", {
        body: { provider },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["synced-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      
      if (data.stripe_error || data.paypal_error) {
        toast({
          title: "Sync Completed with Warnings",
          description: (
            <div className="space-y-1">
              <p>Synced {data.total} transactions</p>
              {data.stripe_error && <p className="text-sm text-orange-500">Stripe: {data.stripe_error}</p>}
              {data.paypal_error && <p className="text-sm text-orange-500">PayPal: {data.paypal_error}</p>}
            </div>
          ),
          variant: "default",
        });
      } else {
        toast({
          title: "Sync Complete",
          description: `Synced ${data.total} transactions (Stripe: ${data.stripe_transactions}, PayPal: ${data.paypal_transactions})`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("financial_transactions").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      toast({ title: "Success", description: "Transaction recorded successfully" });
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { error } = await supabase.from("financial_transactions").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      toast({ title: "Success", description: "Transaction updated successfully" });
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      toast({ title: "Success", description: "Transaction deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      transaction_type: "revenue",
      category: "",
      amount: 0,
      description: "",
      transaction_date: new Date().toISOString().split("T")[0],
    });
    setEditingTransaction(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      transaction_type: transaction.transaction_type,
      category: transaction.category,
      amount: transaction.amount,
      description: transaction.description || "",
      transaction_date: transaction.transaction_date,
    });
    setOpen(true);
  };

  const getStripeStatus = () => syncStatus?.find(s => s.provider === "stripe");
  const getPayPalStatus = () => syncStatus?.find(s => s.provider === "paypal");

  // Combined totals: manual + synced for accurate global picture
  const manualRevenue = transactions?.filter((t) => t.transaction_type === "revenue").reduce((sum, t) => sum + t.amount, 0) || 0;
  const manualExpenses = transactions?.filter((t) => t.transaction_type === "expense").reduce((sum, t) => sum + t.amount, 0) || 0;
  const syncedRevenue = syncedTransactions?.filter(t => t.transaction_type === "revenue" && t.amount > 0).reduce((sum, t) => sum + t.amount, 0) || 0;
  const syncedExpenses = syncedTransactions?.filter(t => t.transaction_type === "expense").reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
  const syncedWalletLoads = syncedTransactions?.filter(t => t.transaction_type === "wallet_load").reduce((sum, t) => sum + t.amount, 0) || 0;
  const totalRevenue = manualRevenue + syncedRevenue;
  const totalExpenses = manualExpenses + syncedExpenses;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0.0";

  const isSyncing = syncMutation.isPending || 
    getStripeStatus()?.sync_status === "syncing" || 
    getPayPalStatus()?.sync_status === "syncing";

  // Chart: Revenue vs Expenses by day (manual + synced combined)
  const dailyFinanceData = useMemo(() => {
    const dayMap = new Map<string, { day: string; revenue: number; expenses: number }>();
    
    const ensureDay = (day: string) => {
      if (!dayMap.has(day)) dayMap.set(day, { day, revenue: 0, expenses: 0 });
      return dayMap.get(day)!;
    };
    
    // Manual transactions
    transactions?.forEach(t => {
      const entry = ensureDay(t.transaction_date);
      if (t.transaction_type === "revenue") entry.revenue += t.amount;
      else entry.expenses += t.amount;
    });
    
    // Synced transactions (include in chart for complete picture)
    syncedTransactions?.forEach(t => {
      const day = t.transaction_date;
      const entry = ensureDay(day);
      if (t.transaction_type === "revenue" && t.amount > 0) entry.revenue += t.amount;
      else if (t.transaction_type === "expense") entry.expenses += Math.abs(t.amount);
    });

    return Array.from(dayMap.values())
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-30)
      .map(d => {
        try {
          const dateStr = d.day.includes("T") ? d.day.split("T")[0] : d.day;
          return { ...d, day: format(new Date(dateStr + "T12:00:00"), "MM/dd") };
        } catch {
          return { ...d, day: d.day.substring(0, 10) };
        }
      });
  }, [transactions, syncedTransactions]);

  // Chart: Category breakdown
  const categoryBreakdown = useMemo(() => {
    if (!transactions) return [];
    const catMap = new Map<string, number>();
    transactions.forEach(t => {
      catMap.set(t.category, (catMap.get(t.category) || 0) + t.amount);
    });
    return Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactions]);

  // Chart: Provider breakdown for synced transactions
  const providerBreakdown = useMemo(() => {
    if (!syncedTransactions) return [];
    const provMap = new Map<string, number>();
    syncedTransactions.forEach(t => {
      if (t.amount > 0) {
        const label = t.provider === "vendx_pay" ? "VendX Pay" : t.provider.charAt(0).toUpperCase() + t.provider.slice(1);
        provMap.set(label, (provMap.get(label) || 0) + t.amount);
      }
    });
    return Array.from(provMap.entries()).map(([name, value]) => ({ name, value }));
  }, [syncedTransactions]);

  // CSV Export
  const exportCSV = (type: "manual" | "synced") => {
    let csv = "";
    let filename = "";

    if (type === "manual" && transactions) {
      filename = `finance-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
      csv = "Date,Type,Category,Amount,Description\n";
      transactions.forEach(t => {
        csv += `"${t.transaction_date}","${t.transaction_type}","${t.category}",${t.amount},"${t.description || ""}"\n`;
      });
    } else if (type === "synced" && syncedTransactions) {
      filename = `synced-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
      csv = "Date,Provider,Type,Amount,Currency,Status,Customer,Description\n";
      syncedTransactions.forEach(t => {
        csv += `"${t.transaction_date}","${t.provider}","${t.transaction_type}",${t.amount},"${t.currency}","${t.status}","${t.customer_email || ""}","${t.description || ""}"\n`;
      });
    }

    if (csv) {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      toast({ title: "Exported", description: `${filename} downloaded` });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Finance & Accounting</h2>
          <p className="text-muted-foreground">Track revenue, expenses, and synced payment transactions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTransaction ? "Edit Transaction" : "New Transaction"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="transaction_type">Type</Label>
                  <Select value={formData.transaction_type} onValueChange={(v) => setFormData({ ...formData, transaction_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="transaction_date">Date</Label>
                  <Input
                    id="transaction_date"
                    type="date"
                    value={formData.transaction_date}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">{editingTransaction ? "Update" : "Add"} Transaction</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">${totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-500">${totalExpenses.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">${netProfit.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{profitMargin}%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="charts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="charts">Charts & Analytics</TabsTrigger>
          <TabsTrigger value="manual">Manual Transactions</TabsTrigger>
          <TabsTrigger value="synced">Synced Payments</TabsTrigger>
        </TabsList>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue vs Expenses Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Revenue vs Expenses (Last 30 entries)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {dailyFinanceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyFinanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Legend />
                        <Area type="monotone" dataKey="revenue" fill="#10b981" stroke="#10b981" fillOpacity={0.3} name="Revenue" />
                        <Area type="monotone" dataKey="expenses" fill="#ef4444" stroke="#ef4444" fillOpacity={0.3} name="Expenses" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">No transaction data</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {categoryBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryBreakdown}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {categoryBreakdown.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">No category data</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Provider Revenue Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Payment Provider</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {providerBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={providerBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                        <YAxis tickFormatter={(v) => `$${v}`} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">No synced data</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Net Profit Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-green-500/10 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-bold text-green-500">${totalRevenue.toLocaleString()}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-500/50" />
                  </div>
                  <div className="flex justify-between items-center p-4 bg-red-500/10 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Expenses</p>
                      <p className="text-2xl font-bold text-red-500">${totalExpenses.toLocaleString()}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-red-500/50" />
                  </div>
                  <div className="flex justify-between items-center p-4 border-2 border-primary/30 rounded-lg bg-primary/5">
                    <div>
                      <p className="text-sm text-muted-foreground">Net Profit</p>
                      <p className="text-2xl font-bold text-primary">${netProfit.toLocaleString()}</p>
                    </div>
                    <Badge className="text-lg px-4 py-1">{profitMargin}%</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="p-3 border rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Synced Revenue</p>
                      <p className="font-bold text-green-500">${syncedRevenue.toLocaleString()}</p>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Wallet Loads</p>
                      <p className="font-bold text-blue-500">${syncedWalletLoads.toLocaleString()}</p>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Expenses</p>
                      <p className="font-bold text-red-500">${syncedExpenses.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="manual">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Transactions</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportCSV("manual")}>
                <Download className="w-4 h-4 mr-2" />Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No transactions recorded</p>
                ) : (
                  transactions?.slice(0, 20).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between border-b border-border pb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-foreground">{transaction.category}</h3>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            transaction.transaction_type === "revenue" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                          }`}>
                            {transaction.transaction_type}
                          </span>
                        </div>
                        {transaction.description && (
                          <p className="text-sm text-muted-foreground mt-1">{transaction.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDisplayDate(transaction.transaction_date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className={`text-lg font-bold ${
                          transaction.transaction_type === "revenue" ? "text-green-500" : "text-red-500"
                        }`}>
                          {transaction.transaction_type === "revenue" ? "+" : "-"}${transaction.amount.toLocaleString()}
                        </p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(transaction)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(transaction.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="synced" className="space-y-4">
          {/* Sync Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Provider Sync
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Stripe Status */}
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Stripe</span>
                    <Badge variant={getStripeStatus()?.sync_status === "completed" ? "default" : 
                      getStripeStatus()?.sync_status === "syncing" ? "secondary" : 
                      getStripeStatus()?.sync_status === "error" ? "destructive" : "outline"}>
                      {getStripeStatus()?.sync_status || "idle"}
                    </Badge>
                  </div>
                  {getStripeStatus()?.last_sync_at && (
                    <p className="text-xs text-muted-foreground">
                      Last sync: {format(new Date(getStripeStatus()!.last_sync_at!), "MMM d, h:mm a")}
                    </p>
                  )}
                  {getStripeStatus()?.error_message && (
                    <p className="text-xs text-destructive">{getStripeStatus()!.error_message}</p>
                  )}
                  <Button 
                    size="sm" variant="outline" className="w-full"
                    disabled={isSyncing}
                    onClick={() => syncMutation.mutate("stripe")}
                  >
                    {getStripeStatus()?.sync_status === "syncing" ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Sync Stripe
                  </Button>
                </div>

                {/* PayPal Status */}
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">PayPal</span>
                    <Badge variant={getPayPalStatus()?.sync_status === "completed" ? "default" : 
                      getPayPalStatus()?.sync_status === "syncing" ? "secondary" : 
                      getPayPalStatus()?.sync_status === "error" ? "destructive" : "outline"}>
                      {getPayPalStatus()?.sync_status || "idle"}
                    </Badge>
                  </div>
                  {getPayPalStatus()?.last_sync_at && (
                    <p className="text-xs text-muted-foreground">
                      Last sync: {format(new Date(getPayPalStatus()!.last_sync_at!), "MMM d, h:mm a")}
                    </p>
                  )}
                  {getPayPalStatus()?.error_message && (
                    <p className="text-xs text-destructive">{getPayPalStatus()!.error_message}</p>
                  )}
                  <Button 
                    size="sm" variant="outline" className="w-full"
                    disabled={isSyncing}
                    onClick={() => syncMutation.mutate("paypal")}
                  >
                    {getPayPalStatus()?.sync_status === "syncing" ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Sync PayPal
                  </Button>
                </div>

                {/* Sync All */}
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Sync All</span>
                    <Badge variant="outline">Combined</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sync transactions from all payment providers
                  </p>
                  <Button 
                    size="sm" className="w-full"
                    disabled={isSyncing}
                    onClick={() => syncMutation.mutate(undefined)}
                  >
                    {isSyncing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Sync All Providers
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Synced Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Synced Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-500">${syncedRevenue.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Wallet Loads</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-500">${syncedWalletLoads.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-500">${syncedExpenses.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{syncedTransactions?.length || 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Synced Transactions List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Synced Transactions</CardTitle>
                <div className="flex gap-2">
                  <Select value={providerFilter} onValueChange={setProviderFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="vendx_pay">VendX Pay</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => exportCSV("synced")}>
                    <Download className="w-4 h-4 mr-2" />Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {syncedLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : syncedTransactions?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No synced transactions. Click "Sync" to import transactions.
                </p>
              ) : (
                <div className="space-y-3">
                  {syncedTransactions?.map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between border-b border-border pb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={txn.provider === "stripe" ? "default" : txn.provider === "vendx_pay" ? "outline" : "secondary"}>
                            {txn.provider === "vendx_pay" ? "VendX Pay" : txn.provider}
                          </Badge>
                          {txn.metadata && typeof txn.metadata === "object" && (txn.metadata as any).source && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {(txn.metadata as any).source}
                            </Badge>
                          )}
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            txn.transaction_type === "revenue" ? "bg-green-500/10 text-green-500" : 
                            txn.transaction_type === "wallet_load" ? "bg-blue-500/10 text-blue-500" :
                            "bg-red-500/10 text-red-500"
                          }`}>
                            {txn.transaction_type === "wallet_load" ? "wallet load" : txn.transaction_type}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {txn.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground mt-1 line-clamp-1">
                          {txn.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{format(new Date(txn.transaction_date), "MMM d, yyyy h:mm a")}</span>
                          {txn.customer_email && (
                            <>
                              <span>•</span>
                              <span>{txn.customer_email}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${
                          txn.amount >= 0 ? "text-green-500" : "text-red-500"
                        }`}>
                          {txn.amount >= 0 ? "+" : ""}${Math.abs(txn.amount).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground uppercase">{txn.currency}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Finance;
