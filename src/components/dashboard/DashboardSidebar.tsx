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
  Disc3,
  Music,
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
  Leaf,
  FileText,
  Megaphone,
  Lightbulb,
  Warehouse,
  Mail,
  Link2,
  ShieldCheck,
} from "lucide-react";
import { AppRole } from "@/pages/DashboardPage";
import { TAB_ACCESS } from "./tabAccess";
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

// Pull required roles from shared TAB_ACCESS so sidebar visibility and the
// DashboardPage route guard cannot drift apart.
const r = (id: string): AppRole[] => TAB_ACCESS[id] ?? [];

// Organized tab groups by role/function
// Note: Users can have multiple roles and will see all tabs their roles grant access to
const tabGroups: TabGroup[] = [
  // === CUSTOMER TABS (Everyone) ===
  {
    id: "customer",
    label: "My Account",
    tabs: [
      { id: "my-orders", label: "My Orders", icon: Package, requiredRoles: r("my-orders") },
      { id: "my-wallet", label: "My Wallet", icon: Wallet, requiredRoles: r("my-wallet") },
      { id: "my-tickets", label: "My Tickets", icon: Ticket, requiredRoles: r("my-tickets") },
      { id: "my-rewards", label: "My Rewards", icon: Gift, requiredRoles: r("my-rewards") },
      { id: "my-business-card", label: "My Business Card", icon: Users, requiredRoles: r("my-business-card") },
      { id: "linked-accounts", label: "Linked Accounts", icon: Link2, requiredRoles: r("linked-accounts") },
    ],
  },

  // === BUSINESS OWNER TABS ===
  {
    id: "business",
    label: "My Business",
    tabs: [
      { id: "business-overview", label: "Overview", icon: LayoutDashboard, requiredRoles: r("business-overview") },
      { id: "business-locations", label: "My Locations", icon: MapPin, requiredRoles: r("business-locations") },
      { id: "business-machines", label: "My Machines", icon: Monitor, requiredRoles: r("business-machines") },
      { id: "business-payouts", label: "Payouts", icon: DollarSign, requiredRoles: r("business-payouts") },
      { id: "business-adreach", label: "AdReach", icon: Megaphone, requiredRoles: r("business-adreach") },
      { id: "business-support", label: "Support", icon: Wrench, requiredRoles: r("business-support") },
      { id: "business-external-service", label: "Machine Service", icon: Wrench, requiredRoles: r("business-external-service") },
    ],
  },

  // === EMPLOYEE/OPERATOR TABS ===
  {
    id: "field-ops",
    label: "Field Operations",
    tabs: [
      { id: "my-route", label: "My Route", icon: Navigation, requiredRoles: r("my-route") },
      { id: "service-tech", label: "Service Operations", icon: Wrench, requiredRoles: r("service-tech") },
      { id: "daily-tasks", label: "Daily Tasks", icon: CheckSquare, requiredRoles: r("daily-tasks") },
    ],
  },

  // === ARCADE & PRIZES (Employee/Operator focus) ===
  {
    id: "arcade-prizes",
    label: "Arcade & Prizes",
    tabs: [
      { id: "arcade-game-titles", label: "Game Titles", icon: Gamepad2, requiredRoles: r("arcade-game-titles") },
      { id: "ticket-prizes", label: "Prize Catalog", icon: Gift, requiredRoles: r("ticket-prizes") },
      { id: "prize-inventory", label: "Prize Inventory", icon: Package, requiredRoles: r("prize-inventory") },
      { id: "prize-wins", label: "Prize Wins Log", icon: Trophy, requiredRoles: r("prize-wins") },
    ],
  },

  // === MANAGEMENT OVERVIEW ===
  {
    id: "management",
    label: "Overview & Reports",
    tabs: [
      { id: "overview", label: "Dashboard", icon: LayoutDashboard, requiredRoles: r("overview") },
      { id: "global-analytics", label: "Global Analytics", icon: TrendingUp, requiredRoles: r("global-analytics") },
      { id: "global-operations", label: "Global Operations", icon: Globe, requiredRoles: r("global-operations") },
      { id: "regional-reports", label: "Regional Reports", icon: MapPin, requiredRoles: r("regional-reports") },
      { id: "arcade-analytics", label: "Arcade Analytics", icon: BarChart3, requiredRoles: r("arcade-analytics") },
    ],
  },

  // === MACHINES & TECHNICAL ===
  {
    id: "machines-tech",
    label: "Machines & Technical",
    tabs: [
      { id: "machine-registry", label: "Machine Registry", icon: Monitor, requiredRoles: r("machine-registry") },
      { id: "ecosnack-lockers", label: "EcoVend Lockers", icon: Leaf, requiredRoles: r("ecosnack-lockers") },
      { id: "ecovend-suggestions", label: "EcoVend Suggestions", icon: Lightbulb, requiredRoles: r("ecovend-suggestions") },
      { id: "ticket-config", label: "Ticket Payouts", icon: Ticket, requiredRoles: r("ticket-config") },
      { id: "kiosk-categories", label: "Kiosk Setup", icon: Layers, requiredRoles: r("kiosk-categories") },
      { id: "technical-support", label: "Tech Support", icon: Wrench, requiredRoles: r("technical-support") },
      { id: "external-service", label: "External Service (Client Machines)", icon: Wrench, requiredRoles: r("external-service") },
      { id: "custom-arcade-requests", label: "Custom Arcade Requests", icon: Wrench, requiredRoles: r("custom-arcade-requests") },
    ],
  },

  // === ROUTES & LOGISTICS ===
  {
    id: "routes-logistics",
    label: "Routes & Logistics",
    tabs: [
      { id: "route-manager", label: "Route Manager", icon: Route, requiredRoles: r("route-manager") },
      { id: "warehouses", label: "VendX Warehouses", icon: Warehouse, requiredRoles: r("warehouses") },
      { id: "inventory-logistics", label: "Product Catalog", icon: Package, requiredRoles: r("inventory-logistics") },
      { id: "machine-inventory", label: "Machine Inventory", icon: Monitor, requiredRoles: r("machine-inventory") },
    ],
  },


  // === FINANCE & PAYOUTS ===
  {
    id: "finance-group",
    label: "Finance & Payouts",
    tabs: [
      { id: "finance", label: "Finance Overview", icon: DollarSign, requiredRoles: r("finance") },
      { id: "finance-manager", label: "Finance Manager", icon: Wallet, requiredRoles: r("finance-manager") },
      { id: "vendx-pay", label: "VendX Pay", icon: Wallet, requiredRoles: r("vendx-pay") },
      { id: "gift-cards", label: "Gift Cards", icon: Gift, requiredRoles: r("gift-cards") },
      { id: "payouts", label: "Payouts (Partners & Artists)", icon: DollarSign, requiredRoles: r("payouts") },
      { id: "profit-splits", label: "Profit Splits", icon: Percent, requiredRoles: r("profit-splits") },
    ],
  },

  // === MARKETING & ENGAGEMENT ===
  {
    id: "marketing-group",
    label: "Marketing & Engagement",
    tabs: [
      { id: "marketing", label: "Campaigns", icon: TrendingUp, requiredRoles: r("marketing") },
      { id: "email-subscribers", label: "Email Subscribers", icon: Mail, requiredRoles: r("email-subscribers") },
      { id: "adreach-manager", label: "AdReach", icon: Megaphone, requiredRoles: r("adreach-manager") },
      { id: "rewards-manager", label: "Rewards Catalog", icon: Gift, requiredRoles: r("rewards-manager") },
      { id: "partner-offers", label: "Partner Offers", icon: Percent, requiredRoles: r("partner-offers") },
      { id: "brand-links", label: "Brand Links", icon: Globe, requiredRoles: r("brand-links") },
      { id: "quests-manager", label: "Quest Builder", icon: Swords, requiredRoles: r("quests-manager") },
    ],
  },

  // === ONLINE STORE ===
  {
    id: "store-group",
    label: "Online Store",
    tabs: [
      { id: "store-manager", label: "Store Management", icon: ShoppingCart, requiredRoles: r("store-manager") },
      { id: "products-manager", label: "Subscription Plans", icon: Package, requiredRoles: r("products-manager") },
      { id: "waitlist-manager", label: "Store Waitlist", icon: Users, requiredRoles: r("waitlist-manager") },
      { id: "funnels", label: "Sales Funnels", icon: GitBranch, requiredRoles: r("funnels") },
    ],
  },

  // === WEBSITE CONTENT ===
  {
    id: "website-content",
    label: "Website Content",
    tabs: [
      { id: "news", label: "News Articles", icon: Newspaper, requiredRoles: r("news") },
      { id: "business-content", label: "Business Page", icon: Briefcase, requiredRoles: r("business-content") },
      { id: "careers", label: "Careers", icon: Briefcase, requiredRoles: r("careers") },
      { id: "site-policies", label: "Site Policies", icon: FileText, requiredRoles: r("site-policies") },
      { id: "divisions-manager", label: "Divisions", icon: Layers, requiredRoles: r("divisions-manager") },
    ],
  },

  // === MEDIA & ENTERTAINMENT ===
  {
    id: "media-content",
    label: "Media & Entertainment",
    tabs: [
      { id: "artists-manager", label: "Artists", icon: Users, requiredRoles: r("artists-manager") },
      { id: "releases-tracks", label: "Releases & Tracks", icon: Music, requiredRoles: r("releases-tracks") },
      { id: "media-shop-manager", label: "Media Merch Shop", icon: ShoppingCart, requiredRoles: r("media-shop-manager") },
      { id: "track-shop-manager", label: "Track / Beat Shop", icon: Music, requiredRoles: r("track-shop-manager") },
      { id: "video-games", label: "Video Games", icon: Gamepad2, requiredRoles: r("video-games") },
    ],
  },

  // === LOCATIONS & SITES ===
  {
    id: "locations-group",
    label: "Locations & Sites",
    tabs: [
      { id: "locations", label: "Global Locations", icon: Map, requiredRoles: r("locations") },
      { id: "offices", label: "VendX Offices", icon: Building2, requiredRoles: r("offices") },
      { id: "events-rentals", label: "Events & Rentals", icon: Calendar, requiredRoles: r("events-rentals") },
      { id: "stands-manager", label: "Stands", icon: Store, requiredRoles: r("stands-manager") },
    ],
  },

  // === SYSTEM ADMINISTRATION ===
  {
    id: "admin",
    label: "System Administration",
    tabs: [
      { id: "admin-settings", label: "Users & Roles", icon: Users, requiredRoles: r("admin-settings") },
      { id: "merchant-api", label: "Merchant API", icon: Globe, requiredRoles: r("merchant-api") },
      { id: "sso-apps", label: "SSO Applications", icon: ShieldCheck, requiredRoles: r("sso-apps") },
      { id: "income-streams", label: "Income Streams", icon: Globe, requiredRoles: r("income-streams") },
      { id: "audit-logs", label: "Audit Logs", icon: FileText, requiredRoles: r("audit-logs") },
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
