import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TicketTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  game_name: string | null;
  score: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  machine?: {
    id: string;
    name: string;
    machine_code: string;
  } | null;
  location?: {
    id: string;
    name: string | null;
    city: string;
  } | null;
}

export interface TicketBalance {
  balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  transactions: TicketTransaction[];
}

export const useTickets = () => {
  const queryClient = useQueryClient();

  // Fetch ticket balance and transactions
  const { data, isLoading, error, refetch } = useQuery<TicketBalance>({
    queryKey: ["user-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("tickets-balance");
      if (error) throw error;
      return data;
    },
  });

  // Redeem tickets mutation
  const redeemMutation = useMutation({
    mutationFn: async (params: {
      amount: number;
      reason?: string;
      prize_id?: string;
      prize_name?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("tickets-redeem", {
        body: params,
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Failed to redeem tickets");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user-tickets"] });
      toast.success(`Redeemed ${data.tickets_redeemed} tickets!`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    balance: data?.balance ?? 0,
    lifetimeEarned: data?.lifetime_earned ?? 0,
    lifetimeRedeemed: data?.lifetime_redeemed ?? 0,
    transactions: data?.transactions ?? [],
    isLoading,
    error,
    refetch,
    redeemTickets: redeemMutation.mutateAsync,
    isRedeeming: redeemMutation.isPending,
  };
};
