import { ExternalLink, ArrowLeft, Shield, LayoutDashboard, ClipboardList, Headphones, MapPin, BarChart3, Settings, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";

const teamLinks = [
  {
    name: "Employee Portal",
    url: "https://portal.vendx.space",
    icon: LayoutDashboard,
    color: "from-primary to-blue-400",
    description: "Access your employee dashboard, schedules & resources",
    external: true,
  },
  {
    name: "Admin Dashboard",
    url: "/dashboard",
    icon: Settings,
    color: "from-accent to-emerald-400",
    description: "Internal management dashboard for operations",
    external: false,
  },
  {
    name: "Route Manager",
    url: "/dashboard/my-route",
    icon: MapPin,
    color: "from-cyan-500 to-blue-500",
    description: "View and manage your assigned route stops",
    external: false,
  },
  {
    name: "Daily Tasks",
    url: "/dashboard/daily-tasks",
    icon: ClipboardList,
    color: "from-orange-500 to-yellow-500",
    description: "Today's task list and priorities",
    external: false,
  },
  {
    name: "Technical Support",
    url: "/dashboard/technical-support",
    icon: Headphones,
    color: "from-purple-500 to-pink-500",
    description: "Submit and track support tickets",
    external: false,
  },
  {
    name: "Analytics & Reports",
    url: "/dashboard/analytics",
    icon: BarChart3,
    color: "from-indigo-500 to-purple-500",
    description: "View performance metrics and reports",
    external: false,
  },
  {
    name: "Machine Registry",
    url: "/dashboard/machine-registry",
    icon: Shield,
    color: "from-rose-500 to-red-500",
    description: "Manage and monitor all deployed machines",
    external: false,
  },
  {
    name: "Company Policies",
    url: "/policy/terms",
    icon: BookOpen,
    color: "from-slate-500 to-gray-400",
    description: "Employee handbook, terms & company policies",
    external: false,
  },
];

const TeamLinksPage = () => {
  useSEO({
    title: "VendX Team Links — Employee Resources",
    description: "Internal links and resources for VendX team members.",
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 pt-24 pb-16">
        {/* Back */}
        <Link to="/links" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Links
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-medium mb-4">
            <Shield className="w-4 h-4" />
            Team Only
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Team Links
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Quick access to employee portals, tools & internal resources
          </p>
        </div>

        {/* Links */}
        <div className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-3">
          {teamLinks.map((link) => {
            const content = (
              <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 overflow-hidden h-full">
                <CardContent className="p-0">
                  <div className="flex items-center gap-4 p-4">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                      <link.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                          {link.name}
                        </h3>
                        {link.external && <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                      <p className="text-sm text-muted-foreground">{link.description}</p>
                    </div>
                  </div>
                  <div className={`h-0.5 bg-gradient-to-r ${link.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                </CardContent>
              </Card>
            );

            if (link.external) {
              return (
                <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" className="block group">
                  {content}
                </a>
              );
            }

            return (
              <Link key={link.name} to={link.url} className="block group">
                {content}
              </Link>
            );
          })}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default TeamLinksPage;
