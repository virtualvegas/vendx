import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Users, Plus, Clock, Loader2 } from "lucide-react";
import { useWalletHierarchy, ChildWallet, ChildWalletForm } from "@/hooks/useWalletHierarchy";
import ParentTransactionHistory from "./ParentTransactionHistory";
import GuestWalletBanner from "./GuestWalletBanner";
import WalletLoadDialog from "@/components/vendx-pay/WalletLoadDialog";
import ChildWalletCard from "./ChildWalletCard";
import { CreateChildDialog, EditChildDialog, TransferDialog } from "./WalletDialogs";

const emptyForm: ChildWalletForm = {
  child_name: "",
  daily_limit: "",
  spending_limit_per_transaction: "",
};

export const WalletHierarchyView = () => {
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
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<ChildWallet | null>(null);
  const [form, setForm] = useState<ChildWalletForm>(emptyForm);
  const [transferAmount, setTransferAmount] = useState("");

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

  const handleCreate = () => {
    createChildWallet.mutate(form, {
      onSuccess: () => {
        setShowCreateDialog(false);
        setForm(emptyForm);
      },
    });
  };

  const handleUpdate = () => {
    if (!selectedWallet) return;
    updateChildWallet.mutate({ walletId: selectedWallet.id, form }, {
      onSuccess: () => {
        setShowEditDialog(false);
      },
    });
  };

  const handleTransfer = () => {
    if (!selectedWallet) return;
    const amount = parseFloat(transferAmount);
    transferFunds.mutate({ childWallet: selectedWallet, amount }, {
      onSuccess: () => {
        setShowTransferDialog(false);
        setTransferAmount("");
      },
    });
  };

  const handleUpgradeGuest = () => {
    window.location.href = "/auth?upgrade=true";
  };

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
            <p className="text-3xl font-bold">${Number(parentWallet.balance).toFixed(2)}</p>
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

        {childWallets.length > 0 && (
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
                <Button size="sm" onClick={() => {
                  setForm(emptyForm);
                  setShowCreateDialog(true);
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Child
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {childWallets.length > 0 ? (
                <div className="space-y-3">
                  {childWallets.map((wallet) => (
                    <ChildWalletCard
                      key={wallet.id}
                      wallet={wallet}
                      onTransfer={openTransfer}
                      onEdit={openEdit}
                      onDelete={(w) => deleteChildWallet.mutate(w)}
                      isDeleting={deleteChildWallet.isPending}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="font-medium">No child wallets yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create wallets for your kids with spending limits
                  </p>
                  <Button onClick={() => {
                    setForm(emptyForm);
                    setShowCreateDialog(true);
                  }}>
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
      />

      {/* Load Wallet Dialog */}
      <WalletLoadDialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen} />
    </div>
  );
};

export default WalletHierarchyView;
