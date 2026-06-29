import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Film, ArrowRight, Clock, Play } from "lucide-react";

const statusColors: Record<string, string> = {
  released: "bg-accent text-accent-foreground",
  coming_soon: "bg-primary/20 text-primary border-primary/30",
  pre_release: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  past_release: "bg-muted text-muted-foreground border-border",
  live: "bg-accent text-accent-foreground",
  in_production: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const statusLabels: Record<string, string> = {
  released: "Out Now",
  coming_soon: "Coming Soon",
  pre_release: "Pre-Release",
  past_release: "Past Release",
  live: "Out Now",
  in_production: "In Production",
};

const filmTypeLabels: Record<string, string> = {
  feature: "Feature",
  short: "Short",
  documentary: "Doc",
  series: "Series",
  music_video: "Music Video",
};

const FeaturedFilm = () => {
  const { data: releases, isLoading } = useQuery({
    queryKey: ["featured-film-home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_releases")
        .select("*")
        .eq("is_active", true)
        .eq("is_featured", true)
        .eq("media_type", "film")
        .order("display_order", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  return (
    <section className="py-20 relative">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Film className="w-7 h-7 text-red-400" />
              <span className="text-red-400 uppercase tracking-widest text-sm font-semibold">VendX Film</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-3">
              Films & <span className="text-red-400">Series</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl">
              Features, shorts, documentaries, and original series from VendX
            </p>
          </div>
          <Link to="/media?type=film">
            <Button variant="outline" className="gap-2 group border-red-500/50 text-red-400 hover:bg-red-500/10">
              All Films
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="bg-card/50 border-border/50">
                <Skeleton className="aspect-video rounded-t-lg" />
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-3" />
                  <Skeleton className="h-6 w-1/3" />
                </CardContent>
              </Card>
            ))
          ) : releases && releases.length > 0 ? (
            releases.map((release: any) => (
              <Link key={release.id} to={`/media?type=film`}>
                <Card className="group bg-card/50 border-border/50 hover:border-red-500/50 transition-all duration-300 overflow-hidden h-full">
                  <div className="aspect-video relative overflow-hidden bg-muted">
                    {release.backdrop_image_url || release.cover_image_url ? (
                      <img
                        src={release.backdrop_image_url || release.cover_image_url}
                        alt={release.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-16 h-16 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />

                    {release.trailer_url && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-16 h-16 rounded-full bg-red-500/90 flex items-center justify-center">
                          <Play className="w-7 h-7 text-white ml-1" />
                        </div>
                      </div>
                    )}

                    <Badge className={`absolute top-3 left-3 ${statusColors[release.release_status] || statusColors.coming_soon}`}>
                      {statusLabels[release.release_status] || release.release_status}
                    </Badge>
                    {release.film_type && (
                      <Badge className="absolute top-3 right-3 bg-red-500/80 text-white">
                        {filmTypeLabels[release.film_type] || release.film_type}
                      </Badge>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-xl font-bold text-foreground group-hover:text-red-400 transition-colors line-clamp-1 mb-1">
                        {release.title}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {release.director && <span>Dir. {release.director}</span>}
                        {release.runtime_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {release.runtime_minutes}m
                          </span>
                        )}
                        {release.mpaa_rating && (
                          <span className="border border-border/50 px-1.5 rounded text-[10px] uppercase">
                            {release.mpaa_rating}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {(release.short_description || release.synopsis) && (
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {release.short_description || release.synopsis}
                      </p>
                    </CardContent>
                  )}
                </Card>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <Film className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No featured films available</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default FeaturedFilm;
