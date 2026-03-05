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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SiSpotify, SiApplemusic, SiYoutubemusic, SiSoundcloud,
  SiTidal, SiBandcamp, SiNetflix, SiYoutube,
} from "react-icons/si";
import { FaAmazon, FaFilm } from "react-icons/fa";
import { Music, ExternalLink, Play, Filter, Film, Disc3, ShoppingCart, ListMusic, Clock, Headphones, Video } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import AudioPlayer from "@/components/media/AudioPlayer";
import VideoPlayer from "@/components/media/VideoPlayer";
import { useSEO } from "@/hooks/useSEO";

interface TracklistItem {
  number: number;
  title: string;
  duration: string;
  featured_artist: string;
}

interface MediaRelease {
  id: string;
  title: string;
  slug: string;
  media_type: string;
  music_release_type: string | null;
  short_description: string | null;
  full_description: string | null;
  cover_image_url: string | null;
  trailer_url: string | null;
  release_date: string | null;
  release_status: string;
  genre: string[] | null;
  artist_director: string | null;
  artist_id: string | null;
  is_featured: boolean | null;
  tracklist: any[] | null;
  spotify_url: string | null;
  apple_music_url: string | null;
  youtube_music_url: string | null;
  soundcloud_url: string | null;
  tidal_url: string | null;
  amazon_music_url: string | null;
  deezer_url: string | null;
  bandcamp_url: string | null;
  netflix_url: string | null;
  prime_video_url: string | null;
  disney_plus_url: string | null;
  hulu_url: string | null;
  youtube_url: string | null;
  apple_tv_url: string | null;
  peacock_url: string | null;
  paramount_plus_url: string | null;
  tubi_url: string | null;
  itunes_url: string | null;
  google_play_url: string | null;
  vudu_url: string | null;
}

interface MediaTrack {
  id: string;
  release_id: string | null;
  artist_id: string | null;
  title: string;
  track_number: number;
  duration_seconds: number | null;
  audio_file_url: string | null;
  preview_url: string | null;
  external_stream_url: string | null;
  is_playable: boolean;
  media_type: string;
  video_file_url: string | null;
  video_embed_url: string | null;
  cover_image_url: string | null;
}

const platformConfig: Record<string, { icon: React.ReactNode; label: string; field: keyof MediaRelease }> = {
  spotify: { icon: <SiSpotify className="w-5 h-5" />, label: "Spotify", field: "spotify_url" },
  apple_music: { icon: <SiApplemusic className="w-5 h-5" />, label: "Apple Music", field: "apple_music_url" },
  youtube_music: { icon: <SiYoutubemusic className="w-5 h-5" />, label: "YouTube Music", field: "youtube_music_url" },
  soundcloud: { icon: <SiSoundcloud className="w-5 h-5" />, label: "SoundCloud", field: "soundcloud_url" },
  tidal: { icon: <SiTidal className="w-5 h-5" />, label: "Tidal", field: "tidal_url" },
  amazon_music: { icon: <FaAmazon className="w-5 h-5" />, label: "Amazon Music", field: "amazon_music_url" },
  deezer: { icon: <Music className="w-5 h-5" />, label: "Deezer", field: "deezer_url" },
  bandcamp: { icon: <SiBandcamp className="w-5 h-5" />, label: "Bandcamp", field: "bandcamp_url" },
  netflix: { icon: <SiNetflix className="w-5 h-5" />, label: "Netflix", field: "netflix_url" },
  prime_video: { icon: <FaAmazon className="w-5 h-5" />, label: "Prime Video", field: "prime_video_url" },
  disney_plus: { icon: <Film className="w-5 h-5" />, label: "Disney+", field: "disney_plus_url" },
  hulu: { icon: <Film className="w-5 h-5" />, label: "Hulu", field: "hulu_url" },
  youtube: { icon: <SiYoutube className="w-5 h-5" />, label: "YouTube", field: "youtube_url" },
  apple_tv: { icon: <SiApplemusic className="w-5 h-5" />, label: "Apple TV+", field: "apple_tv_url" },
  peacock: { icon: <Film className="w-5 h-5" />, label: "Peacock", field: "peacock_url" },
  paramount_plus: { icon: <Film className="w-5 h-5" />, label: "Paramount+", field: "paramount_plus_url" },
  tubi: { icon: <Film className="w-5 h-5" />, label: "Tubi", field: "tubi_url" },
  itunes: { icon: <SiApplemusic className="w-5 h-5" />, label: "iTunes", field: "itunes_url" },
  google_play: { icon: <Play className="w-5 h-5" />, label: "Google Play", field: "google_play_url" },
  vudu: { icon: <Film className="w-5 h-5" />, label: "Vudu", field: "vudu_url" },
};

const statusColors: Record<string, string> = {
  released: "bg-accent text-accent-foreground",
  live: "bg-accent text-accent-foreground",
  coming_soon: "bg-primary/20 text-primary border-primary/30",
  in_production: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  past_release: "bg-muted text-muted-foreground border-border",
};

const statusLabels: Record<string, string> = {
  released: "Out Now",
  live: "Out Now",
  coming_soon: "Coming Soon",
  in_production: "In Production",
  past_release: "Past Release",
};

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

// Inline player component for a single release card
const ReleaseInlinePlayer = ({ releaseId, releaseCover, artistName }: {
  releaseId: string;
  releaseCover: string | null;
  artistName: string | null;
}) => {
  const { data: tracks } = useQuery({
    queryKey: ["release-tracks", releaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_tracks")
        .select("*")
        .eq("release_id", releaseId)
        .eq("is_active", true)
        .eq("is_playable", true)
        .order("track_number");
      if (error) throw error;
      return data as unknown as MediaTrack[];
    },
  });

  const audioTracks = (tracks || [])
    .filter(t => t.media_type !== "video" && (t.audio_file_url || t.preview_url))
    .map(t => ({
      id: t.id,
      title: t.title,
      artist_name: artistName || undefined,
      audio_url: (t.audio_file_url || t.preview_url)!,
      cover_image_url: t.cover_image_url || releaseCover,
      duration_seconds: t.duration_seconds,
      external_url: t.external_stream_url || undefined,
    }));

  const videoItems = (tracks || [])
    .filter(t => t.media_type === "video" && (t.video_file_url || t.video_embed_url))
    .map(t => ({
      id: t.id,
      title: t.title,
      artist_name: artistName || undefined,
      video_url: t.video_file_url,
      embed_url: t.video_embed_url,
      cover_image_url: t.cover_image_url || releaseCover,
      duration_seconds: t.duration_seconds,
      external_url: t.external_stream_url || undefined,
    }));

  if (!audioTracks.length && !videoItems.length) return null;

  return (
    <div className="space-y-3 mt-3">
      {audioTracks.length > 0 && (
        <AudioPlayer tracks={audioTracks} compact />
      )}
      {videoItems.length > 0 && (
        <VideoPlayer items={videoItems} compact />
      )}
    </div>
  );
};

const MediaPage = () => {
  const [mediaFilter, setMediaFilter] = useState<"all" | "music" | "film">("all");
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  useSEO({
    title: "VendX Music & Film — Releases",
    description: "Discover original music and films from VendX. Stream, watch, and listen on your favorite platforms.",
  });

  const { data: releases, isLoading } = useQuery({
    queryKey: ["media-releases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_releases")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as unknown as MediaRelease[];
    },
  });

  // Also fetch all playable tracks to show play indicators
  const { data: allPlayableTracks } = useQuery({
    queryKey: ["all-playable-tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_tracks")
        .select("id, release_id, media_type")
        .eq("is_active", true)
        .eq("is_playable", true);
      if (error) throw error;
      return data;
    },
  });

  const getPlayableCountForRelease = (releaseId: string) =>
    (allPlayableTracks || []).filter(t => t.release_id === releaseId).length;

  const filtered = releases?.filter((r) => {
    if (mediaFilter === "all") return true;
    return r.media_type === mediaFilter;
  });

  const getPlatformLinks = (release: MediaRelease) => {
    return Object.entries(platformConfig)
      .filter(([, cfg]) => release[cfg.field])
      .map(([key, cfg]) => ({
        key,
        url: release[cfg.field] as string,
        icon: cfg.icon,
        label: cfg.label,
      }));
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
              <Disc3 className="w-12 h-12 text-primary animate-spin" style={{ animationDuration: "3s" }} />
              <Film className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              VendX Music & Film
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              Discover original music and films from VendX — stream, watch, and listen right here or on your favorite platform
            </p>
            <div className="flex items-center justify-center gap-3 mb-8 flex-wrap">
              <Link to="/media/artists">
                <Button variant="outline" className="gap-2">
                  <Music className="w-4 h-4" /> Artists & Filmmakers
                </Button>
              </Link>
              <Link to="/media/artists">
                <Button variant="outline" className="gap-2">
                  <ShoppingCart className="w-4 h-4" /> Artist Shops
                </Button>
              </Link>
              <Link to="/media/track-shop">
                <Button variant="outline" className="gap-2">
                  <Music className="w-4 h-4" /> Track Shop
                </Button>
              </Link>
            </div>

            {/* Type Filter */}
            <Tabs value={mediaFilter} onValueChange={(v) => setMediaFilter(v as typeof mediaFilter)} className="inline-flex">
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
              </TabsList>
            </Tabs>
          </div>

          {/* Grid */}
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
          ) : filtered && filtered.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((release) => {
                const links = getPlatformLinks(release);
                const playableCount = getPlayableCountForRelease(release.id);
                const isExpanded = expandedPlayer === release.id;

                return (
                  <Card
                    key={release.id}
                    className="group bg-card/50 border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden"
                  >
                    {/* Cover */}
                    <div className="relative aspect-square bg-muted overflow-hidden">
                      {release.cover_image_url ? (
                        <img
                          src={release.cover_image_url}
                          alt={release.title}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
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

                      <Badge className={`absolute top-3 right-3 ${statusColors[release.release_status] || statusColors.coming_soon}`}>
                        {statusLabels[release.release_status] || release.release_status}
                      </Badge>

                      {release.is_featured && (
                        <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground">Featured</Badge>
                      )}

                      <Badge className="absolute bottom-3 left-3 bg-background/80 text-foreground capitalize">
                        {release.media_type === "music" ? <Music className="w-3 h-3 mr-1" /> : <Film className="w-3 h-3 mr-1" />}
                        {release.media_type === "music" && release.music_release_type
                          ? release.music_release_type === "ep" ? "EP" : release.music_release_type
                          : release.media_type}
                      </Badge>

                      {/* Play button overlay if playable tracks exist */}
                      {playableCount > 0 && (
                        <button
                          onClick={() => setExpandedPlayer(isExpanded ? null : release.id)}
                          className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-xl">
                            <Play className="w-7 h-7 text-primary-foreground ml-0.5" />
                          </div>
                        </button>
                      )}

                      {release.trailer_url && !playableCount && (
                        <a
                          href={release.trailer_url}
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
                      <h3 className="text-xl font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                        {release.title}
                      </h3>

                      {release.artist_director && (
                        <p className="text-sm text-primary mb-2">{release.artist_director}</p>
                      )}

                      {release.short_description && (
                        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{release.short_description}</p>
                      )}

                      {release.genre && release.genre.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {release.genre.map((g) => (
                            <Badge key={g} variant="outline" className="text-xs">{g}</Badge>
                          ))}
                        </div>
                      )}

                      {/* Play Button */}
                      {playableCount > 0 && (
                        <Button
                          variant={isExpanded ? "default" : "outline"}
                          size="sm"
                          className="gap-2 mb-3 w-full"
                          onClick={() => setExpandedPlayer(isExpanded ? null : release.id)}
                        >
                          {release.media_type === "music" ? <Headphones className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                          {isExpanded ? "Hide Player" : `Play (${playableCount} track${playableCount > 1 ? "s" : ""})`}
                        </Button>
                      )}

                      {/* Inline Player */}
                      {isExpanded && (
                        <ReleaseInlinePlayer
                          releaseId={release.id}
                          releaseCover={release.cover_image_url}
                          artistName={release.artist_director}
                        />
                      )}

                      {/* Legacy Tracklist for Albums/EPs */}
                      {release.media_type === "music" && release.tracklist && release.tracklist.length > 0 && !isExpanded && (
                        <Accordion type="single" collapsible className="mb-3">
                          <AccordionItem value="tracklist" className="border-border/50">
                            <AccordionTrigger className="text-sm py-2 hover:no-underline">
                              <span className="flex items-center gap-2">
                                <ListMusic className="w-4 h-4" />
                                Tracklist ({release.tracklist.length} tracks)
                              </span>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-1">
                                {release.tracklist.map((track, i) => (
                                  <div key={i} className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/50">
                                    <span className="text-muted-foreground w-5 text-right">{track.number || i + 1}.</span>
                                    <span className="flex-1 text-foreground">{track.title}</span>
                                    {track.featured_artist && (
                                      <span className="text-muted-foreground text-xs">feat. {track.featured_artist}</span>
                                    )}
                                    {track.duration && (
                                      <span className="text-muted-foreground text-xs flex items-center gap-1">
                                        <Clock className="w-3 h-3" />{track.duration}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}

                      {/* Platform Links */}
                      {links.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {links.map((link) => (
                            <a
                              key={link.key}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-primary/20 border border-border hover:border-primary/50 text-sm transition-all"
                            >
                              {link.icon}
                              <span className="hidden sm:inline">{link.label}</span>
                              <ExternalLink className="w-3 h-3 text-muted-foreground" />
                            </a>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <Disc3 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No releases found</h3>
              <p className="text-muted-foreground">Check back soon for new music and films!</p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default MediaPage;
