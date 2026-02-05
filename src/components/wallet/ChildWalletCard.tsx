import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Wallet, DollarSign, Settings, Trash2, Shield, ChevronDown, Clock, Gamepad2 } from "lucide-react";
import { ChildWallet } from "@/hooks/useWalletHierarchy";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
  const [isOpen, setIsOpen] = useState(false);

  const { data: recentActivity } = useQuery({
    queryKey: ["child-activity", wallet.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("id, amount, transaction_type, description, created_at")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  const { data: todaySpent } = useQuery({
    queryKey: ["child-today-spent", wallet.id],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("amount")
        .eq("wallet_id", wallet.id)
        .lt("amount", 0)
        .gte("created_at", today.toISOString());
      
      if (error) throw error;
      return data.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    },
  });

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border">
        <div className="flex items-center justify-between p-4">
          <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{wallet.child_name || "Child"}</p>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                {wallet.daily_limit && (
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    ${todaySpent?.toFixed(2) || "0.00"} / ${wallet.daily_limit}/day
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
          </CollapsibleTrigger>
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

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Activity
              </h4>
              {recentActivity && recentActivity.length > 0 ? (
                <div className="space-y-2">
                  {recentActivity.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Gamepad2 className="h-3 w-3 text-muted-foreground" />
                        <span className="capitalize text-muted-foreground">
                          {tx.transaction_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(tx.created_at), "MMM d, h:mm a")}
                        </span>
                        <span className={tx.amount > 0 ? "text-primary font-medium" : "font-medium"}>
                          {tx.amount > 0 ? "+" : ""}${tx.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activity yet
                </p>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default ChildWalletCard;
