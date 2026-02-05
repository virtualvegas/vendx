import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Wallet, Users, Plus, Settings, Trash2, DollarSign, ArrowRight, 
  AlertCircle, Loader2, Clock, Shield 
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ParentTransactionHistory from "./ParentTransactionHistory";
import GuestWalletBanner from "./GuestWalletBanner";
import WalletLoadDialog from "@/components/vendx-pay/WalletLoadDialog";

interface ChildWallet {
  id: string;
  child_name: string | null;
  balance: number;
  daily_limit: number | null;
  spending_limit_per_transaction: number | null;
  status: string;
  created_at: string;
}

interface ParentWallet {
  id: string;
  user_id: string;
  balance: number;
  wallet_type: string;
  is_guest: boolean;
  guest_expires_at: string | null;
}

export const WalletHierarchyView = () => {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<ChildWallet | null>(null);
  const [form, setForm] = useState({
    child_name: "",
    daily_limit: "",
    spending_limit_per_transaction: "",
  });
  const [transferAmount, setTransferAmount] = useState("");

  // Fetch parent wallet
  const { data: parentWallet, isLoading: parentLoading, refetch: refetchParent } = useQuery({
    queryKey: ["parent-wallet"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("wallets")
        .select("id, user_id, balance, wallet_type, is_guest, guest_expires_at")
        .eq("user_id", user.id)
        .eq("wallet_type", "standard")
        .maybeSingle();
      
      if (error) throw error;
      return data as ParentWallet | null;
    },
  });

  // Fetch child wallets
  const { data: childWallets, isLoading: childrenLoading, refetch: refetchChildren } = useQuery({
    queryKey: ["child-wallets", parentWallet?.id],
    queryFn: async () => {
      if (!parentWallet) return [];
      
      const { data, error } = await supabase
        .from("wallets")
        .select("id, child_name, balance, daily_limit, spending_limit_per_transaction, status, created_at")
        .eq("parent_wallet_id", parentWallet.id)
        .eq("wallet_type", "child")
        .order("created_at");
      
      if (error) throw error;
      return data as ChildWallet[];
    },
    enabled: !!parentWallet?.id,
  });

  // Create child wallet
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!parentWallet) throw new Error("Parent wallet not found");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("wallets").insert({
        user_id: user.id,
        wallet_type: "child",
        parent_wallet_id: parentWallet.id,
        child_name: form.child_name || "Child",
        balance: 0,
        daily_limit: form.daily_limit ? parseFloat(form.daily_limit) : null,
        spending_limit_per_transaction: form.spending_limit_per_transaction 
          ? parseFloat(form.spending_limit_per_transaction) : null,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-wallets"] });
      toast.success("Child wallet created!");
      setShowCreateDialog(false);
      setForm({ child_name: "", daily_limit: "", spending_limit_per_transaction: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Update child wallet
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWallet) return;
      
      const { error } = await supabase
        .from("wallets")
        .update({
          child_name: form.child_name || "Child",
          daily_limit: form.daily_limit ? parseFloat(form.daily_limit) : null,
          spending_limit_per_transaction: form.spending_limit_per_transaction 
            ? parseFloat(form.spending_limit_per_transaction) : null,
        })
        .eq("id", selectedWallet.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-wallets"] });
      toast.success("Wallet settings updated!");
      setShowEditDialog(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Transfer funds
  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWallet || !parentWallet) return;
      const amount = parseFloat(transferAmount);
      
      if (!amount || amount <= 0) throw new Error("Enter a valid amount");
      if (amount > parentWallet.balance) throw new Error("Insufficient balance");

      // Deduct from parent
      await supabase
        .from("wallets")
        .update({ balance: parentWallet.balance - amount })
        .eq("id", parentWallet.id);

      // Add to child
      await supabase
        .from("wallets")
        .update({ balance: selectedWallet.balance + amount })
        .eq("id", selectedWallet.id);

      // Record transactions
      await supabase.from("wallet_transactions").insert([
        {
          wallet_id: parentWallet.id,
          amount: -amount,
          transaction_type: "transfer_out",
          description: `Transfer to ${selectedWallet.child_name}`,
        },
        {
          wallet_id: selectedWallet.id,
          amount: amount,
          transaction_type: "transfer_in",
          description: "Transfer from parent wallet",
        },
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["child-wallets"] });
      queryClient.invalidateQueries({ queryKey: ["parent-child-transactions"] });
      toast.success(`Funds transferred!`);
      setShowTransferDialog(false);
      setTransferAmount("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Delete child wallet
  const deleteMutation = useMutation({
    mutationFn: async (wallet: ChildWallet) => {
      if (wallet.balance > 0) throw new Error("Transfer balance first");
      
      const { error } = await supabase.from("wallets").delete().eq("id", wallet.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-wallets"] });
      toast.success("Child wallet removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEdit = (wallet: ChildWallet) => {
    setSelectedWallet(wallet);
    setForm({
      child_name: wallet.child_name || "",
      daily_limit: wallet.daily_limit?.toString() || "",
      spending_limit_per_transaction: wallet.spending_limit_per_transaction?.toString() || "",
    });
    setShowEditDialog(true);
  };

  const openTransfer = (wallet: ChildWallet) => {
    setSelectedWallet(wallet);
    setTransferAmount("");
    setShowTransferDialog(true);
  };

  const handleUpgradeGuest = () => {
    window.location.href = "/auth?upgrade=true";
  };

  const isLoading = parentLoading || childrenLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!parentWallet) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No wallet found. Please sign in.</p>
        </CardContent>
      </Card>
    );
  }

  const totalChildBalance = childWallets?.reduce((sum, w) => sum + w.balance, 0) || 0;
  const totalBalance = parentWallet.balance + totalChildBalance;

  return (
    <div className="space-y-6">
      {/* Guest Wallet Banner */}
      {parentWallet.is_guest && (
        <GuestWalletBanner 
          expiresAt={parentWallet.guest_expires_at} 
          onUpgrade={handleUpgradeGuest}
        />
      )}

      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              My Wallet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">${parentWallet.balance.toFixed(2)}</p>
            <Button 
              size="sm" 
              className="mt-3"
              onClick={() => setLoadDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Funds
            </Button>
          </CardContent>
        </Card>

        {childWallets && childWallets.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Child Wallets ({childWallets.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">${totalChildBalance.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Combined balance</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Family Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">${totalBalance.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">All wallets combined</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="children" className="w-full">
        <TabsList>
          <TabsTrigger value="children" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Child Wallets
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Transactions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="children" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Child Wallets
                </CardTitle>
                <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Child
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {childWallets && childWallets.length > 0 ? (
                <div className="space-y-3">
                  {childWallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{wallet.child_name || "Child"}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            {wallet.daily_limit && (
                              <span className="flex items-center gap-1">
                                <Shield className="h-3 w-3" />
                                ${wallet.daily_limit}/day
                              </span>
                            )}
                            {wallet.spending_limit_per_transaction && (
                              <span>${wallet.spending_limit_per_transaction}/tx</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-lg font-bold px-3">
                          ${wallet.balance.toFixed(2)}
                        </Badge>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => openTransfer(wallet)}
                          title="Transfer Funds"
                        >
                          <DollarSign className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => openEdit(wallet)}
                          title="Settings"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => deleteMutation.mutate(wallet)}
                          disabled={wallet.balance > 0}
                          title={wallet.balance > 0 ? "Transfer balance first" : "Delete"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="font-medium">No child wallets yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create wallets for your kids with spending limits
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Child Wallet
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <ParentTransactionHistory 
            parentWalletId={parentWallet.id} 
            childWallets={childWallets || []}
          />
        </TabsContent>
      </Tabs>

      {/* Create Child Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Child Wallet</DialogTitle>
            <DialogDescription>
              Create a wallet for your child with optional spending limits
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Child's Name</Label>
              <Input
                value={form.child_name}
                onChange={(e) => setForm({ ...form, child_name: e.target.value })}
                placeholder="e.g., Alex"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Daily Limit ($)</Label>
                <Input
                  type="number"
                  value={form.daily_limit}
                  onChange={(e) => setForm({ ...form, daily_limit: e.target.value })}
                  placeholder="No limit"
                />
              </div>
              <div className="space-y-2">
                <Label>Per-Transaction Limit ($)</Label>
                <Input
                  type="number"
                  value={form.spending_limit_per_transaction}
                  onChange={(e) => setForm({ ...form, spending_limit_per_transaction: e.target.value })}
                  placeholder="No limit"
                />
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 inline mr-2" />
              Child wallets can be used at arcade machines with VendX Pay.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => createMutation.mutate()} 
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Child Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Child's Name</Label>
              <Input
                value={form.child_name}
                onChange={(e) => setForm({ ...form, child_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Daily Limit ($)</Label>
                <Input
                  type="number"
                  value={form.daily_limit}
                  onChange={(e) => setForm({ ...form, daily_limit: e.target.value })}
                  placeholder="No limit"
                />
              </div>
              <div className="space-y-2">
                <Label>Per-Transaction Limit ($)</Label>
                <Input
                  type="number"
                  value={form.spending_limit_per_transaction}
                  onChange={(e) => setForm({ ...form, spending_limit_per_transaction: e.target.value })}
                  placeholder="No limit"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer to {selectedWallet?.child_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Your Balance</span>
              <span className="font-bold">${parentWallet.balance.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label>Amount to Transfer</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={parentWallet.balance}
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <ArrowRight className="w-6 h-6 text-muted-foreground mt-6" />
              <div className="flex-1">
                <Label>New Balance</Label>
                <div className="h-10 flex items-center px-3 bg-muted rounded-md font-bold">
                  ${((selectedWallet?.balance || 0) + (parseFloat(transferAmount) || 0)).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)}>Cancel</Button>
            <Button onClick={() => transferMutation.mutate()} disabled={transferMutation.isPending}>
              {transferMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Wallet Dialog */}
      <WalletLoadDialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen} />
    </div>
  );
};

export default WalletHierarchyView;
