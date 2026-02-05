import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlobalOperations from "@/components/dashboard/tabs/GlobalOperations";
import EventsRentals from "@/components/dashboard/tabs/EventsRentals";
import TechnicalSupport from "@/components/dashboard/tabs/TechnicalSupport";
import Finance from "@/components/dashboard/tabs/Finance";
import Marketing from "@/components/dashboard/tabs/Marketing";
import InventoryLogistics from "@/components/dashboard/tabs/InventoryLogistics";
import RegionalReports from "@/components/dashboard/tabs/RegionalReports";
import DailyTasks from "@/components/dashboard/tabs/DailyTasks";
import AdminSettings from "@/components/dashboard/tabs/AdminSettings";
import CareersManager from "@/components/dashboard/tabs/CareersManager";
import GlobalLocations from "@/components/dashboard/tabs/GlobalLocations";
import VendXPayManager from "@/components/dashboard/tabs/VendXPayManager";
import RewardsManager from "@/components/dashboard/tabs/RewardsManager";
import MachineRegistry from "@/components/dashboard/tabs/MachineRegistry";
import PartnerOffersManager from "@/components/dashboard/tabs/PartnerOffersManager";
import CustomerOrders from "@/components/dashboard/tabs/CustomerOrders";
import CustomerWallet from "@/components/dashboard/tabs/CustomerWallet";
import CustomerRewards from "@/components/dashboard/tabs/CustomerRewards";
import MyRoute from "@/components/dashboard/tabs/MyRoute";
import RouteManager from "@/components/dashboard/tabs/RouteManager";
import StoreManager from "@/components/dashboard/tabs/StoreManager";
import ProductsManager from "@/components/dashboard/tabs/ProductsManager";
import VideoGamesManager from "@/components/dashboard/tabs/VideoGamesManager";
import DashboardOverview from "@/components/dashboard/tabs/DashboardOverview";
import BusinessOverview from "@/components/dashboard/tabs/business-owner/BusinessOverview";
import BusinessLocations from "@/components/dashboard/tabs/business-owner/BusinessLocations";
import BusinessMachines from "@/components/dashboard/tabs/business-owner/BusinessMachines";
import BusinessPayouts from "@/components/dashboard/tabs/business-owner/BusinessPayouts";
import BusinessSupport from "@/components/dashboard/tabs/business-owner/BusinessSupport";
import PayoutsManager from "@/components/dashboard/tabs/PayoutsManager";
import ProfitSplitsManager from "@/components/dashboard/tabs/ProfitSplitsManager";
import KioskCategoriesManager from "@/components/dashboard/tabs/KioskCategoriesManager";
import FunnelManager from "@/components/dashboard/tabs/FunnelManager";
import NewsManager from "@/components/dashboard/tabs/NewsManager";
import WaitlistManager from "@/components/dashboard/tabs/WaitlistManager";
import DivisionsManager from "@/components/dashboard/tabs/DivisionsManager";
import StandsManager from "@/components/dashboard/tabs/StandsManager";
import QuestsManager from "@/components/dashboard/tabs/QuestsManager";
import BusinessContentManager from "@/components/dashboard/tabs/BusinessContentManager";
import TicketConfigManager from "@/components/dashboard/tabs/TicketConfigManager";
import CustomerTickets from "@/components/dashboard/tabs/CustomerTickets";
import ArcadeAnalytics from "@/components/dashboard/tabs/ArcadeAnalytics";
import PrizeWinsManager from "@/components/dashboard/tabs/PrizeWinsManager";
export type AppRole =
  | "super_admin"
  | "global_operations_manager"
  | "event_manager"
  | "tech_support_lead"
  | "finance_accounting"
  | "marketing_sales"
  | "warehouse_logistics"
  | "regional_manager"
  | "employee_operator"
  | "customer"
  | "business_owner";

const DashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  
  // Determine default tab based on roles (will be updated after roles load)
  // Priority: Admin roles > Business Owner > Employee > Customer
  // Note: Users with multiple roles will see all their accessible tabs in the sidebar
  const getDefaultTab = (userRoles: AppRole[]) => {
    // Admin/management roles get the overview dashboard
    if (userRoles.includes("super_admin") || userRoles.includes("global_operations_manager") || 
        userRoles.includes("finance_accounting") || userRoles.includes("regional_manager")) {
      return "overview";
    }
    // Business owners get their business dashboard
    if (userRoles.includes("business_owner")) {
      return "business-overview";
    }
    // Field operators get their route view
    if (userRoles.includes("employee_operator")) {
      return "my-route";
    }
    // Tech support leads
    if (userRoles.includes("tech_support_lead")) {
      return "technical-support";
    }
    // Event managers
    if (userRoles.includes("event_manager")) {
      return "events-rentals";
    }
    // Warehouse/logistics
    if (userRoles.includes("warehouse_logistics")) {
      return "inventory-logistics";
    }
    // Marketing/sales
    if (userRoles.includes("marketing_sales")) {
      return "marketing";
    }
    // Default for customers and any other role
    return "my-orders";
  };
  
  const [activeTab, setActiveTab] = useState(tab || "my-orders");
  const { toast } = useToast();

  // Sync URL param with activeTab
  useEffect(() => {
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [tab]);

  // Update URL when tab changes (without full navigation)
  const handleSetActiveTab = (newTab: string) => {
    setActiveTab(newTab);
    navigate(`/dashboard/${newTab}`, { replace: true });
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) throw error;

        setRoles(data.map((r) => r.role as AppRole));
        
        // Set default tab based on roles if no tab specified in URL
        if (!tab) {
          const defaultTab = getDefaultTab(data.map((r) => r.role as AppRole));
          setActiveTab(defaultTab);
          navigate(`/dashboard/${defaultTab}`, { replace: true });
        }
      } catch (error: any) {
        console.error("Error fetching roles:", error);
        toast({
          title: "Error",
          description: "Failed to load user roles",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [user, toast]);

  const hasAccess = (requiredRoles: AppRole[]) => {
    return roles.some((role) => requiredRoles.includes(role));
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return <DashboardOverview />;
      case "business-overview":
        return <BusinessOverview />;
      case "business-locations":
        return <BusinessLocations />;
      case "business-machines":
        return <BusinessMachines />;
      case "business-payouts":
        return <BusinessPayouts />;
      case "business-support":
        return <BusinessSupport />;
      case "my-orders":
        return <CustomerOrders />;
      case "my-wallet":
        return <CustomerWallet />;
      case "my-tickets":
        return <CustomerTickets />;
      case "my-rewards":
        return <CustomerRewards />;
      case "global-operations":
        return <GlobalOperations />;
      case "events-rentals":
        return <EventsRentals />;
      case "technical-support":
        return <TechnicalSupport />;
      case "finance":
        return <Finance />;
      case "marketing":
        return <Marketing />;
      case "inventory-logistics":
        return <InventoryLogistics />;
      case "regional-reports":
        return <RegionalReports />;
      case "daily-tasks":
        return <DailyTasks />;
      case "admin-settings":
        return <AdminSettings />;
      case "careers":
        return <CareersManager />;
      case "locations":
        return <GlobalLocations />;
      case "vendx-pay":
        return <VendXPayManager />;
      case "rewards-manager":
        return <RewardsManager />;
      case "machine-registry":
        return <MachineRegistry />;
      case "partner-offers":
        return <PartnerOffersManager />;
      case "my-route":
        return <MyRoute />;
      case "route-manager":
        return <RouteManager />;
      case "store-manager":
        return <StoreManager />;
      case "products-manager":
        return <ProductsManager />;
      case "video-games":
        return <VideoGamesManager />;
      case "payouts":
        return <PayoutsManager />;
      case "profit-splits":
        return <ProfitSplitsManager />;
      case "kiosk-categories":
        return <KioskCategoriesManager />;
      case "funnels":
        return <FunnelManager />;
      case "waitlist-manager":
        return <WaitlistManager />;
      case "news":
        return <NewsManager />;
      case "divisions-manager":
        return <DivisionsManager />;
      case "stands-manager":
        return <StandsManager />;
      case "quests-manager":
        return <QuestsManager />;
      case "business-content":
        return <BusinessContentManager />;
      case "ticket-config":
        return <TicketConfigManager />;
      case "arcade-analytics":
        return <ArcadeAnalytics />;
      case "prize-wins":
        return <PrizeWinsManager />;
      default:
        return <CustomerOrders />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout
      user={user}
      roles={roles}
      activeTab={activeTab}
      setActiveTab={handleSetActiveTab}
      hasAccess={hasAccess}
    >
      {renderTabContent()}
    </DashboardLayout>
  );
};

export default DashboardPage;