import { useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Contact from "@/components/Contact";

const ContactPage = () => {
  useEffect(() => {
    // Load Tawk.to chat widget
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = "https://embed.tawk.to/694f24c35823b7197c1538f7/1jdeif8ae";
    script.charset = "UTF-8";
    script.setAttribute("crossorigin", "*");
    document.body.appendChild(script);

    // Cleanup on unmount
    return () => {
      // Remove the script
      document.body.removeChild(script);
      // Remove Tawk.to iframe and elements
      const tawkElements = document.querySelectorAll('[id^="tawk"]');
      tawkElements.forEach((el) => el.remove());
      // Clean up global Tawk variables
      if ((window as any).Tawk_API) {
        delete (window as any).Tawk_API;
      }
      if ((window as any).Tawk_LoadStart) {
        delete (window as any).Tawk_LoadStart;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-32">
        <Contact />
      </main>

      <Footer />
    </div>
  );
};

export default ContactPage;
