import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Music, Film, ArrowRight, ShoppingBag } from "lucide-react";

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

const FeaturedMedia = () => {
  const { data: releases, isLoading } = useQuery({
    queryKey: ["featured-media-home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_releases")
        .select("*")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("display_order", { ascending: true })
        .limit(4);
      if (error) throw error;
      return data;
    },
  });

  return (
    <section className="py-20 relative">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-3">
              <span className="text-red-400">Music</span> & <span className="text-red-400">Film</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl">
              Explore our latest releases across music and film
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/media">
              <Button variant="outline" className="gap-2 group border-red-500/50 text-red-400 hover:bg-red-500/10">
                All Releases
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/media/artists">
              <Button variant="outline" className="gap-2 group border-red-500/50 text-red-400 hover:bg-red-500/10">
                <ShoppingBag className="w-4 h-4" />
                Artist Shops
              </Button>
            </Link>
          </div>
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
          ) : releases && releases.length > 0 ? (
            releases.map((release) => (
              <Link key={release.id} to={`/media`}>
                <Card className="group bg-card/50 border-border/50 hover:border-red-500/50 transition-all duration-300 overflow-hidden h-full">
                  <div className="aspect-square relative overflow-hidden bg-muted">
                    {release.cover_image_url ? (
                      <img
                        src={release.cover_image_url}
                        alt={release.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {release.media_type === "music" ? (
                          <Music className="w-16 h-16 text-muted-foreground/30" />
                        ) : (
                          <Film className="w-16 h-16 text-muted-foreground/30" />
                        )}
                      </div>
                    )}
                    <Badge className={`absolute top-2 left-2 ${statusColors[release.release_status] || statusColors.coming_soon}`}>
                      {statusLabels[release.release_status] || release.release_status}
                    </Badge>
                    <Badge className="absolute top-2 right-2 bg-red-500/80 text-white capitalize">
                      {release.media_type === "music" ? <Music className="w-3 h-3 mr-1" /> : <Film className="w-3 h-3 mr-1" />}
                      {release.media_type}
                    </Badge>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground group-hover:text-red-400 transition-colors line-clamp-1 mb-1">
                      {release.title}
                    </h3>
                    {release.artist_director && (
                      <p className="text-sm text-muted-foreground mb-1">{release.artist_director}</p>
                    )}
                    {release.short_description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{release.short_description}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <Music className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No featured releases available</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default FeaturedMedia;
