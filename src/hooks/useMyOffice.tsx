import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the current user's assigned office_id (or null if unassigned / super admin without an office).
 * Used to scope dashboards (Technical Support, Service Tech, etc.) to the user's office.
 */
export function useMyOffice() {
  return useQuery({
    queryKey: ["my-office"],
    queryFn: async (): Promise<{ office_id: string | null; office: any | null; isSuperAdmin: boolean }> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { office_id: null, office: null, isSuperAdmin: false };

      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("office_id").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      const isSuperAdmin = !!roles?.some((r: any) => r.role === "super_admin");
      const office_id = (profile as any)?.office_id ?? null;

      let office: any = null;
      if (office_id) {
        const { data } = await supabase
          .from("vendx_offices" as any)
          .select("id, name, code, city, state")
          .eq("id", office_id)
          .maybeSingle();
        office = data;
      }
      return { office_id, office, isSuperAdmin };
    },
    staleTime: 5 * 60 * 1000,
  });
}
