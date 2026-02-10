import { useState } from "react";
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
import { Plus, DollarSign, Trash2, Edit, RefreshCw, CreditCard, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { formatDisplayDate } from "@/lib/dateUtils";

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
    refetchInterval: 5000, // Refresh every 5 seconds to check sync status
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
      
      // Show success with any warnings
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

  const totalRevenue = transactions?.filter((t) => t.transaction_type === "revenue").reduce((sum, t) => sum + t.amount, 0) || 0;
  const totalExpenses = transactions?.filter((t) => t.transaction_type === "expense").reduce((sum, t) => sum + t.amount, 0) || 0;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0.0";

  const syncedRevenue = syncedTransactions?.filter(t => t.transaction_type === "revenue").reduce((sum, t) => sum + t.amount, 0) || 0;
  const syncedRefunds = syncedTransactions?.filter(t => t.transaction_type === "refund").reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
  const syncedWalletLoads = syncedTransactions?.filter(t => t.transaction_type === "wallet_load").reduce((sum, t) => sum + t.amount, 0) || 0;

  const isSyncing = syncMutation.isPending || 
    getStripeStatus()?.sync_status === "syncing" || 
    getPayPalStatus()?.sync_status === "syncing";

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

      <Tabs defaultValue="manual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="manual">Manual Transactions</TabsTrigger>
          <TabsTrigger value="synced">Synced Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
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
                    size="sm" 
                    variant="outline" 
                    className="w-full"
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
                    size="sm" 
                    variant="outline" 
                    className="w-full"
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
                    size="sm" 
                    className="w-full"
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Refunds</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-500">${syncedRefunds.toLocaleString()}</p>
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