import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import StarField from "@/components/StarField";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Music, Film, Heart, Users, ArrowLeft, Filter } from "lucide-react";
import { useState } from "react";

interface MediaArtist {
  id: string;
  slug: string;
  name: string;
  artist_type: string;
  short_bio: string | null;
  profile_image_url: string | null;
  is_legacy: boolean;
  is_featured: boolean;
  birth_date: string | null;
  death_date: string | null;
}

const ArtistsListPage = () => {
  const [filter, setFilter] = useState<"all" | "music" | "film" | "legacy">("all");

  const { data: artists, isLoading } = useQuery({
    queryKey: ["media-artists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_artists")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as unknown as MediaArtist[];
    },
  });

  const filtered = artists?.filter((a) => {
    if (filter === "all") return true;
    if (filter === "legacy") return a.is_legacy;
    return a.artist_type === filter || a.artist_type === "both";
  });

  const formatLifespan = (a: MediaArtist) => {
    if (!a.birth_date) return null;
    const birth = new Date(a.birth_date).getFullYear();
    const death = a.death_date ? new Date(a.death_date).getFullYear() : null;
    return death ? `${birth} – ${death}` : `Born ${birth}`;
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
              <Users className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              VendX Artists & Filmmakers
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              Meet the talented artists and filmmakers behind VendX Music & Film
            </p>

            <div className="flex items-center justify-center gap-3 mb-8">
              <Link to="/media">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back to Media
                </Button>
              </Link>
            </div>

            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="inline-flex">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="all" className="gap-2">
                  <Filter className="w-4 h-4" /> All
                </TabsTrigger>
                <TabsTrigger value="music" className="gap-2">
                  <Music className="w-4 h-4" /> Music
                </TabsTrigger>
                <TabsTrigger value="film" className="gap-2">
                  <Film className="w-4 h-4" /> Film
                </TabsTrigger>
                <TabsTrigger value="legacy" className="gap-2">
                  <Heart className="w-4 h-4" /> Legacy
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="bg-card/50 border-border/50">
                  <Skeleton className="h-48 rounded-t-lg" />
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered && filtered.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filtered.map((artist) => (
                <Link key={artist.id} to={`/media/artists/${artist.slug}`}>
                  <Card className="group bg-card/50 border-border/50 hover:border-primary/50 transition-all overflow-hidden h-full">
                    <div className="relative h-52 bg-muted overflow-hidden">
                      {artist.profile_image_url ? (
                        <img src={artist.profile_image_url} alt={artist.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-16 h-16 text-muted-foreground/30" />
                        </div>
                      )}
                      {artist.is_legacy && (
                        <Badge className="absolute top-3 left-3 bg-muted/80 text-foreground border border-border/50 gap-1">
                          <Heart className="w-3 h-3 text-destructive" /> Legacy
                        </Badge>
                      )}
                      {artist.is_featured && (
                        <Badge className="absolute top-3 right-3 bg-accent text-accent-foreground">Featured</Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{artist.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs capitalize">
                          {artist.artist_type === "both" ? "Music & Film" : artist.artist_type}
                        </Badge>
                        {artist.is_legacy && formatLifespan(artist) && (
                          <span className="text-xs text-muted-foreground">{formatLifespan(artist)}</span>
                        )}
                      </div>
                      {artist.short_bio && (
                        <p className="text-muted-foreground text-sm mt-2 line-clamp-2">{artist.short_bio}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No artists found</h3>
              <p className="text-muted-foreground">Check back soon for new artist profiles!</p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ArtistsListPage;
