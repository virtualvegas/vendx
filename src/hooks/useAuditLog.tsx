import { supabase } from "@/integrations/supabase/client";

interface AuditLogEntry {
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, any>;
}

export const logAuditEvent = async (entry: AuditLogEntry) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roleList = roles?.map(r => r.role).join(", ") || "unknown";

    // Get user email from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      user_email: profile?.email || user.email || "unknown",
      user_role: roleList,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id || null,
      details: entry.details || {},
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
};
