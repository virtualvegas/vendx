import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { AppRole } from "@/pages/DashboardPage";
import DashboardSidebar from "./DashboardSidebar";
import DashboardHeader from "./DashboardHeader";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSidebarOpen(false); // Close sidebar on mobile after selection
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Mobile Header with Menu Toggle */}
      <div className="lg:hidden bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="h-10 w-10"
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
        <h1 className="text-lg font-bold text-foreground">VendX</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-72 lg:w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out lg:transform-none overflow-y-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <DashboardSidebar
          roles={roles}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          hasAccess={hasAccess}
        />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Header */}
        <div className="hidden lg:block">
          <DashboardHeader user={user} />
        </div>
        
        {/* Mobile User Info */}
        <div className="lg:hidden bg-card border-b border-border px-4 py-2">
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>

        <main className="flex-1 p-4 lg:p-8 overflow-x-auto overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
