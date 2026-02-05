import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ArcadePlaySession {
  id: string;
  machine_id: string;
  plays_purchased: number;
  plays_used: number;
  status: string;
  expires_at: string;
  amount: number;
  pricing_type: string | null;
  created_at: string;
}

export interface ArcadeMachineInfo {
  id: string;
  name: string;
  machine_code: string;
  machine_type: string;
  status: string;
  location?: {
    id: string;
    name: string | null;
    city: string;
    address: string | null;
  };
}

export interface ArcadePricing {
  price_per_play: number;
  bundles: Array<{
    plays: number;
    price: number;
    label: string;
    savings: number;
    savingsPercent: number;
  }>;
  template_name: string | null;
  has_bundles: boolean;
}

export const useArcade = () => {
  const queryClient = useQueryClient();
  const [selectedMachine, setSelectedMachine] = useState<ArcadeMachineInfo | null>(null);

  // Fetch user's active arcade sessions
  const { 
    data: activeSessions = [], 
    isLoading: sessionsLoading,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ["arcade-active-sessions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("arcade_play_sessions")
        .select(`
          id, machine_id, plays_purchased, plays_used, status, 
          expires_at, amount, pricing_type, created_at
        `)
        .eq("user_id", user.id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ArcadePlaySession[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch machine info by code or ID
  const fetchMachineInfo = useCallback(async (
    machineId?: string, 
    machineCode?: string
  ): Promise<{ machine: ArcadeMachineInfo; pricing: ArcadePricing; available: boolean } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("arcade-machine-info", {
        body: { machine_id: machineId, machine_code: machineCode },
      });

      if (error || !data?.success) {
        toast.error(data?.error || "Failed to load machine info");
        return null;
      }

      return {
        machine: data.machine,
        pricing: data.pricing,
        available: data.available,
      };
    } catch (err) {
      console.error("Error fetching machine info:", err);
      toast.error("Failed to connect to machine");
      return null;
    }
  }, []);

  // Purchase arcade plays mutation
  const purchaseMutation = useMutation({
    mutationFn: async (params: {
      machineId: string;
      pricingType: "single" | "template_bundle";
      bundleIndex?: number;
      childWalletId?: string;
    }) => {
      const body: Record<string, unknown> = {
        machine_id: params.machineId,
        pricing_type: params.pricingType,
      };

      if (params.pricingType === "template_bundle" && params.bundleIndex !== undefined) {
        body.bundle_index = params.bundleIndex;
      }

      if (params.childWalletId) {
        body.child_wallet_id = params.childWalletId;
      }

      const { data, error } = await supabase.functions.invoke("arcade-play-purchase", {
        body,
      });

      if (error || !data?.success) {
        throw new Error(data?.error || "Purchase failed");
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["arcade-active-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["user-wallet"] });
      toast.success(`${data.plays_purchased} play${data.plays_purchased > 1 ? "s" : ""} ready!`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Get recent arcade history
  const { 
    data: recentPlays = [],
    isLoading: historyLoading,
  } = useQuery({
    queryKey: ["arcade-history"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("arcade_play_sessions")
        .select(`
          id, plays_purchased, plays_used, status, amount, 
          created_at, pricing_type,
          vendx_machines (id, name, machine_code)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  return {
    // State
    selectedMachine,
    setSelectedMachine,
    
    // Active sessions
    activeSessions,
    sessionsLoading,
    refetchSessions,
    
    // History
    recentPlays,
    historyLoading,
    
    // Actions
    fetchMachineInfo,
    purchasePlays: purchaseMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
  };
};

export default useArcade;
