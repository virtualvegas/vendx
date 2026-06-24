import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RealStats {
  activeMachines: number;
  totalMachines: number;
  teamMembers: number;
  countries: number;
  locations: number;
}

export function useRealStats() {
  return useQuery<RealStats>({
    queryKey: ["real-site-stats"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [machinesAll, machinesActive, locsRes, teamRes] = await Promise.all([
        supabase.from("vendx_machines").select("id", { count: "exact", head: true }),
        supabase
          .from("vendx_machines")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase.from("locations").select("country"),
        supabase
          .from("user_roles")
          .select("user_id, role")
          .neq("role", "customer"),
      ]);

      const totalMachines = machinesAll.count ?? 0;
      const activeMachines = machinesActive.count ?? 0;

      const countrySet = new Set(
        (locsRes.data ?? [])
          .map((l: any) => (l.country ?? "").trim())
          .filter((c: string) => c.length > 0)
      );
      const countries = countrySet.size;

      const locations = (locsRes.data ?? []).length;

      const teamSet = new Set(
        (teamRes.data ?? []).map((r: any) => r.user_id)
      );
      const teamMembers = teamSet.size;

      return { activeMachines, totalMachines, teamMembers, countries, locations };
    },
  });
}

/**
 * Map a metric label to a live DB-derived value, if applicable.
 * Returns null when the label is not a real-data metric so callers can fall
 * back to the stored metric_value.
 */
export function getRealValueForLabel(
  label: string,
  stats?: RealStats | null
): number | null {
  if (!stats) return null;
  const l = label.toLowerCase();
  if (l.includes("team member") || l.includes("employee")) return stats.teamMembers;
  if (l.includes("countr")) return stats.countries;
  if (l.includes("machine")) {
    if (l.includes("active") || l.includes("operating")) return stats.activeMachines;
    return stats.totalMachines;
  }
  if (l.includes("location")) return stats.locations;
  return null;
}
