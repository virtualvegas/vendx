import Navigation from "@/components/Navigation";
import StarField from "@/components/StarField";
import Hero from "@/components/Hero";
import About from "@/components/About";
import ServicesOverview from "@/components/home/ServicesOverview";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import FeaturedGames from "@/components/home/FeaturedGames";
import FeaturedMusic from "@/components/home/FeaturedMusic";
import FeaturedFilm from "@/components/home/FeaturedFilm";

import Divisions from "@/components/Divisions";

import QuickLinks from "@/components/home/QuickLinks";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";

const Index = () => {
  useSEO({
    title: "VendX Global — Future of Entertainment & Automated Retail",
    description: "VendX operates smart vending, arcades, media, retail and event experiences — one ecosystem for automated retail and entertainment.",
    url: "https://vendxglobal.net/",
  });
  return (
    <div className="relative min-h-screen bg-background">
      <StarField />
      <Navigation />
      
      <div className="relative z-10">
        <Hero />
        <FeaturedProducts />
        <FeaturedGames />
        <FeaturedMusic />
        <FeaturedFilm />
        
        <ServicesOverview />
        <Divisions />
        <About />
        <Contact />
        <Footer />
      </div>
    </div>
  );
};

export default Index;
