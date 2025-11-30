import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AppRole } from "@/pages/DashboardPage";

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string | null;
  roles: AppRole[];
}

const roleLabels: Record<AppRole, string> = {
  super_admin: "Super Admin",
  global_operations_manager: "Global Operations Manager",
  event_manager: "Event Manager",
  tech_support_lead: "Tech Support Lead",
  finance_accounting: "Finance & Accounting",
  marketing_sales: "Marketing & Sales",
  warehouse_logistics: "Warehouse & Logistics",
  regional_manager: "Regional Manager",
  employee_operator: "Employee / Operator",
};

const AdminSettings = () => {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<AppRole | "">("");
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name");

      if (profilesError) throw profilesError;

      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRoles[] = profiles.map((profile) => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        roles: userRoles
          .filter((ur) => ur.user_id === profile.id)
          .map((ur) => ur.role as AppRole),
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async () => {
    if (!selectedUser || !selectedRole) {
      toast({
        title: "Error",
        description: "Please select both a user and a role",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("user_roles").insert({
        user_id: selectedUser,
        role: selectedRole,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role added successfully",
      });

      fetchUsers();
      setSelectedUser("");
      setSelectedRole("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role removed successfully",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Admin Settings</h2>
        <p className="text-muted-foreground">
          Manage user roles and permissions
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Add Role to User</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="user-select">Select User</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger id="user-select">
                <SelectValue placeholder="Choose user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="role-select">Select Role</Label>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger id="role-select">
                <SelectValue placeholder="Choose role" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(roleLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={handleAddRole} className="w-full">
              Add Role
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Current Users & Roles</h3>
        <div className="space-y-4">
          {users.map((user) => (
            <div key={user.id} className="border-b border-border pb-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-foreground">{user.email}</p>
                  {user.full_name && (
                    <p className="text-sm text-muted-foreground">{user.full_name}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {user.roles.length > 0 ? (
                  user.roles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                    >
                      {roleLabels[role]}
                      <button
                        onClick={() => handleRemoveRole(user.id, role)}
                        className="hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No roles assigned</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;