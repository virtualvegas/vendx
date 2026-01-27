import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import QuestMap from "@/components/quests/QuestMap";
import QuestSidebar from "@/components/quests/QuestSidebar";
import QuestNodeSheet from "@/components/quests/QuestNodeSheet";
import PlayerStats from "@/components/quests/PlayerStats";
import DailyChallenges from "@/components/quests/DailyChallenges";
import FeaturedQuests from "@/components/quests/FeaturedQuests";
import QuestChainProgress from "@/components/quests/QuestChainProgress";
import LevelUpModal from "@/components/quests/LevelUpModal";
import AchievementToast, { Achievement } from "@/components/quests/AchievementToast";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Map, List, User, Trophy, Flame, Star, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { completeQuest, calculateDistance, validateQuestStart, getXpToNextLevel } from "@/lib/questUtils";

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
  max_completions_per_user: number | null;
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
  const queryClient = useQueryClient();
  const [selectedNode, setSelectedNode] = useState<QuestNode | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [activeTab, setActiveTab] = useState<"explore" | "progress">("explore");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nodeSheetOpen, setNodeSheetOpen] = useState(false);
  
  // Game state
  const [levelUpData, setLevelUpData] = useState<{
    open: boolean;
    newLevel: number;
    xpEarned: number;
    creditsEarned: number;
    pointsEarned: number;
    badgesEarned: string[];
  } | null>(null);
  const [achievement, setAchievement] = useState<Achievement | null>(null);

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
  const { data: playerProgress, refetch: refetchProgress } = useQuery({
    queryKey: ["quest-player-progress", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("quest_player_progress")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
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
          setUserLocation({ lat: 42.3601, lng: -71.0589 }); // Boston default
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

    // Validate quest start
    const validation = await validateQuestStart(user.id, quest.id, node.id);
    if (!validation.canStart) {
      toast({
        title: "Cannot Start Quest",
        description: validation.reason,
        variant: "destructive",
      });
      return;
    }

    // Check if within range
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

    // For free quests that only require check-in, complete immediately
    const shouldCompleteImmediately = 
      quest.quest_type === "free" && 
      !quest.requires_transaction && 
      !quest.requires_qr_scan;

    // Create quest completion entry
    const { data: completionData, error } = await supabase.from("quest_completions").insert({
      user_id: user.id,
      quest_id: quest.id,
      node_id: node.id,
      status: shouldCompleteImmediately ? "completed" : "in_progress",
      checkin_latitude: userLocation?.lat,
      checkin_longitude: userLocation?.lng,
      verified_via: "gps",
    }).select().single();

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to start quest",
        variant: "destructive",
      });
      return;
    }

    // If quest completes immediately, award rewards
    if (shouldCompleteImmediately && completionData) {
      try {
        const result = await completeQuest(user.id, quest.id, node.id, completionData.id);
        
        // Show level up modal if leveled up
        if (result.leveledUp) {
          setLevelUpData({
            open: true,
            newLevel: result.newLevel,
            xpEarned: result.xpEarned,
            creditsEarned: result.creditsEarned,
            pointsEarned: result.pointsEarned,
            badgesEarned: result.badgesEarned || [],
          });
        } else {
          // Show achievement toast for regular completion
          setAchievement({
            id: completionData.id,
            type: "milestone",
            title: `+${result.xpEarned} XP`,
            description: `Quest "${quest.title}" completed!`,
          });
        }

        // Show badge toast if earned
        if (result.badgesEarned && result.badgesEarned.length > 0 && !result.leveledUp) {
          setTimeout(() => {
            setAchievement({
              id: `badge-${Date.now()}`,
              type: "badge",
              title: result.badgesEarned![0],
              description: "New badge unlocked!",
            });
          }, 2000);
        }

        // Refresh data
        refetchProgress();
        queryClient.invalidateQueries({ queryKey: ["quest-discoveries"] });
        queryClient.invalidateQueries({ queryKey: ["quest-completions"] });
        queryClient.invalidateQueries({ queryKey: ["today-quest-stats"] });
      } catch (err: any) {
        console.error("Error completing quest:", err);
        toast({
          title: "Warning",
          description: "Quest started but rewards may need to be claimed manually",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "🎮 Quest Started!",
        description: `You've started: ${quest.title}`,
      });
    }

    // Refresh completions in the sheet
    queryClient.invalidateQueries({ queryKey: ["quest-completions", node.id, user.id] });
  };

  const xpInfo = playerProgress ? getXpToNextLevel(playerProgress.total_xp) : { current: 0, required: 100, progress: 0 };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      {/* Achievement Toast */}
      <AchievementToast
        achievement={achievement}
        onDismiss={() => setAchievement(null)}
      />

      {/* Level Up Modal */}
      {levelUpData && (
        <LevelUpModal
          open={levelUpData.open}
          onClose={() => setLevelUpData(null)}
          newLevel={levelUpData.newLevel}
          xpEarned={levelUpData.xpEarned}
          creditsEarned={levelUpData.creditsEarned}
          pointsEarned={levelUpData.pointsEarned}
          badgesEarned={levelUpData.badgesEarned}
        />
      )}

      <div className="flex-1 flex flex-col pt-16">
        {/* Top Bar with Player Mini Stats */}
        <div className="bg-card/80 backdrop-blur-lg border-b border-border sticky top-16 z-40">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <span className="font-bold text-lg text-foreground">VendX Quests</span>
                  {user && playerProgress && (
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="gap-1 h-5">
                        <Star className="w-3 h-3 text-accent" />
                        Lv.{playerProgress.current_level}
                      </Badge>
                      {playerProgress.current_streak > 0 && (
                        <Badge variant="outline" className="gap-1 h-5">
                          <Flame className="w-3 h-3 text-orange-400" />
                          {playerProgress.current_streak}d
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Mini XP Bar (logged in) */}
                {user && playerProgress && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-muted">
                    <Progress value={xpInfo.progress} className="w-20 h-2" />
                    <span className="text-xs text-muted-foreground font-medium">
                      {xpInfo.current}/{xpInfo.required}
                    </span>
                  </div>
                )}

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
                        <span className="hidden sm:inline">Stats</span>
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
        </div>

        {/* Main Content with Tabs */}
        {user ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "explore" | "progress")} className="flex-1 flex flex-col">
            <div className="border-b border-border bg-card/50">
              <div className="container mx-auto px-4">
                <TabsList className="bg-transparent h-12">
                  <TabsTrigger value="explore" className="data-[state=active]:bg-primary/10 gap-2">
                    <Map className="w-4 h-4" />
                    Explore
                  </TabsTrigger>
                  <TabsTrigger value="progress" className="data-[state=active]:bg-primary/10 gap-2">
                    <Trophy className="w-4 h-4" />
                    Progress
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent value="explore" className="flex-1 mt-0 flex flex-col">
              {/* Featured Quests */}
              <div className="pt-4">
                <FeaturedQuests />
              </div>

              {/* Map or List View */}
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
            </TabsContent>

            <TabsContent value="progress" className="flex-1 mt-0 overflow-y-auto">
              <div className="container mx-auto px-4 py-6 space-y-6">
                {/* Daily Challenges */}
                <DailyChallenges userId={user.id} progress={playerProgress} />

                {/* Quest Chains */}
                <QuestChainProgress userId={user.id} />

                {/* Quick Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-card border border-border text-center">
                    <p className="text-2xl font-bold text-foreground">{playerProgress?.quests_completed || 0}</p>
                    <p className="text-xs text-muted-foreground">Quests Done</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border text-center">
                    <p className="text-2xl font-bold text-foreground">{playerProgress?.nodes_discovered || 0}</p>
                    <p className="text-xs text-muted-foreground">Nodes Found</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border text-center">
                    <p className="text-2xl font-bold text-foreground">{playerProgress?.longest_streak || 0}</p>
                    <p className="text-xs text-muted-foreground">Best Streak</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border text-center">
                    <p className="text-2xl font-bold text-primary">${(playerProgress?.total_credits_earned || 0).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Earned</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          // Non-logged in view
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

            {/* Login Prompt Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/95 to-transparent p-6 text-center">
              <div className="max-w-md mx-auto">
                <h3 className="text-xl font-bold text-foreground mb-2">Ready to Start Your Adventure?</h3>
                <p className="text-muted-foreground mb-4">
                  Login to complete quests, earn rewards, and track your progress!
                </p>
                <Button onClick={() => navigate("/auth")} size="lg" className="w-full sm:w-auto gap-2">
                  <User className="w-5 h-5" />
                  Login to Play
                </Button>
              </div>
            </div>
          </div>
        )}

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

export default QuestsPage;
