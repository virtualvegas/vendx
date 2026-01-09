import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import BusinessOwnerDashboard from "@/components/dashboard/tabs/BusinessOwnerDashboard";
import PayoutsManager from "@/components/dashboard/tabs/PayoutsManager";
import ProfitSplitsManager from "@/components/dashboard/tabs/ProfitSplitsManager";
import KioskCategoriesManager from "@/components/dashboard/tabs/KioskCategoriesManager";
import FunnelManager from "@/components/dashboard/tabs/FunnelManager";
import NewsManager from "@/components/dashboard/tabs/NewsManager";

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
  const [activeTab, setActiveTab] = useState("my-orders");
  const navigate = useNavigate();
  const { toast } = useToast();

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
      case "business-owner":
        return <BusinessOwnerDashboard />;
      case "my-orders":
        return <CustomerOrders />;
      case "my-wallet":
        return <CustomerWallet />;
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
      case "news":
        return <NewsManager />;
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
      setActiveTab={setActiveTab}
      hasAccess={hasAccess}
    >
      {renderTabContent()}
    </DashboardLayout>
  );
};

export default DashboardPage;