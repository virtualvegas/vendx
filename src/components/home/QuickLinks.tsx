import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Briefcase, 
  Newspaper, 
  Calendar, 
  HelpCircle, 
  Users,
  ChevronRight
} from "lucide-react";

const links = [
  {
    icon: Briefcase,
    title: "Careers",
    description: "Join our growing team",
    href: "/careers",
  },
  {
    icon: Newspaper,
    title: "News & Updates",
    description: "Latest from VendX",
    href: "/news",
  },
  {
    icon: Calendar,
    title: "Events & Rentals",
    description: "Rent machines for events",
    href: "/events",
  },
  {
    icon: Users,
    title: "About Us",
    description: "Our mission and vision",
    href: "/about",
  },
];

const QuickLinks = () => {
  return (
    <section className="py-16 relative border-t border-border/50">
      <div className="container mx-auto px-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {links.map((link) => (
            <Link
              key={link.title}
              to={link.href}
              className="group flex items-center gap-4 p-4 rounded-xl bg-card/30 border border-border/50 hover:border-primary/50 hover:bg-card/50 transition-all"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <link.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {link.title}
                </h4>
                <p className="text-sm text-muted-foreground truncate">
                  {link.description}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default QuickLinks;
