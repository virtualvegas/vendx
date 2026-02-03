import { ExternalLink, ShoppingBag, Store, Gamepad2, Disc3, Pill, Coffee } from "lucide-react";
import { FaAmazon } from "react-icons/fa";
import { 
  SiWalmart, 
  SiTarget, 
  SiEbay, 
  SiEtsy,
  SiSteam,
  SiPlaystation
} from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RetailLink {
  store: string;
  url: string;
}

interface RetailLinksProps {
  links: RetailLink[];
  compact?: boolean;
}

const storeConfig: Record<string, { 
  name: string; 
  icon: React.ReactNode; 
  color: string;
  bgColor: string;
}> = {
  amazon: {
    name: "Amazon",
    icon: <FaAmazon className="w-5 h-5" />,
    color: "text-[#FF9900]",
    bgColor: "bg-[#FF9900]/10 hover:bg-[#FF9900]/20"
  },
  walmart: {
    name: "Walmart",
    icon: <SiWalmart className="w-5 h-5" />,
    color: "text-[#0071CE]",
    bgColor: "bg-[#0071CE]/10 hover:bg-[#0071CE]/20"
  },
  target: {
    name: "Target",
    icon: <SiTarget className="w-5 h-5" />,
    color: "text-[#CC0000]",
    bgColor: "bg-[#CC0000]/10 hover:bg-[#CC0000]/20"
  },
  ebay: {
    name: "eBay",
    icon: <SiEbay className="w-5 h-5" />,
    color: "text-[#E53238]",
    bgColor: "bg-[#E53238]/10 hover:bg-[#E53238]/20"
  },
  etsy: {
    name: "Etsy",
    icon: <SiEtsy className="w-5 h-5" />,
    color: "text-[#F56400]",
    bgColor: "bg-[#F56400]/10 hover:bg-[#F56400]/20"
  },
  bestbuy: {
    name: "Best Buy",
    icon: <ShoppingBag className="w-5 h-5" />,
    color: "text-[#0046BE]",
    bgColor: "bg-[#0046BE]/10 hover:bg-[#0046BE]/20"
  },
  costco: {
    name: "Costco",
    icon: <Store className="w-5 h-5" />,
    color: "text-[#E31837]",
    bgColor: "bg-[#E31837]/10 hover:bg-[#E31837]/20"
  },
  gamestop: {
    name: "GameStop",
    icon: <Gamepad2 className="w-5 h-5" />,
    color: "text-[#FF0000]",
    bgColor: "bg-[#FF0000]/10 hover:bg-[#FF0000]/20"
  },
  cvs: {
    name: "CVS",
    icon: <Pill className="w-5 h-5" />,
    color: "text-[#CC0000]",
    bgColor: "bg-[#CC0000]/10 hover:bg-[#CC0000]/20"
  },
  walgreens: {
    name: "Walgreens",
    icon: <Pill className="w-5 h-5" />,
    color: "text-[#E31837]",
    bgColor: "bg-[#E31837]/10 hover:bg-[#E31837]/20"
  },
  "7eleven": {
    name: "7-Eleven",
    icon: <Coffee className="w-5 h-5" />,
    color: "text-[#008061]",
    bgColor: "bg-[#008061]/10 hover:bg-[#008061]/20"
  },
  steam: {
    name: "Steam",
    icon: <SiSteam className="w-5 h-5" />,
    color: "text-[#1B2838]",
    bgColor: "bg-[#1B2838]/10 hover:bg-[#1B2838]/20"
  },
  playstation: {
    name: "PlayStation Store",
    icon: <SiPlaystation className="w-5 h-5" />,
    color: "text-[#003087]",
    bgColor: "bg-[#003087]/10 hover:bg-[#003087]/20"
  },
  xbox: {
    name: "Xbox Store",
    icon: <Gamepad2 className="w-5 h-5" />,
    color: "text-[#107C10]",
    bgColor: "bg-[#107C10]/10 hover:bg-[#107C10]/20"
  },
  physical: {
    name: "Physical Copy",
    icon: <Disc3 className="w-5 h-5" />,
    color: "text-muted-foreground",
    bgColor: "bg-muted hover:bg-muted/80"
  },
  other: {
    name: "Other",
    icon: <ExternalLink className="w-5 h-5" />,
    color: "text-muted-foreground",
    bgColor: "bg-muted hover:bg-muted/80"
  }
};

export const AVAILABLE_STORES = [
  { value: "amazon", label: "Amazon" },
  { value: "walmart", label: "Walmart" },
  { value: "target", label: "Target" },
  { value: "gamestop", label: "GameStop" },
  { value: "cvs", label: "CVS" },
  { value: "walgreens", label: "Walgreens" },
  { value: "7eleven", label: "7-Eleven" },
  { value: "bestbuy", label: "Best Buy" },
  { value: "costco", label: "Costco" },
  { value: "ebay", label: "eBay" },
  { value: "etsy", label: "Etsy" },
  { value: "steam", label: "Steam" },
  { value: "playstation", label: "PlayStation Store" },
  { value: "xbox", label: "Xbox Store" },
  { value: "physical", label: "Physical Copy" },
  { value: "other", label: "Other" }
];

const RetailLinks = ({ links, compact = false }: RetailLinksProps) => {
  if (!links || links.length === 0) return null;

  const validLinks = links.filter(link => link.url && link.store);

  if (validLinks.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {validLinks.map((link, index) => {
          const config = storeConfig[link.store] || storeConfig.other;
          return (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor} ${config.color} transition-colors text-sm font-medium`}
            >
              {config.icon}
              <span>{config.name}</span>
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-primary" />
          Also Available At
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {validLinks.map((link, index) => {
            const config = storeConfig[link.store] || storeConfig.other;
            return (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  className={`w-full justify-start gap-3 h-12 ${config.color} border-current/20 hover:border-current/40`}
                >
                  {config.icon}
                  <span className="truncate">{config.name}</span>
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </Button>
              </a>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default RetailLinks;
