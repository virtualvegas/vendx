import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import GlobalOperations from "@/components/dashboard/tabs/GlobalOperations";
import EventsRentals from "@/components/dashboard/tabs/EventsRentals";
import TechnicalSupport from "@/components/dashboard/tabs/TechnicalSupport";
import Finance from "@/components/dashboard/tabs/Finance";
import FinanceManager from "@/components/dashboard/tabs/FinanceManager";
import Marketing from "@/components/dashboard/tabs/Marketing";
import InventoryLogistics from "@/components/dashboard/tabs/InventoryLogistics";
import RegionalReports from "@/components/dashboard/tabs/RegionalReports";
import DailyTasks from "@/components/dashboard/tabs/DailyTasks";
import AdminSettings from "@/components/dashboard/tabs/AdminSettings";
import IncomeStreamsManager from "@/components/dashboard/tabs/admin/IncomeStreamsManager";
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
import ArcadeGameTitlesManager from "@/components/dashboard/tabs/ArcadeGameTitlesManager";
import PrizeWinsManager from "@/components/dashboard/tabs/PrizeWinsManager";
import TicketPrizesManager from "@/components/dashboard/tabs/TicketPrizesManager";
import PrizeInventoryManager from "@/components/dashboard/tabs/PrizeInventoryManager";
import EcoSnackLockersManager from "@/components/dashboard/tabs/EcoSnackLockersManager";
import MachineInventoryManager from "@/components/dashboard/tabs/MachineInventoryManager";
import MediaManager from "@/components/dashboard/tabs/MediaManager";
import MediaShopManager from "@/components/dashboard/tabs/MediaShopManager";
import TrackShopManager from "@/components/dashboard/tabs/TrackShopManager";
import GlobalAnalytics from "@/components/dashboard/tabs/GlobalAnalytics";
import PoliciesManager from "@/components/dashboard/tabs/PoliciesManager";
import AdReachManager from "@/components/dashboard/tabs/AdReachManager";
import ArtistsManager from "@/components/dashboard/tabs/ArtistsManager";
import ReleaseTracksManager from "@/components/dashboard/tabs/ReleaseTracksManager";
import BusinessAdReach from "@/components/dashboard/tabs/business-owner/BusinessAdReach";
import ArtistPayoutsManager from "@/components/dashboard/tabs/ArtistPayoutsManager";
import GiftCardManager from "@/components/dashboard/tabs/GiftCardManager";
import AuditLogsViewer from "@/components/dashboard/tabs/AuditLogsViewer";
import EcoVendSuggestionsManager from "@/components/dashboard/tabs/EcoVendSuggestionsManager";
import ServiceTech from "@/components/dashboard/tabs/ServiceTech";
import OfficesManager from "@/components/dashboard/tabs/OfficesManager";
import { useSEO } from "@/hooks/useSEO";
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
  | "business_owner"
  | "support";

const DashboardPage = () => {
  useSEO({
    title: "Dashboard — VendX",
    description: "Manage your VendX account, orders, wallet, rewards, and more from your personalized dashboard.",
  });
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
    // Support agents
    if (userRoles.includes("support")) {
      return "technical-support";
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

  const NON_ADMIN_TABS = [
    "my-orders", "my-wallet", "my-tickets", "my-rewards",
    "business-overview", "business-locations", "business-machines", "business-payouts", "business-support", "business-adreach",
  ];

  const renderTabContent = () => {
    let content: React.ReactNode;
    switch (activeTab) {
      case "overview":
        content = <DashboardOverview />; break;
      case "business-overview":
        content = <BusinessOverview />; break;
      case "business-locations":
        content = <BusinessLocations />; break;
      case "business-machines":
        content = <BusinessMachines />; break;
      case "business-payouts":
        content = <BusinessPayouts />; break;
      case "business-adreach":
        content = <BusinessAdReach />; break;
      case "business-support":
        content = <BusinessSupport />; break;
      case "my-orders":
        content = <CustomerOrders />; break;
      case "my-wallet":
        content = <CustomerWallet />; break;
      case "my-tickets":
        content = <CustomerTickets />; break;
      case "my-rewards":
        content = <CustomerRewards />; break;
      case "global-operations":
        content = <GlobalOperations />; break;
      case "events-rentals":
        content = <EventsRentals />; break;
      case "technical-support":
        content = <TechnicalSupport />; break;
      case "finance":
        content = <Finance />; break;
      case "finance-manager":
        content = <FinanceManager />; break;
      case "marketing":
        content = <Marketing />; break;
      case "inventory-logistics":
        content = <InventoryLogistics />; break;
      case "regional-reports":
        content = <RegionalReports />; break;
      case "daily-tasks":
        content = <DailyTasks />; break;
      case "admin-settings":
        content = <AdminSettings />; break;
      case "income-streams":
        content = <IncomeStreamsManager />; break;
      case "careers":
        content = <CareersManager />; break;
      case "locations":
        content = <GlobalLocations />; break;
      case "offices":
        content = <OfficesManager />; break;
      case "vendx-pay":
        content = <VendXPayManager />; break;
      case "gift-cards":
        content = <GiftCardManager />; break;
      case "rewards-manager":
        content = <RewardsManager />; break;
      case "machine-registry":
        content = <MachineRegistry />; break;
      case "partner-offers":
        content = <PartnerOffersManager />; break;
      case "my-route":
        content = <MyRoute />; break;
      case "service-tech":
        content = <ServiceTech />; break;
      case "route-manager":
        content = <RouteManager />; break;
      case "store-manager":
        content = <StoreManager />; break;
      case "products-manager":
        content = <ProductsManager />; break;
      case "video-games":
        content = <VideoGamesManager />; break;
      case "payouts":
        content = <PayoutsManager />; break;
      case "profit-splits":
        content = <ProfitSplitsManager />; break;
      case "kiosk-categories":
        content = <KioskCategoriesManager />; break;
      case "funnels":
        content = <FunnelManager />; break;
      case "waitlist-manager":
        content = <WaitlistManager />; break;
      case "news":
        content = <NewsManager />; break;
      case "divisions-manager":
        content = <DivisionsManager />; break;
      case "stands-manager":
        content = <StandsManager />; break;
      case "quests-manager":
        content = <QuestsManager />; break;
      case "business-content":
        content = <BusinessContentManager />; break;
      case "ticket-config":
        content = <TicketConfigManager />; break;
      case "arcade-analytics":
        content = <ArcadeAnalytics />; break;
      case "arcade-game-titles":
        content = <ArcadeGameTitlesManager />; break;
      case "prize-wins":
        content = <PrizeWinsManager />; break;
      case "ticket-prizes":
        content = <TicketPrizesManager />; break;
      case "prize-inventory":
        content = <PrizeInventoryManager />; break;
      case "ecosnack-lockers":
        content = <EcoSnackLockersManager />; break;
      case "machine-inventory":
        content = <MachineInventoryManager />; break;
      case "media-manager":
        content = <MediaManager />; break;
      case "artists-manager":
        content = <ArtistsManager />; break;
      case "releases-tracks":
        content = <ReleaseTracksManager />; break;
      case "media-shop-manager":
        content = <MediaShopManager />; break;
      case "track-shop-manager":
        content = <TrackShopManager />; break;
      case "global-analytics":
        content = <GlobalAnalytics />; break;
      case "adreach-manager":
        content = <AdReachManager />; break;
      case "site-policies":
        content = <PoliciesManager />; break;
      case "artist-payouts":
        content = <ArtistPayoutsManager />; break;
      case "audit-logs":
        content = <AuditLogsViewer />; break;
      case "ecovend-suggestions":
        content = <EcoVendSuggestionsManager />; break;
      default:
        content = <CustomerOrders />; break;
    }

    if (!NON_ADMIN_TABS.includes(activeTab)) {
      return (
        <div className="w-full overflow-x-auto pb-4">
          {content}
        </div>
      );
    }

    return content;
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