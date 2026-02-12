import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Disc3, ArrowRight, Play, Clock } from "lucide-react";

const FeaturedBeats = () => {
  const { data: beats, isLoading } = useQuery({
    queryKey: ["featured-beats-home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beat_tracks")
        .select("*")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("display_order", { ascending: true })
        .limit(4);
      if (error) throw error;
      return data;
    },
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <section className="py-20 relative bg-gradient-to-b from-transparent via-card/30 to-transparent">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-3">
              <span className="text-orange-400">Track</span> Shop
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl">
              Premium beats for artists — preview, purchase, and download instantly
            </p>
          </div>
          <Link to="/media/track-shop">
            <Button variant="outline" className="gap-2 group border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
              Browse All Beats
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-card/50 border-border/50">
                <Skeleton className="aspect-square rounded-t-lg" />
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-3" />
                  <Skeleton className="h-6 w-1/3" />
                </CardContent>
              </Card>
            ))
          ) : beats && beats.length > 0 ? (
            beats.map((beat) => (
              <Link key={beat.id} to="/media/track-shop">
                <Card className="group bg-card/50 border-border/50 hover:border-orange-500/50 transition-all duration-300 overflow-hidden h-full">
                  <div className="aspect-square relative overflow-hidden bg-muted">
                    {beat.cover_image_url ? (
                      <img
                        src={beat.cover_image_url}
                        alt={beat.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-900/30 to-background">
                        <Disc3 className="w-16 h-16 text-orange-500/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center">
                        <Play className="w-6 h-6 text-white ml-1" />
                      </div>
                    </div>
                    {beat.genre && beat.genre.length > 0 && (
                      <Badge className="absolute top-2 left-2 bg-orange-500/80 text-white">
                        {beat.genre[0]}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground group-hover:text-orange-400 transition-colors line-clamp-1 mb-1">
                      {beat.title}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                      {beat.bpm && <span>{beat.bpm} BPM</span>}
                      {beat.key && <span>{beat.key}</span>}
                      {beat.duration_seconds && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(beat.duration_seconds)}
                        </span>
                      )}
                    </div>
                    <span className="text-lg font-bold text-orange-400">
                      ${beat.price.toFixed(2)}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <Disc3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No featured beats available</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default FeaturedBeats;
