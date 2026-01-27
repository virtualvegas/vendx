import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Target,
  Clock,
  Zap,
  Star,
  MapPin,
  Flame,
  Gift,
  CheckCircle2,
} from "lucide-react";

interface DailyChallengesProps {
  userId: string;
  progress: any;
}

interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  current: number;
  target: number;
  reward: number;
  rewardType: "xp" | "credits" | "points";
  completed: boolean;
}

const DailyChallenges = ({ userId, progress }: DailyChallengesProps) => {
  // Fetch today's completions count
  const { data: todayStats } = useQuery({
    queryKey: ["today-quest-stats", userId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("quest_completions")
        .select("id, xp_earned, node_id")
        .eq("user_id", userId)
        .gte("completed_at", today.toISOString())
        .in("status", ["completed", "claimed"]);

      if (error) throw error;

      const uniqueNodes = new Set(data?.map((c) => c.node_id).filter(Boolean));

      return {
        questsCompleted: data?.length || 0,
        xpEarned: data?.reduce((sum, c) => sum + (c.xp_earned || 0), 0) || 0,
        nodesVisited: uniqueNodes.size,
      };
    },
    enabled: !!userId,
  });

  // Calculate time until reset
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const hoursUntilReset = Math.ceil((tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60));

  // Generate daily challenges based on stats
  const challenges: DailyChallenge[] = [
    {
      id: "daily-quest-1",
      title: "First Steps",
      description: "Complete 1 quest today",
      icon: <Zap className="w-5 h-5 text-primary" />,
      current: Math.min(todayStats?.questsCompleted || 0, 1),
      target: 1,
      reward: 50,
      rewardType: "xp",
      completed: (todayStats?.questsCompleted || 0) >= 1,
    },
    {
      id: "daily-quest-3",
      title: "Quest Hunter",
      description: "Complete 3 quests today",
      icon: <Target className="w-5 h-5 text-purple-400" />,
      current: Math.min(todayStats?.questsCompleted || 0, 3),
      target: 3,
      reward: 150,
      rewardType: "xp",
      completed: (todayStats?.questsCompleted || 0) >= 3,
    },
    {
      id: "daily-explore-2",
      title: "Explorer",
      description: "Visit 2 different nodes",
      icon: <MapPin className="w-5 h-5 text-blue-400" />,
      current: Math.min(todayStats?.nodesVisited || 0, 2),
      target: 2,
      reward: 100,
      rewardType: "xp",
      completed: (todayStats?.nodesVisited || 0) >= 2,
    },
    {
      id: "daily-streak",
      title: "Keep the Flame",
      description: "Maintain your streak",
      icon: <Flame className="w-5 h-5 text-orange-400" />,
      current: (progress?.current_streak || 0) > 0 ? 1 : 0,
      target: 1,
      reward: 0.25,
      rewardType: "credits",
      completed: (progress?.current_streak || 0) > 0,
    },
  ];

  const completedCount = challenges.filter((c) => c.completed).length;
  const allCompleted = completedCount === challenges.length;

  return (
    <Card className="bg-gradient-to-br from-card to-muted/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Star className="w-5 h-5 text-primary-foreground" />
            </div>
            Daily Challenges
          </CardTitle>
          <Badge variant="outline" className="gap-1 text-xs">
            <Clock className="w-3 h-3" />
            {hoursUntilReset}h left
          </Badge>
        </div>
        <Progress 
          value={(completedCount / challenges.length) * 100} 
          className="h-2 mt-2" 
        />
        <p className="text-xs text-muted-foreground mt-1">
          {completedCount}/{challenges.length} completed
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {challenges.map((challenge) => (
          <div
            key={challenge.id}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
              challenge.completed
                ? "bg-accent/10 border border-accent/30"
                : "bg-muted/50 border border-transparent"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                challenge.completed ? "bg-accent/20" : "bg-muted"
              }`}
            >
              {challenge.completed ? (
                <CheckCircle2 className="w-5 h-5 text-accent" />
              ) : (
                challenge.icon
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className={`font-semibold text-sm ${
                    challenge.completed ? "text-accent" : "text-foreground"
                  }`}
                >
                  {challenge.title}
                </p>
                {challenge.completed && (
                  <Badge className="bg-accent text-accent-foreground text-xs h-5">
                    Done!
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{challenge.description}</p>
              {!challenge.completed && (
                <Progress
                  value={(challenge.current / challenge.target) * 100}
                  className="h-1 mt-1"
                />
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Reward</p>
              <p className={`font-bold text-sm ${challenge.completed ? "text-accent" : "text-primary"}`}>
                {challenge.rewardType === "credits" ? `$${challenge.reward}` : `+${challenge.reward}`}
                {challenge.rewardType === "xp" && " XP"}
                {challenge.rewardType === "points" && " pts"}
              </p>
            </div>
          </div>
        ))}

        {allCompleted && (
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 text-center">
            <Gift className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="font-bold text-foreground">All Challenges Complete!</p>
            <p className="text-sm text-muted-foreground">
              Come back tomorrow for new challenges
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyChallenges;
