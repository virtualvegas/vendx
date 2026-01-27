import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SupportRequest {
  id: string;
  location_id: string | null;
  machine_id: string | null;
  request_type: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export const useBusinessOwnerData = () => {
  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch assigned locations
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["business-owner-assignments"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("location_assignments")
        .select(`
          id, location_id, is_active,
          location:locations(id, name, city, country, address, status, machine_count, location_type)
        `)
        .eq("business_owner_id", user.id)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch machines at assigned locations
  const { data: machines } = useQuery({
    queryKey: ["business-owner-machines", assignments],
    queryFn: async () => {
      if (!assignments || assignments.length === 0) return [];
      
      const locationIds = assignments.map(a => a.location_id);
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, name, machine_code, machine_type, status, location_id, current_period_revenue, lifetime_revenue")
        .in("location_id", locationIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!assignments && assignments.length > 0,
  });

  // Fetch profit splits for machines
  const { data: profitSplits } = useQuery({
    queryKey: ["business-owner-profit-splits", machines],
    queryFn: async () => {
      if (!machines || machines.length === 0) return [];
      
      const machineIds = machines.map(m => m.id);
      const { data, error } = await supabase
        .from("machine_profit_splits")
        .select("*")
        .in("machine_id", machineIds)
        .is("effective_to", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!machines && machines.length > 0,
  });

  // Fetch payouts
  const { data: payouts } = useQuery({
    queryKey: ["business-owner-payouts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .eq("business_owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch payout settings
  const { data: payoutSettings } = useQuery({
    queryKey: ["business-owner-payout-settings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("payout_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  // Fetch support requests
  const { data: supportRequests } = useQuery({
    queryKey: ["business-owner-support-requests"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("partner_support_requests")
        .select("*")
        .eq("business_owner_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupportRequest[];
    },
  });

  return {
    currentUser,
    assignments,
    machines,
    profitSplits,
    payouts,
    payoutSettings,
    supportRequests,
    isLoading: assignmentsLoading,
  };
};
