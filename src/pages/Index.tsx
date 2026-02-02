import Navigation from "@/components/Navigation";
import StarField from "@/components/StarField";
import Hero from "@/components/Hero";
import About from "@/components/About";
import ServicesOverview from "@/components/home/ServicesOverview";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import FeaturedGames from "@/components/home/FeaturedGames";
import Divisions from "@/components/Divisions";

import QuickLinks from "@/components/home/QuickLinks";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="relative min-h-screen bg-background">
      <StarField />
      <Navigation />
      
      <div className="relative z-10">
        <Hero />
        <About />
        <ServicesOverview />
        <FeaturedProducts />
        <FeaturedGames />
        <Divisions />
        
        <QuickLinks />
        <Contact />
        <Footer />
      </div>
    </div>
  );
};

export default Index;
