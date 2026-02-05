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
  LogOut,
  ChevronDown,
  ChevronRight,
  Newspaper,
  GitBranch,
  Users,
  Store,
  Swords,
  Ticket,
  BarChart3,
  Trophy,
} from "lucide-react";
import { AppRole } from "@/pages/DashboardPage";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface TabConfig {
  id: string;
  label: string;
  icon: any;
  requiredRoles: AppRole[];
}

interface TabGroup {
  id: string;
  label: string;
  tabs: TabConfig[];
}

// Organized tab groups by role/function
// Note: Users can have multiple roles and will see all tabs their roles grant access to
const tabGroups: TabGroup[] = [
  {
    id: "customer",
    label: "My Account",
    tabs: [
      // Customer tabs are available to all authenticated users (customer role or any other role)
      { id: "my-orders", label: "My Orders", icon: Package, requiredRoles: ["customer", "business_owner", "employee_operator", "super_admin", "global_operations_manager", "regional_manager", "finance_accounting", "marketing_sales", "warehouse_logistics", "tech_support_lead", "event_manager"] },
      { id: "my-wallet", label: "My Wallet", icon: Wallet, requiredRoles: ["customer", "business_owner", "employee_operator", "super_admin", "global_operations_manager", "regional_manager", "finance_accounting", "marketing_sales", "warehouse_logistics", "tech_support_lead", "event_manager"] },
      { id: "my-tickets", label: "My Tickets", icon: Ticket, requiredRoles: ["customer", "business_owner", "employee_operator", "super_admin", "global_operations_manager", "regional_manager", "finance_accounting", "marketing_sales", "warehouse_logistics", "tech_support_lead", "event_manager"] },
      { id: "my-rewards", label: "My Rewards", icon: Gift, requiredRoles: ["customer", "business_owner", "employee_operator", "super_admin", "global_operations_manager", "regional_manager", "finance_accounting", "marketing_sales", "warehouse_logistics", "tech_support_lead", "event_manager"] },
    ],
  },
  {
    id: "business",
    label: "My Business",
    tabs: [
      { id: "business-overview", label: "Overview", icon: LayoutDashboard, requiredRoles: ["business_owner"] },
      { id: "business-locations", label: "My Locations", icon: MapPin, requiredRoles: ["business_owner"] },
      { id: "business-machines", label: "My Machines", icon: Monitor, requiredRoles: ["business_owner"] },
      { id: "business-payouts", label: "Payouts", icon: DollarSign, requiredRoles: ["business_owner"] },
      { id: "business-support", label: "Support", icon: Wrench, requiredRoles: ["business_owner"] },
    ],
  },
  {
    id: "field-ops",
    label: "Field Operations",
    tabs: [
      { id: "my-route", label: "My Route", icon: Navigation, requiredRoles: ["super_admin", "global_operations_manager", "regional_manager", "employee_operator"] },
      { id: "daily-tasks", label: "Daily Tasks", icon: CheckSquare, requiredRoles: ["super_admin", "employee_operator"] },
    ],
  },
  {
    id: "management",
    label: "Management",
    tabs: [
      { id: "overview", label: "Dashboard", icon: LayoutDashboard, requiredRoles: ["super_admin", "global_operations_manager", "finance_accounting", "regional_manager"] },
      { id: "global-operations", label: "Global Operations", icon: Globe, requiredRoles: ["super_admin", "global_operations_manager"] },
      { id: "regional-reports", label: "Regional Reports", icon: MapPin, requiredRoles: ["super_admin", "regional_manager"] },
      { id: "route-manager", label: "Route Manager", icon: Route, requiredRoles: ["super_admin", "global_operations_manager"] },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    tabs: [
      { id: "machine-registry", label: "Machines", icon: Monitor, requiredRoles: ["super_admin", "tech_support_lead"] },
      { id: "ticket-config", label: "Ticket Payouts", icon: Ticket, requiredRoles: ["super_admin"] },
      { id: "inventory-logistics", label: "Inventory", icon: Package, requiredRoles: ["super_admin", "warehouse_logistics"] },
      { id: "technical-support", label: "Tech Support", icon: Wrench, requiredRoles: ["super_admin", "tech_support_lead"] },
      { id: "kiosk-categories", label: "Kiosk Setup", icon: Layers, requiredRoles: ["super_admin", "tech_support_lead"] },
      { id: "events-rentals", label: "Events & Rentals", icon: Calendar, requiredRoles: ["super_admin", "event_manager"] },
    ],
  },
  {
    id: "finance-group",
    label: "Finance",
    tabs: [
      { id: "finance", label: "Finance", icon: DollarSign, requiredRoles: ["super_admin", "finance_accounting"] },
      { id: "arcade-analytics", label: "Arcade Analytics", icon: BarChart3, requiredRoles: ["super_admin", "finance_accounting"] },
      { id: "prize-wins", label: "Prize Wins", icon: Trophy, requiredRoles: ["super_admin", "finance_accounting"] },
      { id: "ticket-prizes", label: "Ticket Prizes", icon: Gift, requiredRoles: ["super_admin", "employee_operator"] },
      { id: "vendx-pay", label: "VendX Pay", icon: Wallet, requiredRoles: ["super_admin", "finance_accounting"] },
      { id: "payouts", label: "Payouts", icon: DollarSign, requiredRoles: ["super_admin", "finance_accounting"] },
      { id: "profit-splits", label: "Profit Splits", icon: Percent, requiredRoles: ["super_admin", "finance_accounting"] },
    ],
  },
  {
    id: "marketing-group",
    label: "Marketing & Sales",
    tabs: [
      { id: "marketing", label: "Campaigns", icon: TrendingUp, requiredRoles: ["super_admin", "marketing_sales"] },
      { id: "rewards-manager", label: "Rewards", icon: Gift, requiredRoles: ["super_admin", "marketing_sales"] },
      { id: "partner-offers", label: "Partner Offers", icon: Percent, requiredRoles: ["super_admin", "marketing_sales"] },
      { id: "news", label: "News", icon: Newspaper, requiredRoles: ["super_admin"] },
    ],
  },
  {
    id: "store-group",
    label: "Online Store",
    tabs: [
      { id: "store-manager", label: "Orders", icon: ShoppingCart, requiredRoles: ["super_admin"] },
      { id: "products-manager", label: "Products", icon: Package, requiredRoles: ["super_admin"] },
      { id: "waitlist-manager", label: "Waitlist", icon: Users, requiredRoles: ["super_admin"] },
      { id: "funnels", label: "Funnels", icon: GitBranch, requiredRoles: ["super_admin"] },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    tabs: [
      { id: "locations", label: "Locations", icon: Map, requiredRoles: ["super_admin"] },
      { id: "stands-manager", label: "Stands", icon: Store, requiredRoles: ["super_admin"] },
      { id: "divisions-manager", label: "Divisions", icon: Layers, requiredRoles: ["super_admin"] },
      { id: "business-content", label: "Business Page", icon: Briefcase, requiredRoles: ["super_admin"] },
      { id: "quests-manager", label: "Quests", icon: Swords, requiredRoles: ["super_admin"] },
      { id: "careers", label: "Careers", icon: Briefcase, requiredRoles: ["super_admin"] },
      { id: "video-games", label: "Games", icon: Gamepad2, requiredRoles: ["super_admin"] },
      { id: "admin-settings", label: "Settings", icon: Settings, requiredRoles: ["super_admin"] },
    ],
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
  const navigate = useNavigate();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    // Auto-expand groups that contain the active tab
    const activeGroups = tabGroups
      .filter(group => group.tabs.some(tab => tab.id === activeTab && hasAccess(tab.requiredRoles)))
      .map(group => group.id);
    return activeGroups;
  });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // Filter groups that have accessible tabs
  const visibleGroups = tabGroups.filter(group => 
    group.tabs.some(tab => hasAccess(tab.requiredRoles))
  );

  return (
    <div className="h-full flex flex-col">
      {/* Logo/Brand */}
      <div className="p-4 lg:p-6 border-b border-border">
        <h2 className="text-xl font-bold text-foreground">VendX Dashboard</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {roles.length > 0 ? roles.map(r => r.replace(/_/g, ' ')).join(', ') : 'Customer'}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {visibleGroups.map((group) => {
          const visibleTabs = group.tabs.filter(tab => hasAccess(tab.requiredRoles));
          const isExpanded = expandedGroups.includes(group.id);
          const hasActiveTab = visibleTabs.some(tab => tab.id === activeTab);

          // If only one tab in group, show it directly without collapsible
          if (visibleTabs.length === 1) {
            const tab = visibleTabs[0];
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          }

          return (
            <div key={group.id} className="space-y-1">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left",
                  hasActiveTab 
                    ? "text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {group.label}
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {/* Group Tabs */}
              {isExpanded && (
                <div className="ml-2 space-y-1">
                  {visibleTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left",
                          activeTab === tab.id
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-3 border-t border-border">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start gap-3 h-12 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Sign Out</span>
        </Button>
      </div>
    </div>
  );
};

export default DashboardSidebar;
