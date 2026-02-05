import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, MapPin, Gamepad2, Clock, Star, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface PrizeWin {
  id: string;
  user_id: string | null;
  prize_name: string;
  prize_value: number;
  prize_type: string;
  photo_url: string | null;
  created_at: string;
  verified: boolean;
  machine?: { name: string; machine_code: string } | null;
  location?: { name: string | null; city: string } | null;
  profile?: { full_name: string | null; email: string } | null;
}

interface PrizeWinsFeedProps {
  limit?: number;
  showLocation?: boolean;
  userId?: string;
  compact?: boolean;
}

const prizeTypeColors: Record<string, string> = {
  standard: "bg-muted text-muted-foreground",
  jackpot: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50",
  bonus: "bg-blue-500/20 text-blue-500 border-blue-500/50",
  grand: "bg-purple-500/20 text-purple-500 border-purple-500/50",
};

const prizeTypeIcons: Record<string, typeof Trophy> = {
  standard: Trophy,
  jackpot: Sparkles,
  bonus: Star,
  grand: Trophy,
};

export const PrizeWinsFeed = ({ 
  limit = 10, 
  showLocation = true, 
  userId,
  compact = false 
}: PrizeWinsFeedProps) => {
  const { data: wins, isLoading } = useQuery({
    queryKey: ["prize-wins-feed", limit, userId],
    queryFn: async () => {
      let query = supabase
        .from("prize_wins")
        .select(`
          id, user_id, prize_name, prize_value, prize_type, photo_url, created_at, verified,
          machine:vendx_machines(name, machine_code),
          location:locations(name, city),
          profile:profiles(full_name, email)
        `)
        .eq("verified", true)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as PrizeWin[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading recent wins...
        </CardContent>
      </Card>
    );
  }

  if (!wins || wins.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No prize wins yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Recent Wins
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className={compact ? "h-[250px]" : "h-[400px]"}>
          <AnimatePresence>
            <div className="divide-y">
              {wins.map((win, index) => {
                const Icon = prizeTypeIcons[win.prize_type] || Trophy;
                const displayName = win.profile?.full_name || 
                  win.profile?.email?.split("@")[0] || 
                  "Anonymous";
                const initials = displayName.substring(0, 2).toUpperCase();

                return (
                  <motion.div
                    key={win.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{displayName}</span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${prizeTypeColors[win.prize_type] || prizeTypeColors.standard}`}
                          >
                            <Icon className="h-3 w-3 mr-1" />
                            {win.prize_type}
                          </Badge>
                        </div>

                        <p className="text-sm font-semibold text-primary mt-1">
                          {win.prize_name}
                          {win.prize_value > 0 && (
                            <span className="text-muted-foreground ml-2">
                              ({win.prize_value.toLocaleString()} tickets)
                            </span>
                          )}
                        </p>

                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          {win.machine && (
                            <span className="flex items-center gap-1">
                              <Gamepad2 className="h-3 w-3" />
                              {win.machine.name || win.machine.machine_code}
                            </span>
                          )}
                          {showLocation && win.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {win.location.name || win.location.city}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(win.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      {win.photo_url && (
                        <img 
                          src={win.photo_url} 
                          alt="Prize" 
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default PrizeWinsFeed;
