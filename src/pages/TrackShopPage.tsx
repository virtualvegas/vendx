import { useState, useRef, useEffect } from "react";
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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Music, Play, Pause, ShoppingCart, Filter, Clock, Zap, Crown, Star,
  Film, Download
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

interface BeatTrack {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  producer: string | null;
  genre: string[] | null;
  bpm: number | null;
  key: string | null;
  duration_seconds: number | null;
  preview_url: string | null;
  cover_image_url: string | null;
  price: number;
  license_type: string;
  is_featured: boolean | null;
  play_count: number;
  tags: string[] | null;
}

const licenseColors: Record<string, string> = {
  standard: "bg-muted text-muted-foreground",
  premium: "bg-primary/20 text-primary border-primary/30",
  exclusive: "bg-accent/20 text-accent border-accent/30",
};

const licenseIcons: Record<string, React.ReactNode> = {
  standard: <Music className="w-3 h-3" />,
  premium: <Star className="w-3 h-3" />,
  exclusive: <Crown className="w-3 h-3" />,
};

const TrackShopPage = () => {
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useSEO({
    title: "Track Shop — Premium Beats",
    description: "Premium beats for artists — preview 30 seconds, then purchase and download the full track instantly.",
  });

  const { data: beats, isLoading } = useQuery({
    queryKey: ["beat-tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beat_tracks")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as BeatTrack[];
    },
  });

  // Get unique genres
  const allGenres = Array.from(new Set(beats?.flatMap((b) => b.genre || []) || []));

  const filtered = beats?.filter((b) => {
    if (genreFilter === "all") return true;
    return b.genre?.includes(genreFilter);
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const togglePlay = (beat: BeatTrack) => {
    if (!beat.preview_url) {
      toast.error("No preview available for this beat");
      return;
    }

    if (playingId === beat.id) {
      // Pause
      audioRef.current?.pause();
      setPlayingId(null);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Stop current
    if (audioRef.current) {
      audioRef.current.pause();
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    // Play new
    const audio = new Audio(beat.preview_url);
    audioRef.current = audio;
    setPlayingId(beat.id);
    setProgress(0);

    audio.play().catch(() => {
      toast.error("Could not play audio");
      setPlayingId(null);
    });

    intervalRef.current = setInterval(() => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    }, 100);

    audio.onended = () => {
      setPlayingId(null);
      setProgress(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };

    // Increment play count
    supabase
      .from("beat_tracks")
      .update({ play_count: (beat.play_count || 0) + 1 })
      .eq("id", beat.id)
      .then(() => {});
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleBuy = async (beat: BeatTrack) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke("beat-purchase-checkout", {
        body: { beat_id: beat.id },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error("Failed to start checkout", { description: err.message });
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
      <StarField />
      <Navigation />

      <div className="relative z-10 pt-32 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Music className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Track Shop
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              Premium beats for artists — preview 30 seconds, then purchase and download the full track instantly
            </p>
            <div className="flex items-center justify-center gap-3 mb-8">
              <Link to="/media">
                <Button variant="outline" className="gap-2">
                  <Film className="w-4 h-4" /> Releases
                </Button>
              </Link>
              <Link to="/media/artists">
                <Button variant="outline" className="gap-2">
                  <ShoppingCart className="w-4 h-4" /> Artist Shops
                </Button>
              </Link>
            </div>

            {/* Genre Filter */}
            {allGenres.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant={genreFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGenreFilter("all")}
                  className="gap-2"
                >
                  <Filter className="w-4 h-4" /> All Genres
                </Button>
                {allGenres.map((genre) => (
                  <Button
                    key={genre}
                    variant={genreFilter === genre ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGenreFilter(genre)}
                  >
                    {genre}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Beats Grid */}
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-card/50 border-border/50">
                  <Skeleton className="h-48 rounded-t-lg" />
                  <CardContent className="p-5">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered && filtered.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((beat) => {
                const isPlaying = playingId === beat.id;
                return (
                  <Card
                    key={beat.id}
                    className="group bg-card/50 border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden"
                  >
                    {/* Cover & Play */}
                    <div className="relative h-48 bg-muted overflow-hidden">
                      {beat.cover_image_url ? (
                        <img
                          src={beat.cover_image_url}
                          alt={beat.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                          <Music className="w-16 h-16 text-muted-foreground/30" />
                        </div>
                      )}

                      {/* Play Button Overlay */}
                      <button
                        onClick={() => togglePlay(beat)}
                        className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isPlaying ? "bg-destructive" : "bg-primary"}`}>
                          {isPlaying ? (
                            <Pause className="w-8 h-8 text-primary-foreground" />
                          ) : (
                            <Play className="w-8 h-8 text-primary-foreground ml-1" />
                          )}
                        </div>
                      </button>

                      {/* Always show play icon when playing */}
                      {isPlaying && (
                        <button
                          onClick={() => togglePlay(beat)}
                          className="absolute inset-0 flex items-center justify-center bg-background/40"
                        >
                          <div className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center">
                            <Pause className="w-8 h-8 text-primary-foreground" />
                          </div>
                        </button>
                      )}

                      <Badge className={`absolute top-3 right-3 gap-1 ${licenseColors[beat.license_type]}`}>
                        {licenseIcons[beat.license_type]}
                        {beat.license_type}
                      </Badge>

                      {beat.is_featured && (
                        <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground">Featured</Badge>
                      )}
                    </div>

                    {/* Progress bar when playing */}
                    {isPlaying && (
                      <Progress value={progress} className="h-1 rounded-none" />
                    )}

                    <CardContent className="p-5">
                      <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                        {beat.title}
                      </h3>

                      {beat.producer && (
                        <p className="text-sm text-primary mb-2">by {beat.producer}</p>
                      )}

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                        {beat.bpm && (
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3" /> {beat.bpm} BPM
                          </span>
                        )}
                        {beat.key && (
                          <span className="flex items-center gap-1">
                            <Music className="w-3 h-3" /> {beat.key}
                          </span>
                        )}
                        {beat.duration_seconds && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDuration(beat.duration_seconds)}
                          </span>
                        )}
                      </div>

                      {beat.genre && beat.genre.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {beat.genre.map((g) => (
                            <Badge key={g} variant="outline" className="text-xs">{g}</Badge>
                          ))}
                        </div>
                      )}

                      {beat.description && (
                        <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{beat.description}</p>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-foreground">${Number(beat.price).toFixed(2)}</span>
                        <Button onClick={() => handleBuy(beat)} className="gap-2">
                          <Download className="w-4 h-4" /> Buy Beat
                        </Button>
                      </div>

                      {beat.preview_url && (
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          🎧 30-second preview available — hover to play
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <Music className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No beats available</h3>
              <p className="text-muted-foreground">Check back soon for fresh beats!</p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default TrackShopPage;
