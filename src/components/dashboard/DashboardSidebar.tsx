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
  Briefcase,
  Map,
  Wallet,
  Gift,
  Monitor,
  Percent,
  Route,
  Navigation,
  ShoppingCart,
  Gamepad2,
  LayoutDashboard,
  Building2,
  Layers,
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
  // Dashboard Overview (all roles)
  {
    id: "overview",
    label: "Dashboard",
    icon: LayoutDashboard,
    requiredRoles: ["super_admin", "global_operations_manager", "finance_accounting", "regional_manager"],
  },
  // Business Owner Dashboard
  {
    id: "business-owner",
    label: "My Business",
    icon: Building2,
    requiredRoles: ["business_owner"],
  },
  // Customer tabs (shown first for customers)
  {
    id: "my-orders",
    label: "My Orders",
    icon: Package,
    requiredRoles: ["customer"],
  },
  {
    id: "my-wallet",
    label: "My Wallet",
    icon: Wallet,
    requiredRoles: ["customer"],
  },
  {
    id: "my-rewards",
    label: "My Rewards",
    icon: Gift,
    requiredRoles: ["customer"],
  },
  // Admin/Staff tabs
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
    id: "my-route",
    label: "My Route",
    icon: Navigation,
    requiredRoles: ["super_admin", "global_operations_manager", "regional_manager", "employee_operator"],
  },
  {
    id: "route-manager",
    label: "Route Manager",
    icon: Route,
    requiredRoles: ["super_admin", "global_operations_manager"],
  },
  {
    id: "admin-settings",
    label: "Admin Settings",
    icon: Settings,
    requiredRoles: ["super_admin"],
  },
  {
    id: "careers",
    label: "Careers Manager",
    icon: Briefcase,
    requiredRoles: ["super_admin"],
  },
  {
    id: "locations",
    label: "Global Locations",
    icon: Map,
    requiredRoles: ["super_admin"],
  },
  {
    id: "vendx-pay",
    label: "VendX Pay",
    icon: Wallet,
    requiredRoles: ["super_admin", "finance_accounting"],
  },
  {
    id: "payouts",
    label: "Payouts",
    icon: DollarSign,
    requiredRoles: ["super_admin", "finance_accounting"],
  },
  {
    id: "profit-splits",
    label: "Profit Splits",
    icon: Percent,
    requiredRoles: ["super_admin", "finance_accounting"],
  },
  {
    id: "rewards-manager",
    label: "Rewards Manager",
    icon: Gift,
    requiredRoles: ["super_admin", "marketing_sales"],
  },
  {
    id: "machine-registry",
    label: "Machine Registry",
    icon: Monitor,
    requiredRoles: ["super_admin", "tech_support_lead"],
  },
  {
    id: "store-manager",
    label: "Store Manager",
    icon: ShoppingCart,
    requiredRoles: ["super_admin"],
  },
  {
    id: "products-manager",
    label: "Products Manager",
    icon: Package,
    requiredRoles: ["super_admin"],
  },
  {
    id: "partner-offers",
    label: "Partner Offers",
    icon: Percent,
    requiredRoles: ["super_admin", "marketing_sales"],
  },
  {
    id: "video-games",
    label: "Video Games",
    icon: Gamepad2,
    requiredRoles: ["super_admin"],
  },
  {
    id: "kiosk-categories",
    label: "Kiosk Categories",
    icon: Layers,
    requiredRoles: ["super_admin", "tech_support_lead"],
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