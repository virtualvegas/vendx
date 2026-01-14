import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import StarField from "@/components/StarField";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Gamepad2, Maximize2, Minimize2, ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import vendxInteractiveLogo from "@/assets/vendx-interactive-logo.png";

interface PlayableGame {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  cover_image_url: string | null;
  browser_play_url: string | null;
  itch_io_url: string | null;
}

const GamesPlayerPage = () => {
  const [selectedGame, setSelectedGame] = useState<PlayableGame | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data: games, isLoading } = useQuery({
    queryKey: ["playable-games"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_games")
        .select("id, title, slug, short_description, cover_image_url, browser_play_url, itch_io_url")
        .eq("is_active", true)
        .not("browser_play_url", "is", null)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as PlayableGame[];
    },
  });

  const getEmbedUrl = (game: PlayableGame) => {
    return game.browser_play_url;
  };

  const toggleFullscreen = () => {
    const iframe = document.getElementById("game-iframe");
    if (!iframe) return;

    if (!isFullscreen) {
      if (iframe.requestFullscreen) {
        iframe.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className="relative min-h-screen bg-background">
      <StarField />
      <Navigation />

      <div className="relative z-10 pt-32 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link to="/games">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to VendX Interactive
              </Button>
            </Link>
          </div>

          <div className="text-center mb-12">
            <img 
              src={vendxInteractiveLogo} 
              alt="VendX Interactive" 
              className="h-20 md:h-24 mx-auto mb-6"
            />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Play in Browser
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Play VendX Interactive games directly in your browser — no downloads required
            </p>
          </div>

          {selectedGame ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="outline" onClick={() => setSelectedGame(null)} className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back to List
                  </Button>
                  <h2 className="text-2xl font-bold text-foreground">{selectedGame.title}</h2>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={toggleFullscreen} className="gap-2">
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  </Button>
                  {selectedGame.itch_io_url && (
                    <a href={selectedGame.itch_io_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Open on itch.io
                      </Button>
                    </a>
                  )}
                </div>
              </div>

              <div className="relative w-full bg-black rounded-xl overflow-hidden border border-border" style={{ aspectRatio: "16/9" }}>
                <iframe
                  id="game-iframe"
                  src={getEmbedUrl(selectedGame) || ""}
                  className="absolute inset-0 w-full h-full"
                  allowFullScreen
                  allow="autoplay; fullscreen; gamepad"
                  title={selectedGame.title}
                />
              </div>

              {selectedGame.short_description && (
                <p className="text-muted-foreground text-center max-w-2xl mx-auto">
                  {selectedGame.short_description}
                </p>
              )}
            </div>
          ) : (
            <>
              {isLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="bg-card/50 border-border/50">
                      <Skeleton className="h-48 rounded-t-lg" />
                      <CardContent className="p-6">
                        <Skeleton className="h-6 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-full mb-4" />
                        <Skeleton className="h-10 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : games && games.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {games.map((game) => (
                    <Card
                      key={game.id}
                      className="group bg-card/50 border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden"
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

                        <Button 
                          className="w-full gap-2" 
                          onClick={() => setSelectedGame(game)}
                        >
                          <Gamepad2 className="w-4 h-4" />
                          Play Now
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
              <div className="text-center py-20">
                  <Gamepad2 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No browser games available</h3>
                  <p className="text-muted-foreground mb-4">
                    Check back soon for playable games!
                  </p>
                  <Link to="/games">
                    <Button variant="outline">View All VendX Interactive Games</Button>
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default GamesPlayerPage;