import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the current user's assigned warehouse_id (or null if unassigned / super admin without a warehouse).
 * Used to scope warehouse staff dashboards (Inventory, Machine Inventory, etc.) to their warehouse.
 */
export function useMyWarehouse() {
  return useQuery({
    queryKey: ["my-warehouse"],
    queryFn: async (): Promise<{ warehouse_id: string | null; warehouse: any | null; isSuperAdmin: boolean }> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { warehouse_id: null, warehouse: null, isSuperAdmin: false };

      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("warehouse_id" as any).eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      const isSuperAdmin = !!roles?.some((r: any) => r.role === "super_admin");
      const warehouse_id = (profile as any)?.warehouse_id ?? null;

      let warehouse: any = null;
      if (warehouse_id) {
        const { data } = await supabase
          .from("vendx_warehouses" as any)
          .select("id, name, code, city, state")
          .eq("id", warehouse_id)
          .maybeSingle();
        warehouse = data;
      }
      return { warehouse_id, warehouse, isSuperAdmin };
    },
    staleTime: 5 * 60 * 1000,
  });
}
