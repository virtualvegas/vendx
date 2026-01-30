import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import StarField from "@/components/StarField";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  SiSteam, 
  SiGoogleplay, 
  SiApple,
  SiItchdotio,
  SiPlaystation,
  SiNintendoswitch,
  SiEpicgames,
  SiRoblox
} from "react-icons/si";
import { FaXbox, FaAmazon } from "react-icons/fa";
import { Monitor, Globe } from "lucide-react";
import { Gamepad2, ExternalLink, Play, Filter } from "lucide-react";
import vendxInteractiveLogo from "@/assets/vendx-interactive-logo.png";

interface VideoGame {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  full_description: string | null;
  platforms: string[];
  release_status: string;
  cover_image_url: string | null;
  trailer_url: string | null;
  steam_url: string | null;
  google_play_url: string | null;
  apple_store_url: string | null;
  microsoft_store_url: string | null;
  itch_io_url: string | null;
  amazon_app_store_url: string | null;
  xbox_store_url: string | null;
  playstation_store_url: string | null;
  nintendo_eshop_url: string | null;
  epic_games_store_url: string | null;
  browser_play_url: string | null;
  is_featured: boolean | null;
}

const platformIcons: Record<string, React.ReactNode> = {
  steam: <SiSteam className="w-5 h-5" />,
  google_play: <SiGoogleplay className="w-5 h-5" />,
  android: <SiGoogleplay className="w-5 h-5" />,
  apple: <SiApple className="w-5 h-5" />,
  ios: <SiApple className="w-5 h-5" />,
  windows: <Monitor className="w-5 h-5" />,
  itch_io: <SiItchdotio className="w-5 h-5" />,
  itchio: <SiItchdotio className="w-5 h-5" />,
  amazon: <FaAmazon className="w-5 h-5" />,
  xbox: <FaXbox className="w-5 h-5" />,
  playstation: <SiPlaystation className="w-5 h-5" />,
  nintendo: <SiNintendoswitch className="w-5 h-5" />,
  epic: <SiEpicgames className="w-5 h-5" />,
  roblox: <SiRoblox className="w-5 h-5" />,
  browser: <Globe className="w-5 h-5" />,
};

const platformLabels: Record<string, string> = {
  steam: "Steam",
  google_play: "Google Play",
  android: "Google Play",
  apple: "App Store",
  ios: "App Store",
  windows: "Microsoft Store",
  itch_io: "itch.io",
  itchio: "itch.io",
  amazon: "Amazon Appstore",
  xbox: "Xbox Store",
  playstation: "PlayStation Store",
  nintendo: "Nintendo eShop",
  epic: "Epic Games",
  roblox: "Roblox",
  browser: "Play in Browser",
};

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

const VideoGamesPage = () => {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const { data: games, isLoading } = useQuery({
    queryKey: ["video-games"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_games")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as VideoGame[];
    },
  });

  const filteredGames = games?.filter((game) => {
    if (!selectedPlatform) return true;
    const normalizedPlatforms = game.platforms?.map((p: string) => {
      const map: Record<string, string> = {
        google_play: "android",
        apple: "ios",
        itch_io: "itchio",
      };
      return map[p] || p;
    });
    return normalizedPlatforms?.includes(selectedPlatform) || game.platforms?.includes(selectedPlatform);
  });

  const platforms = ["steam", "android", "ios", "windows", "itchio", "amazon", "xbox", "playstation", "nintendo", "epic", "roblox", "browser"];

  const getPlatformUrl = (game: VideoGame, platform: string) => {
    switch (platform) {
      case "steam": return game.steam_url;
      case "google_play": 
      case "android": return game.google_play_url;
      case "apple": 
      case "ios": return game.apple_store_url;
      case "windows": return game.microsoft_store_url;
      case "itch_io": 
      case "itchio": return game.itch_io_url;
      case "amazon": return game.amazon_app_store_url;
      case "xbox": return game.xbox_store_url;
      case "playstation": return game.playstation_store_url;
      case "nintendo": return game.nintendo_eshop_url;
      case "epic": return game.epic_games_store_url;
      case "roblox": return (game as any).roblox_url;
      case "browser": return game.browser_play_url ? "/games-player" : null;
      default: return null;
    }
  };

  const hasBrowserGames = games?.some(g => g.browser_play_url || g.itch_io_url);

  return (
    <div className="relative min-h-screen bg-background">
      <StarField />
      <Navigation />

      <div className="relative z-10 pt-32 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <img 
              src={vendxInteractiveLogo} 
              alt="VendX Interactive" 
              className="h-24 md:h-32 mx-auto mb-6"
            />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              VendX Interactive
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              Experience gaming excellence with VendX Interactive — our publishing division bringing premium titles across all major platforms
            </p>
            {hasBrowserGames && (
              <Link to="/games-player">
                <Button className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                  <Gamepad2 className="w-4 h-4" />
                  Play Games in Browser
                </Button>
              </Link>
            )}
          </div>

          {/* Platform Filter */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
            <Button
              variant={selectedPlatform === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPlatform(null)}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              All Platforms
            </Button>
            {platforms.map((platform) => (
              <Button
                key={platform}
                variant={selectedPlatform === platform ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPlatform(platform)}
                className="gap-2"
              >
                {platformIcons[platform]}
                {platformLabels[platform]}
              </Button>
            ))}
          </div>

          {/* Games Grid */}
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-card/50 border-border/50">
                  <Skeleton className="h-48 rounded-t-lg" />
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full mb-4" />
                    <Skeleton className="h-8 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredGames && filteredGames.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGames.map((game) => (
                <Card
                  key={game.id}
                  className="group bg-card/50 border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden"
                >
                  {/* Cover Image */}
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
                    
                    {/* Status Badge */}
                    <Badge
                      className={`absolute top-3 right-3 ${statusColors[game.release_status] || statusColors.coming_soon}`}
                    >
                      {statusLabels[game.release_status] || game.release_status}
                    </Badge>

                    {/* Featured Badge */}
                    {game.is_featured && (
                      <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground">
                        Featured
                      </Badge>
                    )}

                    {/* Trailer Button */}
                    {game.trailer_url && (
                      <a
                        href={game.trailer_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                          <Play className="w-8 h-8 text-primary-foreground ml-1" />
                        </div>
                      </a>
                    )}
                  </div>

                  <CardContent className="p-6">
                    <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {game.title}
                    </h3>
                    
                    {game.short_description && (
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                        {game.short_description}
                      </p>
                    )}

                    {/* Platform Links */}
                    <div className="flex flex-wrap gap-2">
                      {game.platforms?.map((platform) => {
                        const url = getPlatformUrl(game, platform);
                        if (!url) return null;
                        
                        return (
                          <a
                            key={platform}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-primary/20 border border-border hover:border-primary/50 text-sm transition-all"
                          >
                            {platformIcons[platform]}
                            <span className="hidden sm:inline">{platformLabels[platform]}</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground" />
                          </a>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Gamepad2 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No games found</h3>
              <p className="text-muted-foreground">
                {selectedPlatform
                  ? `No games available for ${platformLabels[selectedPlatform]}`
                  : "Check back soon for new releases!"}
              </p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default VideoGamesPage;
