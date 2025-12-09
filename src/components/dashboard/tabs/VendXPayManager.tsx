import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Wallet, Search, RefreshCw, DollarSign, Users, TrendingUp, AlertTriangle } from "lucide-react";

interface WalletWithProfile {
  id: string;
  user_id: string;
  balance: number;
  status: string;
  last_loaded: string | null;
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  } | null;
}

interface WalletTransaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
}

const VendXPayManager = () => {
  const [wallets, setWallets] = useState<WalletWithProfile[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWallet, setSelectedWallet] = useState<WalletWithProfile | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [stats, setStats] = useState({
    totalWallets: 0,
    totalBalance: 0,
    activeUsers: 0,
  });
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch wallets with profiles using a simpler approach
      const { data: walletsData, error: walletsError } = await supabase
        .from("wallets")
        .select("*")
        .order("created_at", { ascending: false });

      if (walletsError) throw walletsError;

      // Fetch profiles separately
      const userIds = walletsData?.map(w => w.user_id) || [];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      // Merge profiles with wallets
      const walletsWithProfiles = walletsData?.map(wallet => ({
        ...wallet,
        profiles: profilesData?.find(p => p.id === wallet.user_id) || null
      })) || [];

      setWallets(walletsWithProfiles);

      // Calculate stats
      const totalBalance = walletsWithProfiles.reduce((sum, w) => sum + Number(w.balance), 0);
      const activeUsers = walletsWithProfiles.filter(w => w.status === "active").length;

      setStats({
        totalWallets: walletsWithProfiles.length,
        totalBalance,
        activeUsers,
      });

      // Fetch recent transactions
      const { data: txData } = await supabase
        .from("wallet_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      setTransactions(txData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load wallet data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdjustBalance = async () => {
    if (!selectedWallet || !adjustmentAmount) return;

    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount)) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid number",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update wallet balance
      const newBalance = Number(selectedWallet.balance) + amount;
      const { error: updateError } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("id", selectedWallet.id);

      if (updateError) throw updateError;

      // Create transaction record
      const { error: txError } = await supabase
        .from("wallet_transactions")
        .insert({
          wallet_id: selectedWallet.id,
          amount,
          transaction_type: amount > 0 ? "adjustment_credit" : "adjustment_debit",
          description: adjustmentReason || "Manual adjustment",
        });

      if (txError) throw txError;

      toast({
        title: "Balance adjusted",
        description: `${amount > 0 ? "Added" : "Removed"} $${Math.abs(amount).toFixed(2)} ${amount > 0 ? "to" : "from"} wallet`,
      });

      setShowAdjustDialog(false);
      setAdjustmentAmount("");
      setAdjustmentReason("");
      setSelectedWallet(null);
      fetchData();
    } catch (error) {
      console.error("Error adjusting balance:", error);
      toast({
        title: "Error",
        description: "Failed to adjust balance",
        variant: "destructive",
      });
    }
  };

  const toggleWalletStatus = async (wallet: WalletWithProfile) => {
    const newStatus = wallet.status === "active" ? "frozen" : "active";
    try {
      const { error } = await supabase
        .from("wallets")
        .update({ status: newStatus })
        .eq("id", wallet.id);

      if (error) throw error;

      toast({
        title: `Wallet ${newStatus}`,
        description: `Wallet has been ${newStatus === "active" ? "unfrozen" : "frozen"}`,
      });

      fetchData();
    } catch (error) {
      console.error("Error updating wallet status:", error);
      toast({
        title: "Error",
        description: "Failed to update wallet status",
        variant: "destructive",
      });
    }
  };

  const filteredWallets = wallets.filter(
    (w) =>
      w.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6 text-primary" />
          VendX Pay Manager
        </h2>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/20">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Wallets</p>
                <p className="text-2xl font-bold">{stats.totalWallets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/20">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Balance</p>
                <p className="text-2xl font-bold">${stats.totalBalance.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-accent/20">
                <TrendingUp className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">{stats.activeUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search by email or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Wallets Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Wallets</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Loaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWallets.map((wallet) => (
                <TableRow key={wallet.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{wallet.profiles?.full_name || "N/A"}</p>
                      <p className="text-sm text-muted-foreground">{wallet.profiles?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono font-bold">
                    ${Number(wallet.balance).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={wallet.status === "active" ? "default" : "destructive"}>
                      {wallet.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {wallet.last_loaded
                      ? new Date(wallet.last_loaded).toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedWallet(wallet);
                          setShowAdjustDialog(true);
                        }}
                      >
                        Adjust
                      </Button>
                      <Button
                        size="sm"
                        variant={wallet.status === "active" ? "destructive" : "default"}
                        onClick={() => toggleWalletStatus(wallet)}
                      >
                        {wallet.status === "active" ? "Freeze" : "Unfreeze"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
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
              {transactions.slice(0, 20).map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="capitalize">{tx.transaction_type.replace("_", " ")}</TableCell>
                  <TableCell className={tx.amount > 0 ? "text-green-500" : "text-red-500"}>
                    {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{tx.description || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Adjustment Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Wallet Balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">User</p>
              <p className="font-medium">{selectedWallet?.profiles?.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="font-bold text-xl">${Number(selectedWallet?.balance || 0).toFixed(2)}</p>
            </div>
            <div className="space-y-2">
              <Label>Adjustment Amount</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Enter amount (positive to add, negative to remove)"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                placeholder="Enter reason for adjustment"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjustBalance}>
              Apply Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendXPayManager;
