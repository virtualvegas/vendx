import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, DollarSign, Settings, Trash2, Shield } from "lucide-react";
import { ChildWallet } from "@/hooks/useWalletHierarchy";

interface ChildWalletCardProps {
  wallet: ChildWallet;
  onTransfer: (wallet: ChildWallet) => void;
  onEdit: (wallet: ChildWallet) => void;
  onDelete: (wallet: ChildWallet) => void;
  isDeleting?: boolean;
}

export const ChildWalletCard = ({ 
  wallet, 
  onTransfer, 
  onEdit, 
  onDelete,
  isDeleting 
}: ChildWalletCardProps) => {
  return (
    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
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
            {!wallet.daily_limit && !wallet.spending_limit_per_transaction && (
              <span className="text-destructive/70">No limits set</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-lg font-bold px-3">
          ${Number(wallet.balance).toFixed(2)}
        </Badge>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={() => onTransfer(wallet)}
          title="Transfer Funds"
        >
          <DollarSign className="w-4 h-4" />
        </Button>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={() => onEdit(wallet)}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </Button>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={() => onDelete(wallet)}
          disabled={wallet.balance > 0 || isDeleting}
          title={wallet.balance > 0 ? "Transfer balance first" : "Delete"}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChildWalletCard;
