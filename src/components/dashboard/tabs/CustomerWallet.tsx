import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  KeyRound,
  Clock,
  Copy,
  Check,
  Users,
  Plus,
  ArrowRightLeft,
  Ticket,
} from "lucide-react";
import WalletLoadDialog from "@/components/vendx-pay/WalletLoadDialog";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWalletHierarchy, ChildWalletForm } from "@/hooks/useWalletHierarchy";
import { ChildWalletCard, GuestWalletBanner, ParentTransactionHistory, TicketBalanceCard } from "@/components/wallet";
import { CreateChildDialog, EditChildDialog, TransferDialog } from "@/components/wallet/WalletDialogs";
import type { ChildWallet as ChildWalletType } from "@/hooks/useWalletHierarchy";

const emptyForm: ChildWalletForm = {
  child_name: "",
  daily_limit: "",
  spending_limit_per_transaction: "",
};

const CustomerWallet = () => {
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [currentCode, setCurrentCode] = useState<string>("------");
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [copied, setCopied] = useState(false);
  const [hasTotp, setHasTotp] = useState(false);
  const { toast } = useToast();
  const TIME_STEP = 60;

  const {
    parentWallet,
    childWallets,
    isLoading,
    totalChildBalance,
    totalBalance,
    createChildWallet,
    updateChildWallet,
    transferFunds,
    deleteChildWallet,
  } = useWalletHierarchy();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<ChildWalletType | null>(null);
  const [form, setForm] = useState<ChildWalletForm>(emptyForm);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDirection, setTransferDirection] = useState<"to_child" | "to_parent">("to_child");

  // TOTP code fetching
  const fetchCode = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("totp-generate-code");
      if (error) throw error;
      if (data?.code) {
        setCurrentCode(data.code);
        setTimeRemaining(data.time_remaining || TIME_STEP);
        setHasTotp(true);
      }
    } catch (error) {
      console.error("Error fetching TOTP code:", error);
    }
  }, []);

  useEffect(() => { fetchCode(); }, [fetchCode]);

  useEffect(() => {
    if (!hasTotp) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) { fetchCode(); return TIME_STEP; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [hasTotp, fetchCode]);

  const copyCode = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    toast({ title: "Code Copied", description: "Payment code copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const getProgressColor = () => {
    if (timeRemaining <= 10) return "text-destructive";
    if (timeRemaining <= 20) return "text-amber-500";
    return "text-primary";
  };

  // Child wallet handlers
  const openEdit = (wallet: ChildWalletType) => {
    setSelectedWallet(wallet);
    setForm({
      child_name: wallet.child_name || "",
      daily_limit: wallet.daily_limit?.toString() || "",
      spending_limit_per_transaction: wallet.spending_limit_per_transaction?.toString() || "",
    });
    setShowEditDialog(true);
  };

  const openTransfer = (wallet: ChildWalletType) => {
    setSelectedWallet(wallet);
    setTransferAmount("");
    setTransferDirection("to_child");
    setShowTransferDialog(true);
  };

  const handleCreate = () => {
    createChildWallet.mutate(form, {
      onSuccess: () => { setShowCreateDialog(false); setForm(emptyForm); },
    });
  };

  const handleUpdate = () => {
    if (!selectedWallet) return;
    updateChildWallet.mutate({ walletId: selectedWallet.id, form }, {
      onSuccess: () => setShowEditDialog(false),
    });
  };

  const handleTransfer = () => {
    if (!selectedWallet) return;
    transferFunds.mutate(
      { childWallet: selectedWallet, amount: parseFloat(transferAmount), direction: transferDirection },
      { onSuccess: () => { setShowTransferDialog(false); setTransferAmount(""); } }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!parentWallet) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No wallet found. Please sign in.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Guest Banner */}
      {parentWallet.is_guest && (
        <GuestWalletBanner
          expiresAt={parentWallet.guest_expires_at}
          onUpgrade={() => (window.location.href = "/auth?upgrade=true")}
        />
      )}

      {/* Balance Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Main Balance */}
        <Card className="relative overflow-hidden border-primary/20">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5 pointer-events-none" />
          <CardContent className="p-5 relative">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Wallet className="h-4 w-4 text-primary" />
              My Balance
            </div>
            <p className="text-3xl font-bold text-foreground tracking-tight">
              ${Number(parentWallet.balance).toFixed(2)}
            </p>
            <Button
              size="sm"
              className="mt-3 w-full"
              onClick={() => setLoadDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Funds
            </Button>
          </CardContent>
        </Card>

        {/* Child Wallets Summary */}
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="h-4 w-4" />
              Child Wallets
            </div>
            <p className="text-3xl font-bold text-foreground tracking-tight">
              {childWallets.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ${totalChildBalance.toFixed(2)} combined
            </p>
          </CardContent>
        </Card>

        {/* Total Family */}
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <ArrowRightLeft className="h-4 w-4" />
              Total Balance
            </div>
            <p className="text-3xl font-bold text-primary tracking-tight">
              ${totalBalance.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">All wallets combined</p>
          </CardContent>
        </Card>

        {/* Tickets */}
        <TicketBalanceCard />
      </div>

      {/* Payment Code Banner – always visible */}
      <Card className="border-primary/20 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-4 p-5">
          <div className="flex items-center gap-3 flex-1">
            <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Machine Payment Code</p>
              <p className="text-xs text-muted-foreground">Enter this at any VendX machine</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-lg bg-muted/60 border border-border">
              <p className="text-2xl font-mono font-bold tracking-[0.15em] text-foreground">
                {currentCode}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={copyCode} className="shrink-0">
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${(timeRemaining / TIME_STEP) * 100}%` }}
              />
            </div>
            <span className={`text-xs font-medium tabular-nums ${getProgressColor()}`}>
              {timeRemaining}s
            </span>
          </div>
        </div>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="family" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Family
          </TabsTrigger>
        </TabsList>

        {/* Family / Child Wallets Tab */}
        <TabsContent value="family" className="mt-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Child Wallets</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Create wallets for your kids with spending limits
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => { setForm(emptyForm); setShowCreateDialog(true); }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Child
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {childWallets.length > 0 ? (
                <div className="space-y-3">
                  {childWallets.map((w) => (
                    <ChildWalletCard
                      key={w.id}
                      wallet={w}
                      onTransfer={openTransfer}
                      onEdit={openEdit}
                      onDelete={(cw) => deleteChildWallet.mutate(cw)}
                      isDeleting={deleteChildWallet.isPending}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="font-medium text-sm">No child wallets yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Set spending limits and manage funds for your kids
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setForm(emptyForm); setShowCreateDialog(true); }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Create First Wallet
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="mt-4">
          <ParentTransactionHistory
            parentWalletId={parentWallet.id}
            childWallets={childWallets}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateChildDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        form={form}
        onFormChange={setForm}
        onSubmit={handleCreate}
        isPending={createChildWallet.isPending}
      />
      <EditChildDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        form={form}
        onFormChange={setForm}
        onSubmit={handleUpdate}
        isPending={updateChildWallet.isPending}
      />
      <TransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        selectedWallet={selectedWallet}
        parentBalance={parentWallet.balance}
        transferAmount={transferAmount}
        onTransferAmountChange={setTransferAmount}
        onSubmit={handleTransfer}
        isPending={transferFunds.isPending}
        direction={transferDirection}
        onDirectionChange={setTransferDirection}
      />
      <WalletLoadDialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen} />
    </div>
  );
};

export default CustomerWallet;
