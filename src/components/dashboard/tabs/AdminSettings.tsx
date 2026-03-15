import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { AppRole } from "@/pages/DashboardPage";
import { Trash2, UserPlus, Shield, Users } from "lucide-react";

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
  customer: "Customer",
  business_owner: "Business Owner",
  support: "Support Agent",
};

const roleDescriptions: Record<AppRole, string> = {
  super_admin: "Full system access and user management",
  global_operations_manager: "Oversee worldwide operations",
  event_manager: "Manage events and rental deployments",
  tech_support_lead: "Handle technical issues and tickets",
  finance_accounting: "Access financial data and reports",
  marketing_sales: "Manage campaigns and leads",
  warehouse_logistics: "Control inventory and shipments",
  regional_manager: "Regional performance oversight",
  employee_operator: "Daily operational tasks",
  customer: "Standard customer access with wallet and rewards",
  business_owner: "View location performance and payouts",
};

const AdminSettings = () => {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<AppRole | "">("");
  const [emailFilter, setEmailFilter] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    userId: string;
    role: AppRole | null;
  }>({ open: false, userId: "", role: null });
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .order("email");

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
        title: "Validation Error",
        description: "Please select both a user and a role",
        variant: "destructive",
      });
      return;
    }

    // Check if user already has this role
    const user = users.find(u => u.id === selectedUser);
    if (user?.roles.includes(selectedRole)) {
      toast({
        title: "Error",
        description: "User already has this role",
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
        description: `${roleLabels[selectedRole]} role added successfully`,
      });

      await fetchUsers();
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

  const confirmRemoveRole = (userId: string, role: AppRole) => {
    setDeleteDialog({ open: true, userId, role });
  };

  const handleRemoveRole = async () => {
    const { userId, role } = deleteDialog;
    if (!userId || !role) return;

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${roleLabels[role]} role removed successfully`,
      });

      await fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialog({ open: false, userId: "", role: null });
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(emailFilter.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(emailFilter.toLowerCase())
  );

  const roleStats = Object.keys(roleLabels).map(role => ({
    role: role as AppRole,
    count: users.reduce((sum, user) => sum + (user.roles.includes(role as AppRole) ? 1 : 0), 0),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Admin Settings</h2>
        <p className="text-muted-foreground">
          Manage user roles and permissions across the system
        </p>
      </div>

      {/* Role Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Super Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {roleStats.find(r => r.role === "super_admin")?.count || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{Object.keys(roleLabels).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {users.reduce((sum, user) => sum + user.roles.length, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add Role Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Assign Role to User
          </CardTitle>
          <CardDescription>
            Grant users access to specific dashboard sections and capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="user-select">Select User</Label>
              <SearchableSelect
                id="user-select"
                options={users.map((user) => ({
                  value: user.id,
                  label: user.email,
                  description: user.full_name || undefined,
                }))}
                value={selectedUser}
                onValueChange={setSelectedUser}
                placeholder="Choose user"
                searchPlaceholder="Search by email or name..."
              />
            </div>

            <div>
              <Label htmlFor="role-select">Select Role</Label>
              <SearchableSelect
                id="role-select"
                options={Object.entries(roleLabels).map(([key, label]) => ({
                  value: key,
                  label,
                  description: roleDescriptions[key as AppRole],
                }))}
                value={selectedRole}
                onValueChange={(v) => setSelectedRole(v as AppRole)}
                placeholder="Choose role"
                searchPlaceholder="Search roles..."
              />
              {selectedRole && (
                <p className="text-xs text-muted-foreground mt-1">
                  {roleDescriptions[selectedRole]}
                </p>
              )}
            </div>

            <div className="flex items-end">
              <Button 
                onClick={handleAddRole} 
                className="w-full"
                disabled={!selectedUser || !selectedRole}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Assign Role
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Role Distribution</CardTitle>
          <CardDescription>Overview of all roles and assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roleStats.map((stat) => (
              <div key={stat.role} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">{roleLabels[stat.role]}</h4>
                  <span className="text-lg font-bold text-primary">{stat.count}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {roleDescriptions[stat.role]}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Users & Roles Management */}
      <Card>
        <CardHeader>
          <CardTitle>User Role Management</CardTitle>
          <CardDescription>View and manage all user role assignments</CardDescription>
          <div className="mt-4">
            <Label htmlFor="email-filter">Filter by Email</Label>
            <Input
              id="email-filter"
              placeholder="Search users..."
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No users found matching your filter
              </p>
            ) : (
              filteredUsers.map((user) => (
                <div key={user.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-foreground">{user.email}</p>
                      {user.full_name && (
                        <p className="text-sm text-muted-foreground">{user.full_name}</p>
                      )}
                    </div>
                    {user.roles.length > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        {user.roles.length} role{user.roles.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {user.roles.length > 0 ? (
                      user.roles.map((role) => (
                        <div
                          key={role}
                          className="inline-flex items-center gap-2 bg-accent/10 text-accent px-3 py-1.5 rounded-full text-sm border border-accent/20"
                        >
                          <Shield className="w-3 h-3" />
                          <span>{roleLabels[role]}</span>
                          <button
                            onClick={() => confirmRemoveRole(user.id, role)}
                            className="hover:text-destructive transition-colors ml-1"
                            aria-label={`Remove ${roleLabels[role]} role`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground italic">
                        No roles assigned
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, userId: "", role: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the <strong>{deleteDialog.role && roleLabels[deleteDialog.role]}</strong> role? 
              This will revoke access to associated dashboard sections.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveRole} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSettings;
