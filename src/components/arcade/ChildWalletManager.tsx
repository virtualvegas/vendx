import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Wallet, Settings, Trash2, DollarSign, ArrowRight } from "lucide-react";
import { User } from "@supabase/supabase-js";

interface ChildWallet {
  id: string;
  child_name: string | null;
  balance: number;
  daily_limit: number | null;
  spending_limit_per_transaction: number | null;
  status: string;
  created_at: string;
}

interface ChildWalletManagerProps {
  user: User;
  parentWalletBalance: number;
  onRefresh: () => void;
}

export const ChildWalletManager = ({ user, parentWalletBalance, onRefresh }: ChildWalletManagerProps) => {
  const [childWallets, setChildWallets] = useState<ChildWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<ChildWallet | null>(null);
  const [form, setForm] = useState({
    child_name: "",
    daily_limit: "",
    spending_limit_per_transaction: "",
  });
  const [transferAmount, setTransferAmount] = useState("");
  const { toast } = useToast();

  const getOrCreateParentWallet = async (): Promise<{ id: string; balance: number } | null> => {
    const { data: existing, error } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", user.id)
      .in("wallet_type", ["standard", "guest"])
      .is("parent_wallet_id", null)
      .maybeSingle();

    if (error) throw error;
    if (existing) return existing;

    const { data: created, error: createError } = await supabase
      .from("wallets")
      .insert({ user_id: user.id, wallet_type: "standard", balance: 0 })
      .select("id, balance")
      .single();

    if (createError) {
      const maybeCode = (createError as unknown as { code?: string }).code;
      if (maybeCode === "23505") {
        const { data: refetched, error: refetchError } = await supabase
          .from("wallets")
          .select("id, balance")
          .eq("user_id", user.id)
          .in("wallet_type", ["standard", "guest"])
          .is("parent_wallet_id", null)
          .maybeSingle();
        if (refetchError) throw refetchError;
        return refetched;
      }
      throw createError;
    }

    return created;
  };

  const fetchChildWallets = async () => {
    setLoading(true);
    try {
      const parentWallet = await getOrCreateParentWallet();
      if (!parentWallet) {
        setChildWallets([]);
        return;
      }

      // Get child wallets
      const { data: children, error } = await supabase
        .from("wallets")
        .select("id, child_name, balance, daily_limit, spending_limit_per_transaction, status, created_at")
        .eq("parent_wallet_id", parentWallet.id)
        .eq("wallet_type", "child")
        .order("created_at");

      if (error) throw error;
      setChildWallets(children || []);
    } catch (error: any) {
      console.error("Error fetching child wallets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChildWallets();
  }, [user.id]);

  const handleCreateWallet = async () => {
    try {
      const parentWallet = await getOrCreateParentWallet();
      if (!parentWallet) throw new Error("Parent wallet not found");

      const { error } = await supabase
        .from("wallets")
        .insert({
          user_id: user.id, // Same user manages child wallets
          wallet_type: "child",
          parent_wallet_id: parentWallet.id,
          child_name: form.child_name || "Child",
          balance: 0,
          daily_limit: form.daily_limit ? parseFloat(form.daily_limit) : null,
          spending_limit_per_transaction: form.spending_limit_per_transaction 
            ? parseFloat(form.spending_limit_per_transaction) 
            : null,
        });

      if (error) throw error;

      toast({ title: "Child wallet created!" });
      setShowCreateDialog(false);
      setForm({ child_name: "", daily_limit: "", spending_limit_per_transaction: "" });
      fetchChildWallets();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdateWallet = async () => {
    if (!selectedWallet) return;

    try {
      const { error } = await supabase
        .from("wallets")
        .update({
          child_name: form.child_name || "Child",
          daily_limit: form.daily_limit ? parseFloat(form.daily_limit) : null,
          spending_limit_per_transaction: form.spending_limit_per_transaction 
            ? parseFloat(form.spending_limit_per_transaction) 
            : null,
        })
        .eq("id", selectedWallet.id);

      if (error) throw error;

      toast({ title: "Wallet updated!" });
      setShowEditDialog(false);
      fetchChildWallets();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleTransfer = async () => {
    if (!selectedWallet) return;
    const amount = parseFloat(transferAmount);

    if (!amount || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }

    if (amount > parentWalletBalance) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    try {
      const parentWallet = await getOrCreateParentWallet();
      if (!parentWallet) throw new Error("Parent wallet not found");

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
      await supabase
        .from("wallet_transactions")
        .insert([
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

      toast({ title: `$${amount.toFixed(2)} transferred!` });
      setShowTransferDialog(false);
      setTransferAmount("");
      fetchChildWallets();
      onRefresh();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteWallet = async (wallet: ChildWallet) => {
    if (wallet.balance > 0) {
      toast({ 
        title: "Cannot delete", 
        description: "Transfer remaining balance first", 
        variant: "destructive" 
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("wallets")
        .delete()
        .eq("id", wallet.id);

      if (error) throw error;

      toast({ title: "Child wallet deleted" });
      fetchChildWallets();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
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
          {childWallets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No child wallets yet</p>
              <p className="text-sm">Create one to let your kids pay at arcade machines</p>
            </div>
          ) : (
            <div className="space-y-3">
              {childWallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{wallet.child_name || "Child"}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {wallet.daily_limit && (
                          <span>Daily: ${wallet.daily_limit}</span>
                        )}
                        {wallet.spending_limit_per_transaction && (
                          <span>Per tx: ${wallet.spending_limit_per_transaction}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-lg font-bold">
                      ${wallet.balance.toFixed(2)}
                    </Badge>
                    <Button size="icon" variant="ghost" onClick={() => openTransfer(wallet)}>
                      <DollarSign className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(wallet)}>
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => handleDeleteWallet(wallet)}
                      disabled={wallet.balance > 0}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Child Wallet</DialogTitle>
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
            <div className="space-y-2">
              <Label>Daily Spending Limit ($)</Label>
              <Input
                type="number"
                value={form.daily_limit}
                onChange={(e) => setForm({ ...form, daily_limit: e.target.value })}
                placeholder="Leave empty for no limit"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Per Transaction ($)</Label>
              <Input
                type="number"
                value={form.spending_limit_per_transaction}
                onChange={(e) => setForm({ ...form, spending_limit_per_transaction: e.target.value })}
                placeholder="Leave empty for no limit"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateWallet}>Create Wallet</Button>
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
            <div className="space-y-2">
              <Label>Daily Spending Limit ($)</Label>
              <Input
                type="number"
                value={form.daily_limit}
                onChange={(e) => setForm({ ...form, daily_limit: e.target.value })}
                placeholder="Leave empty for no limit"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Per Transaction ($)</Label>
              <Input
                type="number"
                value={form.spending_limit_per_transaction}
                onChange={(e) => setForm({ ...form, spending_limit_per_transaction: e.target.value })}
                placeholder="Leave empty for no limit"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateWallet}>Save Changes</Button>
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
              <span className="font-bold">${parentWalletBalance.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label>Amount to Transfer</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={parentWalletBalance}
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <ArrowRight className="w-6 h-6 text-muted-foreground mt-6" />
              <div className="flex-1">
                <Label>New Child Balance</Label>
                <div className="h-10 flex items-center px-3 bg-muted rounded-md font-bold">
                  ${((selectedWallet?.balance || 0) + (parseFloat(transferAmount) || 0)).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)}>Cancel</Button>
            <Button onClick={handleTransfer}>Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
