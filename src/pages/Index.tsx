import StarField from "@/components/StarField";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Features from "@/components/Features";
import Divisions from "@/components/Divisions";
import Stats from "@/components/Stats";
import MarsSection from "@/components/MarsSection";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="relative min-h-screen bg-background">
      <StarField />
      
      <div className="relative z-10">
        <Hero />
        <About />
        <Features />
        <Divisions />
        <Stats />
        <MarsSection />
        <Contact />
        <Footer />
      </div>
    </div>
  );
};

export default Index;
