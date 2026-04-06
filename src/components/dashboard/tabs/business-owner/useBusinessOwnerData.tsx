import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

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

export interface ScheduledServiceStop {
  id: string;
  stop_name: string;
  address: string | null;
  notes: string | null;
  status: string;
  scheduled_date: string | null;
  priority: string | null;
  auto_scheduled: boolean | null;
  source_ticket_id: string | null;
  estimated_duration_minutes: number | null;
  completed_at: string | null;
  machine?: { id: string; name: string; machine_code: string } | null;
  zone?: { id: string; name: string } | null;
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

  // Check if user is super_admin
  const { data: isSuperAdmin } = useQuery({
    queryKey: ["is-super-admin", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .eq("role", "super_admin");
      if (error) return false;
      return (data?.length || 0) > 0;
    },
    enabled: !!currentUser,
  });

  // Fetch assigned locations (or ALL locations for super_admin)
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["business-owner-assignments", isSuperAdmin],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      if (isSuperAdmin) {
        // Super admin sees ALL locations as "VendX Global"
        const { data: allLocations, error } = await supabase
          .from("locations")
          .select("id, name, city, country, address, status, machine_count, location_type, contact_name, contact_phone, contact_email")
          .order("city");
        if (error) throw error;

        // Also get existing assignments to mark which have partners
        const { data: existingAssignments } = await supabase
          .from("location_assignments")
          .select("location_id, business_owner_id, is_active")
          .eq("is_active", true);

        const assignmentMap = new Map(
          (existingAssignments || []).map(a => [a.location_id, a.business_owner_id])
        );

        return (allLocations || []).map(loc => ({
          id: `vendx-global-${loc.id}`,
          location_id: loc.id,
          is_active: true,
          is_vendx_global: !assignmentMap.has(loc.id),
          assigned_partner_id: assignmentMap.get(loc.id) || null,
          location: loc,
        }));
      }
      
      const { data, error } = await supabase
        .from("location_assignments")
        .select(`
          id, location_id, is_active,
          location:locations(id, name, city, country, address, status, machine_count, location_type, contact_name, contact_phone, contact_email)
        `)
        .eq("business_owner_id", user.id)
        .eq("is_active", true);
      if (error) throw error;
      return (data || []).map(d => ({ ...d, is_vendx_global: false, assigned_partner_id: null }));
    },
    enabled: isSuperAdmin !== undefined,
  });

  // Fetch machines at assigned locations
  const { data: machines } = useQuery({
    queryKey: ["business-owner-machines", assignments],
    queryFn: async () => {
      if (!assignments || assignments.length === 0) return [];
      
      const locationIds = assignments.map(a => a.location_id);
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, name, machine_code, machine_type, status, location_id, current_period_revenue, lifetime_revenue, last_seen, total_plays, total_vends")
        .in("location_id", locationIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!assignments && assignments.length > 0,
  });

  // Fetch LIVE transaction data from machine_transactions (30 days)
  const { data: machineTransactions } = useQuery({
    queryKey: ["business-owner-machine-txns", machines],
    queryFn: async () => {
      if (!machines || machines.length === 0) return [];
      const machineIds = machines.map(m => m.id);
      const { data, error } = await supabase
        .from("machine_transactions")
        .select("amount, created_at, machine_id")
        .in("machine_id", machineIds)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!machines && machines.length > 0,
  });

  // Fetch LIVE synced transactions matching machine codes (30 days)
  // Only fetch revenue type, exclude wallet loads (they'd double-count with machine_transactions)
  const { data: syncedTransactions } = useQuery({
    queryKey: ["business-owner-synced-txns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("synced_transactions")
        .select("amount, created_at, transaction_type, provider, metadata, description")
        .eq("status", "completed")
        .eq("transaction_type", "revenue")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      if (error) throw error;
      // Filter out wallet loads to prevent double-counting
      return (data || []).filter(t => {
        const meta = t.metadata as any;
        const source = (meta?.source || "").toLowerCase();
        const desc = (t.description || "").toLowerCase();
        return !(source === "wallet" || desc.includes("wallet load") || desc.includes("vendx pay load"));
      });
    },
  });

  // Compute LIVE revenue per machine from actual transactions
  const machineRevenue = useMemo(() => {
    if (!machines) return new Map<string, { period: number; lifetime: number }>();
    
    const revenueMap = new Map<string, { period: number; lifetime: number }>();
    machines.forEach(m => revenueMap.set(m.id, { period: 0, lifetime: Number(m.lifetime_revenue || 0) }));

    // Add machine_transactions
    machineTransactions?.forEach(t => {
      const entry = revenueMap.get(t.machine_id);
      if (entry) {
        entry.period += Number(t.amount);
      }
    });

    // Add synced_transactions matched by machine_code
    syncedTransactions?.forEach(t => {
      if (Number(t.amount) <= 0) return;
      const meta = t.metadata as any;
      const machineCode = meta?.machine_code;
      if (machineCode) {
        const machine = machines.find(m => m.machine_code === machineCode);
        if (machine) {
          const entry = revenueMap.get(machine.id);
          if (entry) {
            entry.period += Number(t.amount);
          }
        }
      }
    });

    // Use period as lifetime fallback if lifetime is 0
    revenueMap.forEach((v, k) => {
      if (v.lifetime === 0 && v.period > 0) v.lifetime = v.period;
    });

    return revenueMap;
  }, [machines, machineTransactions, syncedTransactions]);

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

  // Fetch location change requests
  const { data: changeRequests } = useQuery({
    queryKey: ["business-owner-change-requests"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("location_change_requests" as any)
        .select("*")
        .eq("requested_by", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return data || [];
    },
  });

  // Fetch scheduled service stops for business owner's machines
  const { data: scheduledStops } = useQuery({
    queryKey: ["business-owner-scheduled-stops", machines],
    queryFn: async () => {
      if (!machines || machines.length === 0) return [];
      const machineIds = machines.map(m => m.id);
      const locationIds = assignments?.map(a => a.location_id) || [];

      const { data, error } = await supabase
        .from("route_stops")
        .select(`
          id, stop_name, address, notes, status, scheduled_date, priority,
          auto_scheduled, source_ticket_id, estimated_duration_minutes, completed_at,
          machine:vendx_machines(id, name, machine_code),
          zone:service_routes(id, name)
        `)
        .or(`machine_id.in.(${machineIds.join(",")}),location_id.in.(${locationIds.join(",")})`)
        .in("status", ["pending", "in_progress"])
        .order("scheduled_date", { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data || []) as ScheduledServiceStop[];
    },
    enabled: !!machines && machines.length > 0,
  });

  return {
    currentUser,
    assignments,
    machines,
    machineRevenue,
    profitSplits,
    payouts,
    payoutSettings,
    supportRequests,
    changeRequests,
    scheduledStops,
    isLoading: assignmentsLoading,
  };
};
