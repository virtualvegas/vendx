import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy,
  Medal,
  Crown,
  Star,
  TrendingUp,
  User,
  Zap,
  MapPin,
} from "lucide-react";

interface LeaderboardProps {
  userId?: string;
}

interface LeaderboardEntry {
  id: string;
  user_id: string;
  xp_earned: number;
  quests_completed: number;
  nodes_visited: number;
  rank: number;
  display_name?: string;
}

const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().split("T")[0];
};

const getMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
};

const rankIcons: Record<number, React.ReactNode> = {
  1: <Crown className="w-5 h-5 text-amber-400" />,
  2: <Medal className="w-5 h-5 text-gray-300" />,
  3: <Medal className="w-5 h-5 text-amber-600" />,
};

const rankColors: Record<number, string> = {
  1: "bg-gradient-to-r from-accent/20 to-accent/30 border-accent/50",
  2: "bg-gradient-to-r from-muted-foreground/20 to-muted-foreground/30 border-muted-foreground/50",
  3: "bg-gradient-to-r from-primary/20 to-primary/30 border-primary/50",
};

const Leaderboard = ({ userId }: LeaderboardProps) => {
  // Fetch weekly leaderboard
  const { data: weeklyData, isLoading: weeklyLoading } = useQuery({
    queryKey: ["leaderboard-weekly"],
    queryFn: async () => {
      const weekStart = getWeekStart();
      
      const { data, error } = await supabase
        .from("quest_leaderboards")
        .select("*")
        .eq("period", "weekly")
        .eq("period_start", weekStart)
        .order("xp_earned", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch user profiles for display names
      const userIds = data?.map(e => e.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      return (data || []).map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
        display_name: profileMap.get(entry.user_id) || `Player ${entry.user_id.slice(0, 6)}`,
      })) as LeaderboardEntry[];
    },
  });

  // Fetch monthly leaderboard
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ["leaderboard-monthly"],
    queryFn: async () => {
      const monthStart = getMonthStart();
      
      const { data, error } = await supabase
        .from("quest_leaderboards")
        .select("*")
        .eq("period", "monthly")
        .eq("period_start", monthStart)
        .order("xp_earned", { ascending: false })
        .limit(50);

      if (error) throw error;

      const userIds = data?.map(e => e.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      return (data || []).map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
        display_name: profileMap.get(entry.user_id) || `Player ${entry.user_id.slice(0, 6)}`,
      })) as LeaderboardEntry[];
    },
  });

  // Fetch all-time leaderboard from player progress
  const { data: allTimeData, isLoading: allTimeLoading } = useQuery({
    queryKey: ["leaderboard-alltime"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quest_player_progress")
        .select("*")
        .order("total_xp", { ascending: false })
        .limit(50);

      if (error) throw error;

      const userIds = data?.map(e => e.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      return (data || []).map((entry, idx) => ({
        id: entry.id,
        user_id: entry.user_id,
        xp_earned: entry.total_xp,
        quests_completed: entry.quests_completed,
        nodes_visited: entry.nodes_discovered,
        rank: idx + 1,
        display_name: profileMap.get(entry.user_id) || `Player ${entry.user_id.slice(0, 6)}`,
      })) as LeaderboardEntry[];
    },
  });

  const renderLeaderboardList = (
    entries: LeaderboardEntry[] | undefined,
    isLoading: boolean
  ) => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      );
    }

    if (!entries || entries.length === 0) {
      return (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No entries yet</p>
          <p className="text-sm text-muted-foreground">
            Complete quests to appear on the leaderboard!
          </p>
        </div>
      );
    }

    const userEntry = userId ? entries.find(e => e.user_id === userId) : null;

    return (
      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-4">
          {entries.map((entry) => {
            const isCurrentUser = entry.user_id === userId;
            const isTopThree = entry.rank <= 3;

            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isCurrentUser
                    ? "bg-primary/10 border-primary/50"
                    : isTopThree
                    ? rankColors[entry.rank]
                    : "bg-muted/50 border-transparent hover:bg-muted"
                }`}
              >
                {/* Rank */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-background/50">
                  {rankIcons[entry.rank] || (
                    <span className="text-sm font-bold text-muted-foreground">
                      {entry.rank}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <Avatar className="w-10 h-10">
                  <AvatarFallback className={isTopThree ? "bg-primary/20 text-primary" : ""}>
                    {entry.display_name?.charAt(0)?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>

                {/* Name & Stats */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold truncate ${isCurrentUser ? "text-primary" : "text-foreground"}`}>
                      {entry.display_name}
                    </p>
                    {isCurrentUser && (
                      <Badge variant="secondary" className="text-xs">
                        You
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {entry.quests_completed} quests
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {entry.nodes_visited} nodes
                    </span>
                  </div>
                </div>

                {/* XP */}
                <div className="text-right">
                  <p className="font-bold text-foreground">
                    {entry.xp_earned.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">XP</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current user position if not in top 50 */}
        {userId && !userEntry && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm text-center text-muted-foreground mb-2">
              Your position
            </p>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/50">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-background/50">
                <span className="text-sm font-bold text-muted-foreground">?</span>
              </div>
              <Avatar className="w-10 h-10">
                <AvatarFallback>
                  <User className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-primary">You</p>
                <p className="text-xs text-muted-foreground">
                  Complete quests to climb the ranks!
                </p>
              </div>
            </div>
          </div>
        )}
      </ScrollArea>
    );
  };

  return (
    <Card className="bg-gradient-to-br from-card to-muted/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="weekly">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="weekly" className="gap-1">
              <TrendingUp className="w-3 h-3" />
              Weekly
            </TabsTrigger>
            <TabsTrigger value="monthly" className="gap-1">
              <Star className="w-3 h-3" />
              Monthly
            </TabsTrigger>
            <TabsTrigger value="alltime" className="gap-1">
              <Crown className="w-3 h-3" />
              All Time
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weekly">
            {renderLeaderboardList(weeklyData, weeklyLoading)}
          </TabsContent>

          <TabsContent value="monthly">
            {renderLeaderboardList(monthlyData, monthlyLoading)}
          </TabsContent>

          <TabsContent value="alltime">
            {renderLeaderboardList(allTimeData, allTimeLoading)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default Leaderboard;
