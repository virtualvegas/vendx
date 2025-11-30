import {
  Globe,
  Calendar,
  Wrench,
  DollarSign,
  TrendingUp,
  Package,
  MapPin,
  CheckSquare,
  Settings,
} from "lucide-react";
import { AppRole } from "@/pages/DashboardPage";
import { cn } from "@/lib/utils";

interface TabConfig {
  id: string;
  label: string;
  icon: any;
  requiredRoles: AppRole[];
}

const tabs: TabConfig[] = [
  {
    id: "global-operations",
    label: "Global Operations",
    icon: Globe,
    requiredRoles: ["super_admin", "global_operations_manager"],
  },
  {
    id: "events-rentals",
    label: "Events & Rentals",
    icon: Calendar,
    requiredRoles: ["super_admin", "event_manager"],
  },
  {
    id: "technical-support",
    label: "Technical Support",
    icon: Wrench,
    requiredRoles: ["super_admin", "tech_support_lead"],
  },
  {
    id: "finance",
    label: "Finance",
    icon: DollarSign,
    requiredRoles: ["super_admin", "finance_accounting"],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: TrendingUp,
    requiredRoles: ["super_admin", "marketing_sales"],
  },
  {
    id: "inventory-logistics",
    label: "Inventory & Logistics",
    icon: Package,
    requiredRoles: ["super_admin", "warehouse_logistics"],
  },
  {
    id: "regional-reports",
    label: "Regional Reports",
    icon: MapPin,
    requiredRoles: ["super_admin", "regional_manager"],
  },
  {
    id: "daily-tasks",
    label: "Daily Tasks",
    icon: CheckSquare,
    requiredRoles: ["super_admin", "employee_operator"],
  },
  {
    id: "admin-settings",
    label: "Admin Settings",
    icon: Settings,
    requiredRoles: ["super_admin"],
  },
];

interface DashboardSidebarProps {
  roles: AppRole[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hasAccess: (requiredRoles: AppRole[]) => boolean;
}

const DashboardSidebar = ({
  roles,
  activeTab,
  setActiveTab,
  hasAccess,
}: DashboardSidebarProps) => {
  return (
    <aside className="w-64 bg-card border-r border-border flex-shrink-0">
      <div className="p-6">
        <h2 className="text-xl font-bold text-foreground">VendX Dashboard</h2>
      </div>
      <nav className="px-3 space-y-1">
        {tabs.map((tab) => {
          const hasTabAccess = hasAccess(tab.requiredRoles);
          if (!hasTabAccess) return null;

          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default DashboardSidebar;