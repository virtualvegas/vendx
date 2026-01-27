import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { 
  Link, 
  CheckCircle2, 
  Circle, 
  Lock, 
  Star, 
  Gift,
  ChevronRight 
} from "lucide-react";

interface QuestChainProgressProps {
  userId: string;
}

const QuestChainProgress = ({ userId }: QuestChainProgressProps) => {
  // Fetch chains and their steps
  const { data: chains = [] } = useQuery({
    queryKey: ["quest-chains", userId],
    queryFn: async () => {
      const { data: chainsData, error: chainsError } = await supabase
        .from("quest_chains")
        .select(`
          *,
          steps:quest_chain_steps(
            *,
            quest:quests(id, title, xp_reward)
          )
        `)
        .eq("is_active", true)
        .order("name");

      if (chainsError) throw chainsError;

      // For each chain, get user's completions
      const chainsWithProgress = await Promise.all(
        (chainsData || []).map(async (chain: any) => {
          const questIds = chain.steps?.map((s: any) => s.quest?.id).filter(Boolean) || [];

          if (questIds.length === 0) {
            return { ...chain, completedCount: 0, progress: 0 };
          }

          const { data: completions } = await supabase
            .from("quest_completions")
            .select("quest_id")
            .eq("user_id", userId)
            .in("quest_id", questIds)
            .in("status", ["completed", "claimed"]);

          const completedIds = new Set(completions?.map((c) => c.quest_id) || []);
          const completedCount = questIds.filter((id: string) => completedIds.has(id)).length;

          return {
            ...chain,
            completedCount,
            completedIds,
            progress: (completedCount / questIds.length) * 100,
          };
        })
      );

      return chainsWithProgress;
    },
    enabled: !!userId,
  });

  if (chains.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3 px-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Link className="w-5 h-5 text-accent" />
          Quest Chains
        </h3>
        <Badge variant="secondary" className="text-xs">
          {chains.filter((c: any) => c.progress === 100).length}/{chains.length} complete
        </Badge>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 px-4 pb-4">
          {chains.map((chain: any) => {
            const isComplete = chain.progress === 100;
            const sortedSteps = [...(chain.steps || [])].sort(
              (a: any, b: any) => a.step_order - b.step_order
            );

            return (
              <Card
                key={chain.id}
                className={`min-w-[300px] ${
                  isComplete
                    ? "bg-gradient-to-br from-accent/10 to-accent/5 border-accent/30"
                    : "bg-card border-border"
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {chain.icon_url ? (
                        <img src={chain.icon_url} alt="" className="w-8 h-8" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                          <Link className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                      <CardTitle className="text-base">{chain.name}</CardTitle>
                    </div>
                    {isComplete && (
                      <Badge className="bg-accent text-accent-foreground gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Complete
                      </Badge>
                    )}
                  </div>
                  {chain.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                      {chain.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pb-4">
                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium text-foreground">
                        {chain.completedCount}/{sortedSteps.length}
                      </span>
                    </div>
                    <Progress value={chain.progress} className="h-2" />
                  </div>

                  {/* Steps Preview */}
                  <div className="flex items-center gap-1 mb-3">
                    {sortedSteps.slice(0, 5).map((step: any, idx: number) => {
                      const isStepComplete = chain.completedIds?.has(step.quest?.id);
                      const isLocked =
                        idx > 0 && !chain.completedIds?.has(sortedSteps[idx - 1]?.quest?.id);

                      return (
                        <div key={step.id} className="flex items-center">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              isStepComplete
                                ? "bg-accent text-accent-foreground"
                                : isLocked
                                ? "bg-muted text-muted-foreground"
                                : "bg-primary/20 text-primary"
                            }`}
                          >
                            {isStepComplete ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : isLocked ? (
                              <Lock className="w-3 h-3" />
                            ) : (
                              <Circle className="w-4 h-4" />
                            )}
                          </div>
                          {idx < sortedSteps.slice(0, 5).length - 1 && (
                            <div
                              className={`w-3 h-0.5 ${
                                isStepComplete ? "bg-accent" : "bg-muted"
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                    {sortedSteps.length > 5 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        +{sortedSteps.length - 5}
                      </span>
                    )}
                  </div>

                  {/* Chain Rewards */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Gift className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Bonus:</span>
                    {chain.bonus_xp > 0 && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Star className="w-3 h-3" />
                        {chain.bonus_xp} XP
                      </Badge>
                    )}
                    {Number(chain.bonus_credits) > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        ${Number(chain.bonus_credits).toFixed(2)}
                      </Badge>
                    )}
                  </div>
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

export default QuestChainProgress;
