import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ChildWallet {
  id: string;
  child_name: string | null;
  balance: number;
  daily_limit: number | null;
  spending_limit_per_transaction: number | null;
  status: string;
  created_at: string;
}

export interface ParentWallet {
  id: string;
  user_id: string;
  balance: number;
  wallet_type: string;
  is_guest: boolean;
  guest_expires_at: string | null;
}

export interface ChildWalletForm {
  child_name: string;
  daily_limit: string;
  spending_limit_per_transaction: string;
}

export const useWalletHierarchy = () => {
  const queryClient = useQueryClient();

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
  const createChildWallet = useMutation({
    mutationFn: async (form: ChildWalletForm) => {
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
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Update child wallet
  const updateChildWallet = useMutation({
    mutationFn: async ({ walletId, form }: { walletId: string; form: ChildWalletForm }) => {
      const { error } = await supabase
        .from("wallets")
        .update({
          child_name: form.child_name || "Child",
          daily_limit: form.daily_limit ? parseFloat(form.daily_limit) : null,
          spending_limit_per_transaction: form.spending_limit_per_transaction 
            ? parseFloat(form.spending_limit_per_transaction) : null,
        })
        .eq("id", walletId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-wallets"] });
      toast.success("Wallet settings updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Transfer funds (supports both directions)
  const transferFunds = useMutation({
    mutationFn: async ({ 
      childWallet, 
      amount, 
      direction = "to_child" 
    }: { 
      childWallet: ChildWallet; 
      amount: number; 
      direction?: "to_child" | "to_parent";
    }) => {
      if (!parentWallet) throw new Error("Parent wallet not found");
      
      if (!amount || amount <= 0) throw new Error("Enter a valid amount");
      
      const isToChild = direction === "to_child";
      const sourceBalance = isToChild ? parentWallet.balance : childWallet.balance;
      
      if (amount > sourceBalance) throw new Error("Insufficient balance");

      // Deduct from source
      const { error: sourceError } = await supabase
        .from("wallets")
        .update({ balance: sourceBalance - amount })
        .eq("id", isToChild ? parentWallet.id : childWallet.id);

      if (sourceError) throw sourceError;

      // Add to destination
      const destBalance = isToChild ? childWallet.balance : parentWallet.balance;
      const { error: destError } = await supabase
        .from("wallets")
        .update({ balance: destBalance + amount })
        .eq("id", isToChild ? childWallet.id : parentWallet.id);

      if (destError) throw destError;

      // Record transactions
      const { error: txError } = await supabase.from("wallet_transactions").insert([
        {
          wallet_id: isToChild ? parentWallet.id : childWallet.id,
          amount: -amount,
          transaction_type: isToChild ? "transfer_out" : "reclaim_out",
          description: isToChild 
            ? `Transfer to ${childWallet.child_name}` 
            : `Reclaimed from ${childWallet.child_name}`,
        },
        {
          wallet_id: isToChild ? childWallet.id : parentWallet.id,
          amount: amount,
          transaction_type: isToChild ? "transfer_in" : "reclaim_in",
          description: isToChild 
            ? "Transfer from parent wallet" 
            : `Reclaimed from ${childWallet.child_name}`,
        },
      ]);

      if (txError) throw txError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["child-wallets"] });
      queryClient.invalidateQueries({ queryKey: ["parent-child-transactions"] });
      toast.success("Funds transferred!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Delete child wallet
  const deleteChildWallet = useMutation({
    mutationFn: async (wallet: ChildWallet) => {
      if (wallet.balance > 0) throw new Error("Transfer balance back to parent first");
      
      const { error } = await supabase.from("wallets").delete().eq("id", wallet.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-wallets"] });
      toast.success("Child wallet removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isLoading = parentLoading || childrenLoading;
  const totalChildBalance = childWallets?.reduce((sum, w) => sum + Number(w.balance), 0) || 0;
  const totalBalance = (parentWallet?.balance || 0) + totalChildBalance;

  return {
    parentWallet,
    childWallets: childWallets || [],
    isLoading,
    totalChildBalance,
    totalBalance,
    createChildWallet,
    updateChildWallet,
    transferFunds,
    deleteChildWallet,
    refetchParent,
    refetchChildren,
  };
};
