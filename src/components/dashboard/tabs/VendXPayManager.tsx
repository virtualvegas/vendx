import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Search, RefreshCw, DollarSign, Users, TrendingUp, Shield, Baby, UserCheck, CreditCard, ArrowUpDown } from "lucide-react";
import { formatDisplayDate } from "@/lib/dateUtils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { format, subDays } from "date-fns";

const COLORS = ["hsl(var(--primary))", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];

interface WalletWithProfile {
  id: string;
  user_id: string;
  balance: number;
  status: string;
  wallet_type: string;
  parent_wallet_id: string | null;
  daily_limit: number | null;
  spending_limit_per_transaction: number | null;
  is_guest: boolean;
  last_loaded: string | null;
  created_at: string;
  child_name: string | null;
  profiles: {
    email: string;
    full_name: string | null;
  } | null;
}

interface WalletTransaction {
  id: string;
  wallet_id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
}

interface RewardsInfo {
  user_id: string;
  balance: number;
  lifetime_points: number;
  tier: string;
}

const VendXPayManager = () => {
  const [wallets, setWallets] = useState<WalletWithProfile[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [rewardsData, setRewardsData] = useState<RewardsInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [walletTypeFilter, setWalletTypeFilter] = useState("all");
  const [selectedWallet, setSelectedWallet] = useState<WalletWithProfile | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showWalletDetail, setShowWalletDetail] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all wallets
      const { data: walletsData, error: walletsError } = await supabase
        .from("wallets")
        .select("*")
        .order("created_at", { ascending: false });

      if (walletsError) throw walletsError;

      // Fetch profiles
      const userIds = [...new Set(walletsData?.map(w => w.user_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const walletsWithProfiles: WalletWithProfile[] = walletsData?.map(wallet => ({
        ...wallet,
        profiles: profilesData?.find(p => p.id === wallet.user_id) || null,
      })) || [];

      setWallets(walletsWithProfiles);

      // Fetch recent transactions (last 100)
      const { data: txData } = await supabase
        .from("wallet_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      setTransactions(txData || []);

      // Fetch rewards data
      const { data: rwData } = await supabase
        .from("rewards_points")
        .select("user_id, balance, lifetime_points, tier");

      setRewardsData(rwData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error", description: "Failed to load wallet data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Stats
  const stats = useMemo(() => {
    const parentWallets = wallets.filter(w => !w.parent_wallet_id);
    const childWallets = wallets.filter(w => w.parent_wallet_id);
    const guestWallets = wallets.filter(w => w.is_guest);
    const standardWallets = wallets.filter(w => w.wallet_type === "standard" && !w.parent_wallet_id);
    const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance), 0);
    const activeWallets = wallets.filter(w => w.status === "active").length;
    const frozenWallets = wallets.filter(w => w.status === "frozen").length;

    return {
      totalWallets: wallets.length,
      parentWallets: parentWallets.length,
      childWallets: childWallets.length,
      guestWallets: guestWallets.length,
      standardWallets: standardWallets.length,
      totalBalance,
      activeWallets,
      frozenWallets,
    };
  }, [wallets]);

  // Tier distribution
  const tierDistribution = useMemo(() => {
    const tiers: Record<string, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    rewardsData.forEach(r => { tiers[r.tier] = (tiers[r.tier] || 0) + 1; });
    return Object.entries(tiers).map(([name, value]) => ({ name, value }));
  }, [rewardsData]);

  // Transaction volume by day (last 14 days)
  const dailyVolume = useMemo(() => {
    const days = new Map<string, { loads: number; spends: number; count: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      days.set(d, { loads: 0, spends: 0, count: 0 });
    }
    transactions.forEach(tx => {
      const d = format(new Date(tx.created_at), "yyyy-MM-dd");
      const entry = days.get(d);
      if (entry) {
        entry.count++;
        if (tx.amount > 0) entry.loads += tx.amount;
        else entry.spends += Math.abs(tx.amount);
      }
    });
    return Array.from(days.entries()).map(([day, v]) => ({
      day: format(new Date(day + "T12:00:00"), "MM/dd"),
      loads: Math.round(v.loads * 100) / 100,
      spends: Math.round(v.spends * 100) / 100,
      count: v.count,
    }));
  }, [transactions]);

  // Wallet type distribution
  const walletTypeDistribution = useMemo(() => [
    { name: "Standard", value: stats.standardWallets },
    { name: "Child", value: stats.childWallets },
    { name: "Guest", value: stats.guestWallets },
  ].filter(d => d.value > 0), [stats]);

  // Transaction type breakdown
  const txTypeBreakdown = useMemo(() => {
    const types: Record<string, number> = {};
    transactions.forEach(tx => {
      const t = tx.transaction_type.replace(/_/g, " ");
      types[t] = (types[t] || 0) + 1;
    });
    return Object.entries(types)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactions]);

  const filteredWallets = useMemo(() => {
    return wallets.filter(w => {
      const matchesSearch = !searchTerm ||
        w.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.child_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = walletTypeFilter === "all" ||
        (walletTypeFilter === "standard" && w.wallet_type === "standard" && !w.parent_wallet_id) ||
        (walletTypeFilter === "child" && w.wallet_type === "child") ||
        (walletTypeFilter === "guest" && w.is_guest) ||
        (walletTypeFilter === "frozen" && w.status === "frozen");
      return matchesSearch && matchesType;
    });
  }, [wallets, searchTerm, walletTypeFilter]);

  const handleAdjustBalance = async () => {
    if (!selectedWallet || !adjustmentAmount) return;
    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount)) {
      toast({ title: "Invalid amount", description: "Please enter a valid number", variant: "destructive" });
      return;
    }
    try {
      const newBalance = Number(selectedWallet.balance) + amount;
      const { error: updateError } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("id", selectedWallet.id);
      if (updateError) throw updateError;

      const { error: txError } = await supabase
        .from("wallet_transactions")
        .insert({
          wallet_id: selectedWallet.id,
          amount,
          transaction_type: amount > 0 ? "adjustment_credit" : "adjustment_debit",
          description: adjustmentReason || "Admin manual adjustment",
        });
      if (txError) throw txError;

      toast({ title: "Balance adjusted", description: `${amount > 0 ? "Added" : "Removed"} $${Math.abs(amount).toFixed(2)}` });
      setShowAdjustDialog(false);
      setAdjustmentAmount("");
      setAdjustmentReason("");
      setSelectedWallet(null);
      fetchData();
    } catch (error) {
      console.error("Error adjusting balance:", error);
      toast({ title: "Error", description: "Failed to adjust balance", variant: "destructive" });
    }
  };

  const toggleWalletStatus = async (wallet: WalletWithProfile) => {
    const newStatus = wallet.status === "active" ? "frozen" : "active";
    try {
      const { error } = await supabase.from("wallets").update({ status: newStatus }).eq("id", wallet.id);
      if (error) throw error;
      toast({ title: `Wallet ${newStatus}`, description: `Wallet has been ${newStatus === "active" ? "unfrozen" : "frozen"}` });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update wallet status", variant: "destructive" });
    }
  };

  const viewWalletDetail = async (wallet: WalletWithProfile) => {
    setSelectedWallet(wallet);
    const { data } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("wallet_id", wallet.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setWalletTransactions(data || []);
    setShowWalletDetail(true);
  };

  const getWalletTypeBadge = (w: WalletWithProfile) => {
    if (w.wallet_type === "child") return <Badge variant="secondary"><Baby className="w-3 h-3 mr-1" />Child</Badge>;
    if (w.is_guest) return <Badge variant="outline"><UserCheck className="w-3 h-3 mr-1" />Guest</Badge>;
    return <Badge><Wallet className="w-3 h-3 mr-1" />Standard</Badge>;
  };

  const getUserRewards = (userId: string) => rewardsData.find(r => r.user_id === userId);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6 text-primary" />
          VendX Pay Manager
        </h2>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/20"><Users className="w-4 h-4 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Wallets</p>
                <p className="text-xl font-bold">{stats.totalWallets}</p>
                <p className="text-[10px] text-muted-foreground">{stats.standardWallets} std · {stats.childWallets} child · {stats.guestWallets} guest</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/20"><DollarSign className="w-4 h-4 text-green-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Balance</p>
                <p className="text-xl font-bold text-green-500">${stats.totalBalance.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-accent/20"><TrendingUp className="w-4 h-4 text-accent" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-xl font-bold">{stats.activeWallets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/20"><Shield className="w-4 h-4 text-destructive" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Frozen</p>
                <p className="text-xl font-bold">{stats.frozenWallets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">Daily Volume (14 Days)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="loads" fill="#10b981" radius={[2, 2, 0, 0]} name="Loads" />
                  <Bar dataKey="spends" fill="#ef4444" radius={[2, 2, 0, 0]} name="Spends" />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Wallet Types</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[100px]">
                {walletTypeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={walletTypeDistribution} cx="50%" cy="50%" outerRadius={40} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {walletTypeDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground text-sm">No data</p>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Tier Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[100px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tierDistribution} cx="50%" cy="50%" outerRadius={40} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {tierDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input placeholder="Search by email, name, or child label..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={walletTypeFilter} onValueChange={setWalletTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Wallets</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="child">Child</SelectItem>
            <SelectItem value="guest">Guest</SelectItem>
            <SelectItem value="frozen">Frozen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Wallets Table */}
      <Card>
        <CardHeader><CardTitle>Wallets ({filteredWallets.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWallets.slice(0, 50).map((wallet) => {
                const rewards = getUserRewards(wallet.user_id);
                return (
                  <TableRow key={wallet.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{wallet.child_name || wallet.profiles?.full_name || "N/A"}</p>
                        <p className="text-xs text-muted-foreground">{wallet.profiles?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getWalletTypeBadge(wallet)}</TableCell>
                    <TableCell className="font-mono font-bold">${Number(wallet.balance).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {wallet.daily_limit ? <span>Daily: ${wallet.daily_limit}</span> : "-"}
                      {wallet.spending_limit_per_transaction && <><br />Per txn: ${wallet.spending_limit_per_transaction}</>}
                    </TableCell>
                    <TableCell>
                      {rewards && !wallet.parent_wallet_id ? (
                        <Badge variant="outline" className="capitalize">{rewards.tier}</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={wallet.status === "active" ? "default" : "destructive"}>{wallet.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => viewWalletDetail(wallet)}>View</Button>
                        <Button size="sm" variant="outline" onClick={() => { setSelectedWallet(wallet); setShowAdjustDialog(true); }}>Adjust</Button>
                        <Button size="sm" variant={wallet.status === "active" ? "destructive" : "default"} onClick={() => toggleWalletStatus(wallet)}>
                          {wallet.status === "active" ? "Freeze" : "Unfreeze"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filteredWallets.length > 50 && <p className="text-center text-sm text-muted-foreground mt-4">Showing 50 of {filteredWallets.length} wallets</p>}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader><CardTitle>Recent Transactions (All Wallets)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.slice(0, 30).map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell><Badge variant="outline" className="capitalize text-xs">{tx.transaction_type.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className={tx.amount > 0 ? "text-green-500 font-mono" : "text-red-500 font-mono"}>
                    {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">{tx.description || "-"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDisplayDate(tx.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Adjustment Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Wallet Balance</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">User</p>
              <p className="font-medium">{selectedWallet?.child_name || selectedWallet?.profiles?.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="font-bold text-xl">${Number(selectedWallet?.balance || 0).toFixed(2)}</p>
            </div>
            <div className="space-y-2">
              <Label>Adjustment Amount</Label>
              <Input type="number" step="0.01" placeholder="Positive to add, negative to remove" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input placeholder="Enter reason for adjustment" value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>Cancel</Button>
            <Button onClick={handleAdjustBalance}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wallet Detail Dialog */}
      <Dialog open={showWalletDetail} onOpenChange={setShowWalletDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Wallet Details</DialogTitle></DialogHeader>
          {selectedWallet && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">User</p>
                  <p className="font-medium">{selectedWallet.child_name || selectedWallet.profiles?.full_name || selectedWallet.profiles?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  {getWalletTypeBadge(selectedWallet)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="text-xl font-bold">${Number(selectedWallet.balance).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={selectedWallet.status === "active" ? "default" : "destructive"}>{selectedWallet.status}</Badge>
                </div>
                {selectedWallet.daily_limit && (
                  <div>
                    <p className="text-xs text-muted-foreground">Daily Limit</p>
                    <p>${selectedWallet.daily_limit}</p>
                  </div>
                )}
                {selectedWallet.spending_limit_per_transaction && (
                  <div>
                    <p className="text-xs text-muted-foreground">Per-Transaction Limit</p>
                    <p>${selectedWallet.spending_limit_per_transaction}</p>
                  </div>
                )}
                {selectedWallet.parent_wallet_id && (
                  <div>
                    <p className="text-xs text-muted-foreground">Parent Wallet</p>
                    <p className="text-sm font-mono">{selectedWallet.parent_wallet_id.substring(0, 8)}…</p>
                  </div>
                )}
                {(() => {
                  const rewards = getUserRewards(selectedWallet.user_id);
                  return rewards ? (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Rewards Tier</p>
                        <Badge variant="outline" className="capitalize">{rewards.tier}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Points</p>
                        <p>{rewards.balance.toLocaleString()} ({rewards.lifetime_points.toLocaleString()} lifetime)</p>
                      </div>
                    </>
                  ) : null;
                })()}
              </div>

              <div>
                <p className="font-semibold mb-2">Transaction History</p>
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {walletTransactions.map(tx => (
                        <TableRow key={tx.id}>
                          <TableCell className="capitalize text-xs">{tx.transaction_type.replace(/_/g, " ")}</TableCell>
                          <TableCell className={tx.amount > 0 ? "text-green-500 font-mono" : "text-red-500 font-mono"}>
                            {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{tx.description || "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDisplayDate(tx.created_at)}</TableCell>
                        </TableRow>
                      ))}
                      {walletTransactions.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No transactions</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendXPayManager;
