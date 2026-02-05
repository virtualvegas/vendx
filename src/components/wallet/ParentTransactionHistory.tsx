import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, ArrowDownLeft, Users, Wallet, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface Transaction {
  id: string;
  wallet_id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
  wallet: {
    id: string;
    child_name: string | null;
    wallet_type: string;
  };
}

interface ChildWallet {
  id: string;
  child_name: string | null;
}

interface ParentTransactionHistoryProps {
  parentWalletId: string;
  childWallets: ChildWallet[];
}

export const ParentTransactionHistory = ({ parentWalletId, childWallets }: ParentTransactionHistoryProps) => {
  const [selectedWallet, setSelectedWallet] = useState<string>("all");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["parent-child-transactions", parentWalletId, selectedWallet],
    queryFn: async () => {
      const walletIds = selectedWallet === "all" 
        ? [parentWalletId, ...childWallets.map(c => c.id)]
        : [selectedWallet];
      
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select(`
          id, wallet_id, amount, transaction_type, description, created_at,
          wallet:wallets(id, child_name, wallet_type)
        `)
        .in("wallet_id", walletIds)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as unknown as Transaction[];
    },
    enabled: !!parentWalletId,
  });

  const getWalletLabel = (tx: Transaction) => {
    if (tx.wallet.wallet_type === "standard") return "My Wallet";
    return tx.wallet.child_name || "Child";
  };

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === "transfer_in" || type === "transfer_out") {
      return <Users className="w-4 h-4 text-blue-500" />;
    }
    if (amount > 0) {
      return <ArrowDownLeft className="w-4 h-4 text-green-500" />;
    }
    return <ArrowUpRight className="w-4 h-4 text-red-500" />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Transaction History
          </CardTitle>
          <Select value={selectedWallet} onValueChange={setSelectedWallet}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Wallets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wallets</SelectItem>
              <SelectItem value={parentWalletId}>My Wallet</SelectItem>
              {childWallets.map(child => (
                <SelectItem key={child.id} value={child.id}>
                  {child.child_name || "Child"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : transactions && transactions.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.amount > 0 ? "bg-green-500/10" : "bg-red-500/10"
                    }`}>
                      {getTransactionIcon(tx.transaction_type, tx.amount)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm capitalize">
                          {tx.transaction_type.replace(/_/g, " ")}
                        </p>
                        {childWallets.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {getWalletLabel(tx)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${tx.amount > 0 ? "text-green-500" : "text-foreground"}`}>
                      {tx.amount > 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
                    </p>
                    {tx.description && (
                      <p className="text-xs text-muted-foreground max-w-[150px] truncate">
                        {tx.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No transactions yet
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default ParentTransactionHistory;
