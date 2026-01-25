import { useMemo } from "react";
import { QuestNode } from "@/pages/QuestsPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  MapPin, 
  Search, 
  Coffee, 
  Gamepad2, 
  Target, 
  Users, 
  PartyPopper, 
  Globe,
  CheckCircle2,
  Star
} from "lucide-react";
import { useState } from "react";

interface QuestSidebarProps {
  nodes: QuestNode[];
  userLocation: { lat: number; lng: number } | null;
  onNodeSelect: (node: QuestNode) => void;
  discoveredNodes: string[];
  isLoading: boolean;
}

const rarityColors: Record<string, string> = {
  common: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  rare: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  epic: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  legendary: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const nodeTypeIcons: Record<string, React.ReactNode> = {
  vending: <Coffee className="w-4 h-4" />,
  arcade: <Gamepad2 className="w-4 h-4" />,
  claw: <Target className="w-4 h-4" />,
  partner: <Users className="w-4 h-4" />,
  event: <PartyPopper className="w-4 h-4" />,
  virtual: <Globe className="w-4 h-4" />,
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

const QuestSidebar = ({ nodes, userLocation, onNodeSelect, discoveredNodes, isLoading }: QuestSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [rarityFilter, setRarityFilter] = useState<string | null>(null);

  const sortedNodes = useMemo(() => {
    let filtered = nodes.filter((node) => {
      const matchesSearch =
        !searchQuery ||
        node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.location?.city?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRarity = !rarityFilter || node.rarity === rarityFilter;

      return matchesSearch && matchesRarity;
    });

    // Sort by distance if user location available
    if (userLocation) {
      filtered = filtered
        .map((node) => {
          const lat = node.latitude || node.location?.latitude;
          const lng = node.longitude || node.location?.longitude;
          const distance = lat && lng
            ? calculateDistance(userLocation.lat, userLocation.lng, Number(lat), Number(lng))
            : Infinity;
          return { ...node, distance };
        })
        .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    }

    return filtered;
  }, [nodes, searchQuery, rarityFilter, userLocation]);

  if (isLoading) {
    return (
      <div className="h-full min-h-[calc(100vh-8rem)] bg-background p-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[calc(100vh-8rem)] bg-background flex flex-col">
      {/* Search & Filters */}
      <div className="p-4 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={rarityFilter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setRarityFilter(null)}
          >
            All
          </Button>
          {["common", "rare", "epic", "legendary"].map((rarity) => (
            <Button
              key={rarity}
              variant={rarityFilter === rarity ? "default" : "outline"}
              size="sm"
              onClick={() => setRarityFilter(rarity)}
              className="capitalize"
            >
              {rarity}
            </Button>
          ))}
        </div>
      </div>

      {/* Node List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {sortedNodes.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No nodes found</p>
            </div>
          ) : (
            sortedNodes.map((node) => {
              const isDiscovered = discoveredNodes.includes(node.id);
              const distance = (node as any).distance;

              return (
                <Card
                  key={node.id}
                  className="cursor-pointer hover:border-primary/50 transition-all group"
                  onClick={() => onNodeSelect(node)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Node Icon */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${node.color || "#00d4ff"}, ${node.color || "#00d4ff"}88)`,
                        }}
                      >
                        {nodeTypeIcons[node.node_type] || <MapPin className="w-5 h-5" />}
                      </div>

                      {/* Node Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {node.name}
                          </h3>
                          {isDiscovered && (
                            <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                          )}
                          {node.rarity === "legendary" && (
                            <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground truncate mb-2">
                          {node.location?.address || node.location?.city || "Virtual Location"}
                        </p>

                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={rarityColors[node.rarity]} variant="outline">
                            {node.rarity}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            {nodeTypeIcons[node.node_type]}
                            {node.node_type}
                          </Badge>
                          {distance !== undefined && distance !== Infinity && (
                            <Badge variant="secondary">
                              {formatDistance(distance)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default QuestSidebar;
