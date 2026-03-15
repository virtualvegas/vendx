import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "@/hooks/useCart";
import { useShopifyCartSync } from "@/hooks/useShopifyCartSync";
import { toast } from "sonner";
import Index from "./pages/Index";
import AboutPage from "./pages/AboutPage";
import DivisionsPage from "./pages/DivisionsPage";
import DivisionDetailPage from "./pages/DivisionDetailPage";
import CareersPage from "./pages/CareersPage";
import JobDetailPage from "./pages/JobDetailPage";
import ContactPage from "./pages/ContactPage";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import WalletPage from "./pages/WalletPage";
import RewardsPage from "./pages/RewardsPage";
import KioskPage from "./pages/KioskPage";
import StorePage from "./pages/StorePage";
import ProductPage from "./pages/ProductPage";
import ShopifyProductPage from "./pages/ShopifyProductPage";
import CartPage from "./pages/CartPage";
import SnackBoxPage from "./pages/SnackBoxPage";
import ArcadeSubscriptionPage from "./pages/ArcadeSubscriptionPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";
import VideoGamesPage from "./pages/VideoGamesPage";
import MediaPage from "./pages/MediaPage";
// MediaShopPage removed - merch now on artist profiles
import TrackShopPage from "./pages/TrackShopPage";
import BeatDownloadPage from "./pages/BeatDownloadPage";
import GamesPlayerPage from "./pages/GamesPlayerPage";
import LocationsPage from "./pages/LocationsPage";
import LocationDetailPage from "./pages/LocationDetailPage";
import EventsPage from "./pages/EventsPage";
import StandDetailPage from "./pages/StandDetailPage";
import LinksPage from "./pages/LinksPage";
import TeamLinksPage from "./pages/TeamLinksPage";
import NewsPage from "./pages/NewsPage";
import NewsArticlePage from "./pages/NewsArticlePage";
import FunnelPage from "./pages/FunnelPage";
import QuestsPage from "./pages/QuestsPage";
import NotFound from "./pages/NotFound";
import BusinessPage from "./pages/BusinessPage";
import TicketRedemptionPage from "./pages/TicketRedemptionPage";
import ArcadePayPage from "./pages/ArcadePayPage";
import EcoSnackCheckoutPage from "./pages/EcoSnackCheckoutPage";
import EcoSnackSuccessPage from "./pages/EcoSnackSuccessPage";
import PolicyPage from "./pages/PolicyPage";
import AdReachPage from "./pages/AdReachPage";
import ArtistsListPage from "./pages/ArtistsListPage";
import ArtistPage from "./pages/ArtistPage";
import ArtistShopPage from "./pages/ArtistShopPage";

const queryClient = new QueryClient();

// Component to initialize Shopify cart sync and global error handling
const ShopifyCartSyncInitializer = ({ children }: { children: React.ReactNode }) => {
  useShopifyCartSync();
  
  // Global unhandled rejection handler to prevent blank pages from async errors
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      toast.error("An unexpected error occurred. Please try again.");
      event.preventDefault(); // Prevent default console error logging
    };

    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <ShopifyCartSyncInitializer>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/business" element={<BusinessPage />} />
              <Route path="/divisions" element={<DivisionsPage />} />
              <Route path="/divisions/:slug" element={<DivisionDetailPage />} />
              <Route path="/games" element={<VideoGamesPage />} />
              <Route path="/games-player" element={<GamesPlayerPage />} />
              <Route path="/media" element={<MediaPage />} />
              {/* /media/shop removed - merch now lives on artist profiles */}
              <Route path="/media/track-shop" element={<TrackShopPage />} />
              <Route path="/media/download" element={<BeatDownloadPage />} />
              <Route path="/media/artists" element={<ArtistsListPage />} />
              <Route path="/media/artists/:slug" element={<ArtistPage />} />
              <Route path="/media/artists/:slug/shop" element={<ArtistShopPage />} />
              <Route path="/locations" element={<LocationsPage />} />
              <Route path="/locations/events" element={<EventsPage />} />
              <Route path="/locations/:id" element={<LocationDetailPage />} />
              <Route path="/stands/:slug" element={<StandDetailPage />} />
              <Route path="/careers" element={<CareersPage />} />
              <Route path="/careers/:id" element={<JobDetailPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/links" element={<LinksPage />} />
              <Route path="/team-links" element={<TeamLinksPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/:tab" element={<DashboardPage />} />
              <Route path="/wallet" element={<Navigate to="/dashboard/my-wallet" replace />} />
              <Route path="/rewards" element={<RewardsPage />} />
              <Route path="/arcade-pay" element={<ArcadePayPage />} />
              <Route path="/kiosk" element={<KioskPage />} />
              <Route path="/store" element={<StorePage />} />
              <Route path="/store/cart" element={<CartPage />} />
              <Route path="/store/snack-in-the-box" element={<SnackBoxPage />} />
              <Route path="/store/arcade-subscription" element={<ArcadeSubscriptionPage />} />
              <Route path="/store/order-success" element={<OrderSuccessPage />} />
              <Route path="/store/product/:handle" element={<ShopifyProductPage />} />
              <Route path="/store/:slug" element={<ProductPage />} />
              <Route path="/funnel/:slug" element={<FunnelPage />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/news/:slug" element={<NewsArticlePage />} />
              <Route path="/quests" element={<QuestsPage />} />
              <Route path="/tickets/redeem" element={<TicketRedemptionPage />} />
              <Route path="/ecosnack/:machineCode" element={<EcoSnackCheckoutPage />} />
              <Route path="/ecosnack/success" element={<EcoSnackSuccessPage />} />
              <Route path="/policy/:slug" element={<PolicyPage />} />
              <Route path="/adreach" element={<AdReachPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ShopifyCartSyncInitializer>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
