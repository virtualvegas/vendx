import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/hooks/useCart";
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
import CartPage from "./pages/CartPage";
import SnackBoxPage from "./pages/SnackBoxPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";
import VideoGamesPage from "./pages/VideoGamesPage";
import GamesPlayerPage from "./pages/GamesPlayerPage";
import LocationsPage from "./pages/LocationsPage";
import LocationDetailPage from "./pages/LocationDetailPage";
import LinksPage from "./pages/LinksPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/divisions" element={<DivisionsPage />} />
            <Route path="/divisions/:slug" element={<DivisionDetailPage />} />
            <Route path="/games" element={<VideoGamesPage />} />
            <Route path="/games-player" element={<GamesPlayerPage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/locations/:id" element={<LocationDetailPage />} />
            <Route path="/careers" element={<CareersPage />} />
            <Route path="/careers/:id" element={<JobDetailPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/links" element={<LinksPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/rewards" element={<RewardsPage />} />
            <Route path="/kiosk" element={<KioskPage />} />
            <Route path="/store" element={<StorePage />} />
            <Route path="/store/cart" element={<CartPage />} />
            <Route path="/store/snack-in-the-box" element={<SnackBoxPage />} />
            <Route path="/store/order-success" element={<OrderSuccessPage />} />
            <Route path="/store/:slug" element={<ProductPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
