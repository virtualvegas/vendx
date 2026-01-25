import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import QuestMap from "@/components/quests/QuestMap";
import QuestSidebar from "@/components/quests/QuestSidebar";
import QuestNodeSheet from "@/components/quests/QuestNodeSheet";
import PlayerStats from "@/components/quests/PlayerStats";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Map, List, User, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface QuestNode {
  id: string;
  name: string;
  description: string | null;
  location_id: string | null;
  machine_id: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  node_type: string;
  is_active: boolean;
  is_virtual: boolean;
  icon_url: string | null;
  color: string;
  cooldown_hours: number;
  location?: {
    name: string | null;
    address: string | null;
    city: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
  };
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  short_description: string | null;
  quest_type: "free" | "game" | "paid" | "order";
  status: string;
  xp_reward: number;
  points_reward: number | null;
  credits_reward: number | null;
  required_purchase_amount: number | null;
  requires_checkin: boolean;
  requires_qr_scan: boolean;
  requires_transaction: boolean;
  icon_url: string | null;
  difficulty: string;
  estimated_time_minutes: number | null;
  is_featured: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface PlayerProgress {
  id: string;
  user_id: string;
  total_xp: number;
  current_level: number;
  quests_completed: number;
  nodes_discovered: number;
  current_streak: number;
  longest_streak: number;
  total_credits_earned: number;
  total_points_earned: number;
}

const QuestsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedNode, setSelectedNode] = useState<QuestNode | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nodeSheetOpen, setNodeSheetOpen] = useState(false);

  // Check if user is logged in
  const { data: user } = useQuery({
    queryKey: ["quest-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch quest nodes with location data
  const { data: nodes = [], isLoading: nodesLoading } = useQuery({
    queryKey: ["quest-nodes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quest_nodes")
        .select(`
          *,
          location:locations(name, address, city, country, latitude, longitude)
        `)
        .eq("is_active", true);

      if (error) throw error;
      return data as QuestNode[];
    },
  });

  // Fetch player progress
  const { data: playerProgress } = useQuery({
    queryKey: ["quest-player-progress", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("quest_player_progress")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as PlayerProgress | null;
    },
    enabled: !!user,
  });

  // Fetch user's discovered nodes
  const { data: discoveredNodes = [] } = useQuery({
    queryKey: ["quest-discoveries", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("quest_node_discoveries")
        .select("node_id")
        .eq("user_id", user.id);

      if (error) throw error;
      return data.map(d => d.node_id);
    },
    enabled: !!user,
  });

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Geolocation error:", error);
          // Default to a central location
          setUserLocation({ lat: 42.3601, lng: -71.0589 }); // Boston
        }
      );
    }
  }, []);

  const handleNodeSelect = (node: QuestNode) => {
    setSelectedNode(node);
    setNodeSheetOpen(true);
  };

  const handleStartQuest = async (quest: Quest, node: QuestNode) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to start quests",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    // Check if within range (if requires checkin)
    if (quest.requires_checkin && userLocation && node.latitude && node.longitude) {
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        Number(node.latitude),
        Number(node.longitude)
      );

      if (distance > (node.radius_meters || 50)) {
        toast({
          title: "Too Far Away",
          description: `You need to be within ${node.radius_meters || 50}m of this location`,
          variant: "destructive",
        });
        return;
      }
    }

    // Create quest completion entry
    const { error } = await supabase.from("quest_completions").insert({
      user_id: user.id,
      quest_id: quest.id,
      node_id: node.id,
      status: quest.requires_checkin || quest.requires_transaction ? "in_progress" : "completed",
      checkin_latitude: userLocation?.lat,
      checkin_longitude: userLocation?.lng,
      verified_via: "gps",
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to start quest",
        variant: "destructive",
      });
      return;
    }

    // Record node discovery
    await supabase.from("quest_node_discoveries").upsert({
      user_id: user.id,
      node_id: node.id,
      last_visited_at: new Date().toISOString(),
    }, { onConflict: "user_id,node_id" });

    toast({
      title: "Quest Started!",
      description: `You've started: ${quest.title}`,
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <div className="flex-1 flex flex-col pt-16">
        {/* Top Bar */}
        <div className="bg-card/80 backdrop-blur-lg border-b border-border sticky top-16 z-40">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Map className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg text-foreground">VendX Quests</span>
            </div>

            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="bg-muted rounded-lg p-1 flex gap-1">
                <Button
                  variant={viewMode === "map" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("map")}
                  className="h-8 px-3"
                >
                  <Map className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-8 px-3"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>

              {/* Player Stats Button */}
              {user && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Trophy className="w-4 h-4 text-accent" />
                      <span className="hidden sm:inline">Lv.{playerProgress?.current_level || 1}</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                    <PlayerStats 
                      progress={playerProgress} 
                      userId={user.id} 
                    />
                  </SheetContent>
                </Sheet>
              )}

              {!user && (
                <Button onClick={() => navigate("/auth")} size="sm" className="gap-2">
                  <User className="w-4 h-4" />
                  Login
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 relative">
          {viewMode === "map" ? (
            <QuestMap
              nodes={nodes}
              userLocation={userLocation}
              onNodeSelect={handleNodeSelect}
              discoveredNodes={discoveredNodes}
              isLoading={nodesLoading}
            />
          ) : (
            <QuestSidebar
              nodes={nodes}
              userLocation={userLocation}
              onNodeSelect={handleNodeSelect}
              discoveredNodes={discoveredNodes}
              isLoading={nodesLoading}
            />
          )}
        </div>

        {/* Node Detail Sheet */}
        <QuestNodeSheet
          node={selectedNode}
          open={nodeSheetOpen}
          onOpenChange={setNodeSheetOpen}
          userLocation={userLocation}
          userId={user?.id}
          onStartQuest={handleStartQuest}
        />
      </div>
    </div>
  );
};

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export default QuestsPage;
