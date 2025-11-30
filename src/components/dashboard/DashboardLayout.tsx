import { User } from "@supabase/supabase-js";
import { AppRole } from "@/pages/DashboardPage";
import DashboardSidebar from "./DashboardSidebar";
import DashboardHeader from "./DashboardHeader";

interface DashboardLayoutProps {
  user: User;
  roles: AppRole[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hasAccess: (requiredRoles: AppRole[]) => boolean;
  children: React.ReactNode;
}

const DashboardLayout = ({
  user,
  roles,
  activeTab,
  setActiveTab,
  hasAccess,
  children,
}: DashboardLayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar
        roles={roles}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasAccess={hasAccess}
      />
      <div className="flex-1 flex flex-col">
        <DashboardHeader user={user} />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;