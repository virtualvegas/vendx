import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlayerProgress } from "@/pages/QuestsPage";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getXpToNextLevel } from "@/lib/questUtils";
import {
  Trophy,
  Star,
  Zap,
  MapPin,
  Flame,
  Award,
  TrendingUp,
  Clock,
  Medal,
} from "lucide-react";

interface PlayerStatsProps {
  progress: PlayerProgress | null;
  userId: string;
}

const PlayerStats = ({ progress, userId }: PlayerStatsProps) => {
  // Fetch player badges
  const { data: badges = [] } = useQuery({
    queryKey: ["player-badges", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quest_player_badges")
        .select(`
          *,
          badge:quest_badges(*)
        `)
        .eq("user_id", userId)
        .order("earned_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch recent completions (both completed and claimed)
  const { data: recentCompletions = [] } = useQuery({
    queryKey: ["recent-completions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quest_completions")
        .select(`
          *,
          quest:quests(title, xp_reward)
        `)
        .eq("user_id", userId)
        .in("status", ["completed", "claimed"])
        .order("completed_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  // Fetch leaderboard position (weekly)
  const { data: leaderboardData } = useQuery({
    queryKey: ["leaderboard-rank", userId],
    queryFn: async () => {
      // Get current week's leaderboard - calculate week start manually
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const weekStartDate = new Date(now.setDate(diff));
      weekStartDate.setHours(0, 0, 0, 0);
      const weekStart = weekStartDate.toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("quest_leaderboards")
        .select("*")
        .eq("period", "weekly")
        .eq("period_start", weekStart)
        .order("xp_earned", { ascending: false })
        .limit(10);

      if (error) throw error;
      
      // Find user's rank
      const userEntry = data?.find(d => d.user_id === userId);
      const userRank = userEntry ? data.indexOf(userEntry) + 1 : null;
      
      return { entries: data || [], userRank, userEntry };
    },
  });

  const currentLevel = progress?.current_level || 1;
  const totalXp = progress?.total_xp || 0;
  const xpInfo = getXpToNextLevel(totalXp);
  const leaderboardRank = leaderboardData?.userRank;

  return (
    <ScrollArea className="h-full">
      <div className="py-6 space-y-6">
        {/* Level & XP Header */}
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center w-24 h-24 mb-4">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent opacity-20 animate-pulse" />
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-3xl font-bold text-primary-foreground">{currentLevel}</span>
            </div>
          </div>
          <h2 className="text-xl font-bold text-foreground">Level {currentLevel}</h2>
          <p className="text-sm text-muted-foreground mb-4">Quest Adventurer</p>

          {/* XP Progress */}
          <div className="px-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">XP Progress</span>
              <span className="font-semibold text-foreground">
                {xpInfo.current.toLocaleString()} / {xpInfo.required.toLocaleString()}
              </span>
            </div>
            <Progress value={xpInfo.progress} className="h-3" />
            <p className="text-xs text-muted-foreground mt-1">
              {(xpInfo.required - xpInfo.current).toLocaleString()} XP to next level
            </p>
          </div>
        </div>

        <Separator />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 px-4">
          <Card className="bg-muted/50">
            <CardContent className="p-4 text-center">
              <Star className="w-6 h-6 text-accent mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{totalXp.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total XP</p>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="p-4 text-center">
              <Zap className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{progress?.quests_completed || 0}</p>
              <p className="text-xs text-muted-foreground">Quests Done</p>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="p-4 text-center">
              <MapPin className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{progress?.nodes_discovered || 0}</p>
              <p className="text-xs text-muted-foreground">Nodes Found</p>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="p-4 text-center">
              <Flame className="w-6 h-6 text-orange-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{progress?.current_streak || 0}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </CardContent>
          </Card>
        </div>

        {/* Leaderboard Rank */}
        {leaderboardRank && (
          <>
            <Separator />
            <Card className="mx-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Global Rank</p>
                  <p className="text-xl font-bold text-foreground">#{leaderboardRank}</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Badges */}
        <div className="px-4">
          <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Award className="w-5 h-5 text-accent" />
            Badges ({badges.length})
          </h3>

          {badges.length === 0 ? (
            <Card className="bg-muted/50">
              <CardContent className="p-6 text-center">
                <Award className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Complete quests to earn badges!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {badges.slice(0, 8).map((pb: any) => (
                <div
                  key={pb.id}
                  className="aspect-square rounded-xl bg-muted/50 flex items-center justify-center p-2"
                  title={pb.badge?.name}
                >
                  {pb.badge?.icon_url ? (
                    <img
                      src={pb.badge.icon_url}
                      alt={pb.badge.name}
                      className="w-8 h-8"
                    />
                  ) : (
                    <Trophy className="w-6 h-6 text-accent" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="px-4">
          <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            Recent Activity
          </h3>

          {recentCompletions.length === 0 ? (
            <Card className="bg-muted/50">
              <CardContent className="p-6 text-center">
                <Zap className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No completed quests yet
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentCompletions.map((completion: any) => (
                <Card key={completion.id} className="bg-muted/50">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium truncate">
                        {completion.quest?.title}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      +{completion.quest?.xp_reward} XP
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Earnings Summary */}
        <div className="px-4 pb-4">
          <h3 className="text-lg font-semibold text-foreground mb-3">Total Earnings</h3>
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="p-4 text-center">
                <p className="text-xl font-bold text-primary">
                  ${progress?.total_credits_earned?.toFixed(2) || "0.00"}
                </p>
                <p className="text-xs text-muted-foreground">Credits Earned</p>
              </CardContent>
            </Card>
            <Card className="bg-accent/10 border-accent/30">
              <CardContent className="p-4 text-center">
                <p className="text-xl font-bold text-accent">
                  {progress?.total_points_earned?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-muted-foreground">Points Earned</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

export default PlayerStats;
