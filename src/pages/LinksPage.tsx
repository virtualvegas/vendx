import { ExternalLink, Zap, PartyPopper, Gamepad2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const links = [
  {
    name: "VendX",
    url: "https://vendx.space",
    icon: Zap,
    color: "from-primary to-blue-400",
    description: "The Future of Vending",
    details: "AI-powered vending systems with real-time tracking, digital & crypto payments, and solar-powered sustainability. Building the world's largest automated retail network across 150+ countries.",
  },
  {
    name: "Northeast Amusements",
    url: "https://northeastamusements.com",
    icon: Gamepad2,
    color: "from-purple-500 to-pink-500",
    description: "Event Amusement Equipment",
    details: "Arcade games, skill games, and interactive attractions for town events, festivals, fairs, and community gatherings. Professional, safe, and crowd-friendly entertainment for public events.",
  },
  {
    name: "Host Heroz",
    url: "https://hostheroz.com",
    icon: PartyPopper,
    color: "from-orange-500 to-yellow-500",
    description: "Party Rental Marketplace",
    details: "Discover arcade games, photo booths, DJ services, inflatables, catering, and more from trusted local vendors. The ultimate marketplace for private celebrations and corporate events.",
  },
];

const LinksPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none" />
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Back button */}
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to VendX
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Our Network
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Explore the VendX family of companies — from automated retail to event entertainment
          </p>
        </div>

        {/* Links Grid */}
        <div className="max-w-3xl mx-auto space-y-6">
          {links.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-start gap-4 p-6">
                    {/* Icon */}
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                      <link.icon className="w-7 h-7 text-white" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                          {link.name}
                        </h2>
                        <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-sm font-medium text-primary/80 mb-2">
                        {link.description}
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {link.details}
                      </p>
                    </div>
                  </div>
                  
                  {/* Hover gradient bar */}
                  <div className={`h-1 bg-gradient-to-r ${link.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                </CardContent>
              </Card>
            </a>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">Ready to get started?</p>
          <Link to="/contact">
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
              Contact Us
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LinksPage;
