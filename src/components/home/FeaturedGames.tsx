import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Gamepad2, ArrowRight, Play, ExternalLink, Calendar } from "lucide-react";
import { formatDisplayDate, parseLocalDate } from "@/lib/dateUtils";
import { SiSteam, SiGoogleplay, SiApple, SiItchdotio, SiRoblox } from "react-icons/si";
import vendxInteractiveLogo from "@/assets/vendx-interactive-logo.png";

interface VideoGame {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  cover_image_url: string | null;
  release_date: string | null;
  release_status: string;
  trailer_url: string | null;
  steam_url: string | null;
  google_play_url: string | null;
  apple_store_url: string | null;
  itch_io_url: string | null;
  roblox_url: string | null;
  browser_play_url: string | null;
  is_featured: boolean | null;
}

const statusColors: Record<string, string> = {
  released: "bg-accent text-accent-foreground",
  live: "bg-accent text-accent-foreground",
  beta: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  coming_soon: "bg-primary/20 text-primary border-primary/30",
  in_development: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const statusLabels: Record<string, string> = {
  released: "Live",
  live: "Live",
  beta: "Beta",
  coming_soon: "Coming Soon",
  in_development: "In Development",
};

const FeaturedGames = () => {
  const { data: games, isLoading } = useQuery({
    queryKey: ["featured-games-home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_games")
        .select("*")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("display_order", { ascending: true })
        .limit(3);

      if (error) throw error;
      return data as VideoGame[];
    },
  });

  const getPlatformIcons = (game: VideoGame) => {
    const icons = [];
    if (game.steam_url) icons.push(<SiSteam key="steam" className="w-4 h-4" />);
    if (game.google_play_url) icons.push(<SiGoogleplay key="play" className="w-4 h-4" />);
    if (game.apple_store_url) icons.push(<SiApple key="apple" className="w-4 h-4" />);
    if (game.itch_io_url) icons.push(<SiItchdotio key="itch" className="w-4 h-4" />);
    if (game.roblox_url) icons.push(<SiRoblox key="roblox" className="w-4 h-4" />);
    return icons;
  };

  return (
    <section className="py-20 relative bg-gradient-to-b from-transparent via-card/30 to-transparent">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div className="flex items-center gap-4">
            <img 
              src={vendxInteractiveLogo} 
              alt="VendX Interactive" 
              className="h-12 md:h-16"
            />
            <div>
              <h2 className="text-4xl lg:text-5xl font-bold">
                <span className="text-purple-400">VendX</span> Interactive
              </h2>
              <p className="text-muted-foreground text-lg">
                Play our games across all major platforms
              </p>
            </div>
          </div>
          <Link to="/games">
            <Button variant="outline" className="gap-2 group border-purple-500/50 text-purple-400 hover:bg-purple-500/10">
              View All Games
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="bg-card/50 border-border/50">
                <Skeleton className="h-48 rounded-t-lg" />
                <CardContent className="p-5">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-8 w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : games && games.length > 0 ? (
            games.map((game) => (
              <Card
                key={game.id}
                className="group bg-card/50 border-border/50 hover:border-purple-500/50 transition-all duration-300 overflow-hidden"
              >
                <div className="relative h-48 bg-muted overflow-hidden">
                  {game.cover_image_url ? (
                    <img
                      src={game.cover_image_url}
                      alt={game.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gamepad2 className="w-16 h-16 text-muted-foreground/30" />
                    </div>
                  )}
                  
                  <Badge
                    className={`absolute top-3 right-3 ${statusColors[game.release_status] || statusColors.coming_soon}`}
                  >
                    {statusLabels[game.release_status] || game.release_status}
                  </Badge>

                  {game.trailer_url && (
                    <a
                      href={game.trailer_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center">
                        <Play className="w-6 h-6 text-white ml-1" />
                      </div>
                    </a>
                  )}
                </div>

                <CardContent className="p-5">
                  <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-purple-400 transition-colors">
                    {game.title}
                  </h3>
                  
                  {game.short_description && (
                    <p className="text-muted-foreground text-sm mb-2 line-clamp-2">
                      {game.short_description}
                    </p>
                  )}

                  {game.release_date && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {(() => {
                          const releaseDate = parseLocalDate(game.release_date);
                          const now = new Date();
                          if (releaseDate > now) return `Releases ${formatDisplayDate(game.release_date)}`;
                          return formatDisplayDate(game.release_date);
                        })()}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2 text-muted-foreground">
                      {getPlatformIcons(game)}
                    </div>
                    {game.browser_play_url && (
                      <Link to="/games-player">
                        <Button size="sm" className="gap-1 bg-purple-600 hover:bg-purple-700">
                          <Gamepad2 className="w-3 h-3" />
                          Play Now
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <Gamepad2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No featured games available</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default FeaturedGames;
