import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { ChildWallet, ChildWalletForm } from "@/hooks/useWalletHierarchy";

interface CreateChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ChildWalletForm;
  onFormChange: (form: ChildWalletForm) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export const CreateChildDialog = ({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  isPending,
}: CreateChildDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
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
            onChange={(e) => onFormChange({ ...form, child_name: e.target.value })}
            placeholder="e.g., Alex"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Daily Limit ($)</Label>
            <Input
              type="number"
              value={form.daily_limit}
              onChange={(e) => onFormChange({ ...form, daily_limit: e.target.value })}
              placeholder="No limit"
            />
          </div>
          <div className="space-y-2">
            <Label>Per-Transaction Limit ($)</Label>
            <Input
              type="number"
              value={form.spending_limit_per_transaction}
              onChange={(e) => onFormChange({ ...form, spending_limit_per_transaction: e.target.value })}
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
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={onSubmit} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Create Wallet
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

interface EditChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ChildWalletForm;
  onFormChange: (form: ChildWalletForm) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export const EditChildDialog = ({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  isPending,
}: EditChildDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit Child Wallet</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Child's Name</Label>
          <Input
            value={form.child_name}
            onChange={(e) => onFormChange({ ...form, child_name: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Daily Limit ($)</Label>
            <Input
              type="number"
              value={form.daily_limit}
              onChange={(e) => onFormChange({ ...form, daily_limit: e.target.value })}
              placeholder="No limit"
            />
          </div>
          <div className="space-y-2">
            <Label>Per-Transaction Limit ($)</Label>
            <Input
              type="number"
              value={form.spending_limit_per_transaction}
              onChange={(e) => onFormChange({ ...form, spending_limit_per_transaction: e.target.value })}
              placeholder="No limit"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={onSubmit} disabled={isPending}>
          Save Changes
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedWallet: ChildWallet | null;
  parentBalance: number;
  transferAmount: string;
  onTransferAmountChange: (amount: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  direction?: "to_child" | "to_parent";
  onDirectionChange?: (direction: "to_child" | "to_parent") => void;
}

const quickAmounts = [5, 10, 20, 50];

export const TransferDialog = ({
  open,
  onOpenChange,
  selectedWallet,
  parentBalance,
  transferAmount,
  onTransferAmountChange,
  onSubmit,
  isPending,
  direction = "to_child",
  onDirectionChange,
}: TransferDialogProps) => {
  const isToChild = direction === "to_child";
  const maxAmount = isToChild ? parentBalance : (selectedWallet?.balance || 0);
  const fromLabel = isToChild ? "Your Wallet" : selectedWallet?.child_name || "Child";
  const toLabel = isToChild ? selectedWallet?.child_name || "Child" : "Your Wallet";
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Funds</DialogTitle>
          <DialogDescription>
            Move money between your wallet and {selectedWallet?.child_name || "child"}'s wallet
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Direction Toggle */}
          {onDirectionChange && (
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <Button
                variant={isToChild ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => onDirectionChange("to_child")}
              >
                Give to {selectedWallet?.child_name || "Child"}
              </Button>
              <Button
                variant={!isToChild ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => onDirectionChange("to_parent")}
                disabled={(selectedWallet?.balance || 0) <= 0}
              >
                Reclaim Funds
              </Button>
            </div>
          )}

          {/* Balance Display */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">From: {fromLabel}</span>
            <span className="font-bold">${maxAmount.toFixed(2)}</span>
          </div>

          {/* Quick Amounts */}
          <div className="flex gap-2">
            {quickAmounts.map((amt) => (
              <Button
                key={amt}
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onTransferAmountChange(amt.toString())}
                disabled={amt > maxAmount}
              >
                ${amt}
              </Button>
            ))}
          </div>

          {/* Amount Input */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={maxAmount}
                value={transferAmount}
                onChange={(e) => onTransferAmountChange(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <ArrowRight className="w-6 h-6 text-muted-foreground mt-6" />
            <div className="flex-1">
              <Label>To: {toLabel}</Label>
              <div className="h-10 flex items-center px-3 bg-muted rounded-md font-bold">
                ${(
                  (isToChild ? (selectedWallet?.balance || 0) : parentBalance) +
                  (parseFloat(transferAmount) || 0)
                ).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending || !transferAmount || parseFloat(transferAmount) <= 0 || parseFloat(transferAmount) > maxAmount}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isToChild ? "Send" : "Reclaim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
