import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QuestNode, Quest } from "@/pages/QuestsPage";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MapPin, 
  Clock, 
  Star, 
  Zap, 
  Gift, 
  DollarSign,
  Navigation,
  QrCode,
  Gamepad2,
  ShoppingCart,
  Check,
  Lock
} from "lucide-react";

interface QuestNodeSheetProps {
  node: QuestNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userLocation: { lat: number; lng: number } | null;
  userId?: string;
  onStartQuest: (quest: Quest, node: QuestNode) => void;
}

const rarityColors: Record<string, string> = {
  common: "from-gray-500 to-gray-600",
  rare: "from-blue-500 to-blue-600",
  epic: "from-purple-500 to-purple-600",
  legendary: "from-amber-500 to-orange-500",
};

const questTypeIcons: Record<string, React.ReactNode> = {
  free: <MapPin className="w-4 h-4" />,
  game: <Gamepad2 className="w-4 h-4" />,
  paid: <DollarSign className="w-4 h-4" />,
  order: <ShoppingCart className="w-4 h-4" />,
};

const questTypeLabels: Record<string, string> = {
  free: "Free Quest",
  game: "Game Quest",
  paid: "Paid Quest",
  order: "Purchase Quest",
};

const difficultyColors: Record<string, string> = {
  easy: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  hard: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  extreme: "bg-red-500/20 text-red-400 border-red-500/30",
};

const QuestNodeSheet = ({
  node,
  open,
  onOpenChange,
  userLocation,
  userId,
  onStartQuest,
}: QuestNodeSheetProps) => {
  // Fetch quests available at this node
  const { data: quests = [], isLoading } = useQuery({
    queryKey: ["node-quests", node?.id],
    queryFn: async () => {
      if (!node) return [];

      const { data, error } = await supabase
        .from("quest_node_assignments")
        .select(`
          quest:quests(*)
        `)
        .eq("node_id", node.id)
        .eq("is_active", true);

      if (error) throw error;
      return (data?.map((d: any) => d.quest).filter(Boolean) || []) as Quest[];
    },
    enabled: !!node,
  });

  // Fetch user's completions for these quests
  const { data: completions = [] } = useQuery({
    queryKey: ["quest-completions", node?.id, userId],
    queryFn: async () => {
      if (!userId || !node) return [];

      const { data, error } = await supabase
        .from("quest_completions")
        .select("quest_id, status")
        .eq("user_id", userId)
        .eq("node_id", node.id);

      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!node,
  });

  const getDirectionsUrl = () => {
    if (!node) return "#";
    const lat = node.latitude || node.location?.latitude;
    const lng = node.longitude || node.location?.longitude;
    
    if (lat && lng) {
      const userAgent = navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      const isAndroid = /android/.test(userAgent);

      if (isIOS) {
        return `maps://maps.apple.com/?daddr=${lat},${lng}`;
      } else if (isAndroid) {
        return `geo:0,0?q=${lat},${lng}`;
      } else {
        return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      }
    }
    return "#";
  };

  const isQuestCompleted = (questId: string) => {
    return completions.some((c) => c.quest_id === questId && (c.status === "completed" || c.status === "claimed"));
  };

  const isQuestInProgress = (questId: string) => {
    return completions.some((c) => c.quest_id === questId && c.status === "in_progress");
  };

  if (!node) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] sm:h-[80vh] rounded-t-3xl">
        <ScrollArea className="h-full">
          <div className="pb-8">
            {/* Header with gradient */}
            <div className={`-mx-6 -mt-6 px-6 pt-8 pb-6 bg-gradient-to-br ${rarityColors[node.rarity]} mb-6`}>
              <SheetHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="bg-white/20 text-white border-0 capitalize">
                    {node.rarity}
                  </Badge>
                  <Badge variant="secondary" className="bg-white/20 text-white border-0 capitalize">
                    {node.node_type}
                  </Badge>
                </div>
                <SheetTitle className="text-2xl font-bold text-white">{node.name}</SheetTitle>
                {node.description && (
                  <p className="text-white/80 text-sm mt-2">{node.description}</p>
                )}
              </SheetHeader>
            </div>

            {/* Location Info */}
            {!node.is_virtual && (
              <div className="mb-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">
                    {node.location?.address || `${node.location?.city}, ${node.location?.country}` || "Location"}
                  </span>
                </div>
                <a href={getDirectionsUrl()} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full gap-2">
                    <Navigation className="w-4 h-4" />
                    Get Directions
                  </Button>
                </a>
              </div>
            )}

            <Separator className="my-6" />

            {/* Available Quests */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Available Quests
              </h3>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : quests.length === 0 ? (
                <Card className="bg-muted/50">
                  <CardContent className="p-6 text-center">
                    <Gift className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No quests available at this node right now</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {quests.map((quest) => {
                    const completed = isQuestCompleted(quest.id);
                    const inProgress = isQuestInProgress(quest.id);

                    return (
                      <Card key={quest.id} className={completed ? "opacity-60" : ""}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                                {questTypeIcons[quest.quest_type]}
                              </div>
                              <div>
                                <h4 className="font-semibold text-foreground">{quest.title}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {questTypeLabels[quest.quest_type]}
                                </p>
                              </div>
                            </div>
                            {completed && (
                              <Badge className="bg-accent text-accent-foreground gap-1">
                                <Check className="w-3 h-3" />
                                Done
                              </Badge>
                            )}
                          </div>

                          <p className="text-sm text-muted-foreground mb-3">
                            {quest.short_description || quest.description}
                          </p>

                          {/* Requirements */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            {quest.requires_checkin && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <MapPin className="w-3 h-3" />
                                Check-in
                              </Badge>
                            )}
                            {quest.requires_qr_scan && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <QrCode className="w-3 h-3" />
                                QR Scan
                              </Badge>
                            )}
                            {quest.estimated_time_minutes && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <Clock className="w-3 h-3" />
                                ~{quest.estimated_time_minutes}min
                              </Badge>
                            )}
                            <Badge className={difficultyColors[quest.difficulty]} variant="outline">
                              {quest.difficulty}
                            </Badge>
                          </div>

                          {/* Rewards */}
                          <div className="flex items-center gap-3 mb-4">
                            <div className="flex items-center gap-1 text-sm">
                              <Star className="w-4 h-4 text-accent" />
                              <span className="font-semibold">{quest.xp_reward} XP</span>
                            </div>
                            {quest.credits_reward && quest.credits_reward > 0 && (
                              <div className="flex items-center gap-1 text-sm">
                                <DollarSign className="w-4 h-4 text-primary" />
                                <span className="font-semibold">${quest.credits_reward}</span>
                              </div>
                            )}
                            {quest.points_reward && quest.points_reward > 0 && (
                              <div className="flex items-center gap-1 text-sm">
                                <Gift className="w-4 h-4 text-purple-400" />
                                <span className="font-semibold">{quest.points_reward} pts</span>
                              </div>
                            )}
                          </div>

                          {/* Action Button */}
                          {!userId ? (
                            <Button disabled className="w-full gap-2">
                              <Lock className="w-4 h-4" />
                              Login to Start
                            </Button>
                          ) : completed ? (
                            <Button disabled variant="secondary" className="w-full gap-2">
                              <Check className="w-4 h-4" />
                              Completed
                            </Button>
                          ) : inProgress ? (
                            <Button variant="secondary" className="w-full">
                              In Progress...
                            </Button>
                          ) : (
                            <Button
                              onClick={() => onStartQuest(quest, node)}
                              className="w-full gap-2"
                            >
                              <Zap className="w-4 h-4" />
                              {quest.quest_type === "paid" || quest.quest_type === "order"
                                ? `Start Quest ($${quest.required_purchase_amount || 0})`
                                : "Start Quest"}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default QuestNodeSheet;
