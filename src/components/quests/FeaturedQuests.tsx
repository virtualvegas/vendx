import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Star,
  Zap,
  Clock,
  MapPin,
  ChevronRight,
  Gift,
  DollarSign,
} from "lucide-react";

interface FeaturedQuestsProps {
  onQuestSelect?: (questId: string) => void;
}

const difficultyColors: Record<string, string> = {
  easy: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  hard: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  extreme: "bg-red-500/20 text-red-400 border-red-500/30",
};

const FeaturedQuests = ({ onQuestSelect }: FeaturedQuestsProps) => {
  const { data: featuredQuests = [] } = useQuery({
    queryKey: ["featured-quests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quests")
        .select(`
          *,
          quest_node_assignments(
            node:quest_nodes(id, name, rarity, node_type)
          )
        `)
        .eq("status", "active")
        .eq("is_featured", true)
        .order("sort_order", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  if (featuredQuests.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3 px-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Featured Quests
        </h3>
        <Badge variant="secondary" className="text-xs">
          {featuredQuests.length} available
        </Badge>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 px-4 pb-4">
          {featuredQuests.map((quest: any) => {
            const firstNode = quest.quest_node_assignments?.[0]?.node;
            const hasCredits = Number(quest.credits_reward) > 0;

            return (
              <Card
                key={quest.id}
                className="min-w-[280px] bg-gradient-to-br from-card to-primary/5 border-primary/20 hover:border-primary/50 transition-all cursor-pointer group"
                onClick={() => onQuestSelect?.(quest.id)}
              >
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <Zap className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {quest.title}
                        </p>
                        <Badge
                          className={`${difficultyColors[quest.difficulty]} text-xs`}
                          variant="outline"
                        >
                          {quest.difficulty}
                        </Badge>
                      </div>
                    </div>
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {quest.short_description || quest.description}
                  </p>

                  {/* Location */}
                  {firstNode && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{firstNode.name}</span>
                      <Badge variant="outline" className="text-xs capitalize ml-1">
                        {firstNode.rarity}
                      </Badge>
                    </div>
                  )}

                  {/* Rewards */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="w-4 h-4 text-accent" />
                      <span className="font-semibold text-foreground">
                        {quest.xp_reward} XP
                      </span>
                    </div>
                    {hasCredits && (
                      <div className="flex items-center gap-1 text-sm">
                        <DollarSign className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-primary">
                          ${Number(quest.credits_reward).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {quest.points_reward > 0 && (
                      <div className="flex items-center gap-1 text-sm">
                        <Gift className="w-4 h-4 text-purple-400" />
                        <span className="font-semibold text-purple-400">
                          {quest.points_reward} pts
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Time estimate */}
                  {quest.estimated_time_minutes && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>~{quest.estimated_time_minutes} min</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};

export default FeaturedQuests;
