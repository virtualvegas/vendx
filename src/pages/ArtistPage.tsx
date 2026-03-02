import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import StarField from "@/components/StarField";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  SiSpotify, SiApplemusic, SiYoutubemusic, SiSoundcloud,
  SiInstagram, SiYoutube,
} from "react-icons/si";
import { FaXTwitter, FaTiktok } from "react-icons/fa6";
import {
  Music, Film, ExternalLink, Globe, Mail, Calendar,
  Heart, Disc3, ArrowLeft, Play, ListMusic, Clock, ShoppingCart,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import AudioPlayer from "@/components/media/AudioPlayer";
import VideoPlayer from "@/components/media/VideoPlayer";

interface MediaArtist {
  id: string;
  slug: string;
  name: string;
  artist_type: string;
  bio: string | null;
  short_bio: string | null;
  profile_image_url: string | null;
  banner_image_url: string | null;
  is_legacy: boolean;
  legacy_tribute_text: string | null;
  legacy_background_url: string | null;
  birth_date: string | null;
  death_date: string | null;
  website_url: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
  apple_music_url: string | null;
  soundcloud_url: string | null;
  tiktok_url: string | null;
  contact_email: string | null;
  booking_email: string | null;
  management_company: string | null;
  is_featured: boolean;
}

interface MediaRelease {
  id: string;
  title: string;
  slug: string;
  media_type: string;
  music_release_type: string | null;
  cover_image_url: string | null;
  release_date: string | null;
  release_status: string;
  genre: string[] | null;
  short_description: string | null;
  tracklist: any[] | null;
  spotify_url: string | null;
  apple_music_url: string | null;
  youtube_url: string | null;
}

interface MediaTrack {
  id: string;
  release_id: string | null;
  title: string;
  track_number: number;
  duration_seconds: number | null;
  audio_file_url: string | null;
  preview_url: string | null;
  external_stream_url: string | null;
  is_playable: boolean;
  lyrics: string | null;
  media_type: string;
  video_file_url: string | null;
  video_embed_url: string | null;
  cover_image_url: string | null;
}

const socialLinks = [
  { key: "spotify_url", icon: <SiSpotify className="w-5 h-5" />, label: "Spotify" },
  { key: "apple_music_url", icon: <SiApplemusic className="w-5 h-5" />, label: "Apple Music" },
  { key: "youtube_url", icon: <SiYoutube className="w-5 h-5" />, label: "YouTube" },
  { key: "instagram_url", icon: <SiInstagram className="w-5 h-5" />, label: "Instagram" },
  { key: "twitter_url", icon: <FaXTwitter className="w-5 h-5" />, label: "X / Twitter" },
  { key: "soundcloud_url", icon: <SiSoundcloud className="w-5 h-5" />, label: "SoundCloud" },
  { key: "tiktok_url", icon: <FaTiktok className="w-5 h-5" />, label: "TikTok" },
  { key: "website_url", icon: <Globe className="w-5 h-5" />, label: "Website" },
];

const ArtistPage = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: artist, isLoading } = useQuery({
    queryKey: ["artist", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_artists")
        .select("*")
        .eq("slug", slug!)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data as unknown as MediaArtist;
    },
    enabled: !!slug,
  });

  const { data: releases } = useQuery({
    queryKey: ["artist-releases", artist?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_releases")
        .select("*")
        .eq("artist_id", artist!.id)
        .eq("is_active", true)
        .order("release_date", { ascending: false });
      if (error) throw error;
      return data as unknown as MediaRelease[];
    },
    enabled: !!artist?.id,
  });

  const { data: tracks } = useQuery({
    queryKey: ["artist-tracks", artist?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_tracks")
        .select("*")
        .eq("artist_id", artist!.id)
        .eq("is_active", true)
        .order("track_number");
      if (error) throw error;
      return data as unknown as MediaTrack[];
    },
    enabled: !!artist?.id,
  });

  const getActiveSocials = (a: MediaArtist) =>
    socialLinks.filter((s) => a[s.key as keyof MediaArtist]);

  const formatDate = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  // Build playable audio tracks for the audio player
  const playableAudioTracks = (tracks || [])
    .filter(t => t.is_playable && t.media_type !== 'video' && (t.audio_file_url || t.preview_url))
    .map(t => {
      const release = releases?.find(r => r.id === t.release_id);
      return {
        id: t.id,
        title: t.title,
        artist_name: artist?.name,
        audio_url: (t.audio_file_url || t.preview_url)!,
        cover_image_url: t.cover_image_url || release?.cover_image_url || artist?.profile_image_url,
        duration_seconds: t.duration_seconds,
        external_url: t.external_stream_url || undefined,
      };
    });

  // Build playable video items for the video player
  const playableVideoItems = (tracks || [])
    .filter(t => t.is_playable && t.media_type === 'video' && (t.video_file_url || t.video_embed_url))
    .map(t => {
      const release = releases?.find(r => r.id === t.release_id);
      return {
        id: t.id,
        title: t.title,
        artist_name: artist?.name,
        video_url: t.video_file_url,
        embed_url: t.video_embed_url,
        cover_image_url: t.cover_image_url || release?.cover_image_url || artist?.profile_image_url,
        duration_seconds: t.duration_seconds,
        external_url: t.external_stream_url || undefined,
      };
    });

  const getTracksForRelease = (releaseId: string) =>
    (tracks || []).filter(t => t.release_id === releaseId);

  if (isLoading) {
    return (
      <div className="relative min-h-screen bg-background">
        <StarField />
        <Navigation />
        <div className="relative z-10 pt-32 pb-20 container mx-auto px-4">
          <Skeleton className="h-64 w-full rounded-xl mb-8" />
          <Skeleton className="h-10 w-1/2 mb-4" />
          <Skeleton className="h-6 w-3/4" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="relative min-h-screen bg-background">
        <StarField />
        <Navigation />
        <div className="relative z-10 pt-32 pb-20 text-center container mx-auto px-4">
          <h1 className="text-3xl font-bold text-foreground mb-4">Artist Not Found</h1>
          <Link to="/media">
            <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Media</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const activeSocials = getActiveSocials(artist);

  return (
    <div className="relative min-h-screen bg-background">
      {artist.is_legacy && artist.legacy_background_url ? (
        <div className="fixed inset-0 z-0">
          <img src={artist.legacy_background_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-background/80" />
        </div>
      ) : (
        <StarField />
      )}
      <Navigation />

      <div className="relative z-10">
        {/* Banner */}
        <div className="relative h-64 md:h-80 overflow-hidden">
          {artist.banner_image_url ? (
            <img src={artist.banner_image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/10" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

          {artist.is_legacy && (
            <div className="absolute top-6 right-6">
              <Badge className="bg-muted/80 text-foreground border border-border/50 gap-1.5 px-3 py-1.5 text-sm">
                <Heart className="w-4 h-4 text-destructive" /> Legacy Memorial
              </Badge>
            </div>
          )}
        </div>

        {/* Profile Section */}
        <div className="container mx-auto px-4 -mt-20 relative z-20">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-xl overflow-hidden border-4 border-background shadow-xl bg-muted flex-shrink-0">
              {artist.profile_image_url ? (
                <img src={artist.profile_image_url} alt={artist.name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-16 h-16 text-muted-foreground/30" />
                </div>
              )}
            </div>

            <div className="flex-1 pt-2 md:pt-8">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">{artist.name}</h1>
                <Badge variant="outline" className="capitalize">
                  {artist.artist_type === "both" ? "Music & Film" : artist.artist_type}
                </Badge>
              </div>

              {artist.is_legacy && artist.birth_date && (
                <p className="text-muted-foreground text-sm flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(artist.birth_date)}
                  {artist.death_date && ` — ${formatDate(artist.death_date)}`}
                </p>
              )}

              {artist.short_bio && (
                <p className="text-muted-foreground max-w-2xl mb-4">{artist.short_bio}</p>
              )}

              {activeSocials.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeSocials.map((s) => (
                    <a
                      key={s.key}
                      href={artist[s.key as keyof MediaArtist] as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-primary/20 border border-border hover:border-primary/50 text-sm transition-all"
                    >
                      {s.icon}
                      <span className="hidden sm:inline">{s.label}</span>
                    </a>
                  ))}
                </div>
              )}

              {/* Shop Link */}
              <div className="mt-4">
                <Link to={`/media/artists/${artist.slug}/shop`}>
                  <Button variant="outline" className="gap-2">
                    <ShoppingCart className="w-4 h-4" /> Shop {artist.name}
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <Separator className="my-8" />

          {/* Legacy Tribute */}
          {artist.is_legacy && artist.legacy_tribute_text && (
            <Card className="bg-card/50 border-border/50 mb-8">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="w-5 h-5 text-destructive" />
                  <h2 className="text-lg font-semibold text-foreground">In Memoriam</h2>
                </div>
                <p className="text-muted-foreground whitespace-pre-line">{artist.legacy_tribute_text}</p>
              </CardContent>
            </Card>
          )}

          {/* Audio Player for playable music tracks */}
          {playableAudioTracks.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <Play className="w-5 h-5" /> Listen Now
              </h2>
              <AudioPlayer tracks={playableAudioTracks} />
            </div>
          )}

          {/* Video Player for film/video content */}
          {playableVideoItems.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <Film className="w-5 h-5" /> Watch Now
              </h2>
              <VideoPlayer items={playableVideoItems} />
            </div>
          )}

          {/* Bio */}
          {artist.bio && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-3">About</h2>
              <p className="text-muted-foreground whitespace-pre-line max-w-3xl">{artist.bio}</p>
            </div>
          )}

          {/* Contact / Booking */}
          {!artist.is_legacy && (artist.contact_email || artist.booking_email || artist.management_company) && (
            <Card className="bg-card/50 border-border/50 mb-8">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-3">Contact & Booking</h2>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  {artist.booking_email && (
                    <div>
                      <p className="text-muted-foreground mb-1">Booking Inquiries</p>
                      <a href={`mailto:${artist.booking_email}`} className="text-primary hover:underline flex items-center gap-1">
                        <Mail className="w-4 h-4" /> {artist.booking_email}
                      </a>
                    </div>
                  )}
                  {artist.contact_email && (
                    <div>
                      <p className="text-muted-foreground mb-1">General Contact</p>
                      <a href={`mailto:${artist.contact_email}`} className="text-primary hover:underline flex items-center gap-1">
                        <Mail className="w-4 h-4" /> {artist.contact_email}
                      </a>
                    </div>
                  )}
                  {artist.management_company && (
                    <div>
                      <p className="text-muted-foreground mb-1">Management</p>
                      <p className="text-foreground">{artist.management_company}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Discography / Filmography with linked tracks */}
          {releases && releases.length > 0 && (
            <div className="mb-16">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {artist.artist_type === "film" ? "Filmography" : "Discography"}
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {releases.map((release) => {
                  const releaseTracks = getTracksForRelease(release.id);
                  return (
                    <Card key={release.id} className="group bg-card/50 border-border/50 hover:border-primary/50 transition-all overflow-hidden">
                      <div className="relative aspect-square bg-muted overflow-hidden">
                        {release.cover_image_url ? (
                          <img src={release.cover_image_url} alt={release.title} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {release.media_type === "music" ? <Music className="w-16 h-16 text-muted-foreground/30" /> : <Film className="w-16 h-16 text-muted-foreground/30" />}
                          </div>
                        )}
                        <Badge className="absolute top-3 right-3 bg-background/80 text-foreground capitalize">
                          {release.media_type === "music" && release.music_release_type
                            ? release.music_release_type === "ep" ? "EP" : release.music_release_type
                            : release.media_type}
                        </Badge>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{release.title}</h3>
                        {release.release_date && (
                          <p className="text-xs text-muted-foreground mt-1">{formatDate(release.release_date)}</p>
                        )}
                        {release.genre && release.genre.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {release.genre.map((g) => <Badge key={g} variant="outline" className="text-xs">{g}</Badge>)}
                          </div>
                        )}

                        {/* Tracks from media_tracks table */}
                        {releaseTracks.length > 0 && (
                          <Accordion type="single" collapsible className="mt-2">
                            <AccordionItem value="tracklist" className="border-border/50">
                              <AccordionTrigger className="text-xs py-1.5 hover:no-underline">
                                <span className="flex items-center gap-1.5">
                                  <ListMusic className="w-3.5 h-3.5" /> {releaseTracks.length} tracks
                                </span>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-0.5">
                                  {releaseTracks.map((track, i) => (
                                    <div key={track.id} className="flex items-center gap-2 text-xs py-0.5 px-1 rounded hover:bg-muted/50">
                                      <span className="text-muted-foreground w-4 text-right">{track.track_number}.</span>
                                      <span className="flex-1 text-foreground">{track.title}</span>
                                      {track.is_playable && <Play className="w-3 h-3 text-primary" />}
                                      {track.duration_seconds && (
                                        <span className="text-muted-foreground flex items-center gap-0.5">
                                          <Clock className="w-2.5 h-2.5" />
                                          {Math.floor(track.duration_seconds / 60)}:{(track.duration_seconds % 60).toString().padStart(2, "0")}
                                        </span>
                                      )}
                                      {track.external_stream_url && (
                                        <a href={track.external_stream_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        )}

                        {/* Fallback to JSON tracklist if no media_tracks */}
                        {releaseTracks.length === 0 && release.media_type === "music" && release.tracklist && release.tracklist.length > 0 && (
                          <Accordion type="single" collapsible className="mt-2">
                            <AccordionItem value="tracklist" className="border-border/50">
                              <AccordionTrigger className="text-xs py-1.5 hover:no-underline">
                                <span className="flex items-center gap-1.5">
                                  <ListMusic className="w-3.5 h-3.5" /> {release.tracklist.length} tracks
                                </span>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-0.5">
                                  {release.tracklist.map((track: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 text-xs py-0.5 px-1 rounded hover:bg-muted/50">
                                      <span className="text-muted-foreground w-4 text-right">{track.number || i + 1}.</span>
                                      <span className="flex-1 text-foreground">{track.title}</span>
                                      {track.duration && <span className="text-muted-foreground flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{track.duration}</span>}
                                    </div>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        )}

                        {/* Quick streaming links */}
                        <div className="flex gap-2 mt-3">
                          {release.spotify_url && (
                            <a href={release.spotify_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded bg-muted hover:bg-primary/20 transition-colors">
                              <SiSpotify className="w-4 h-4" />
                            </a>
                          )}
                          {release.apple_music_url && (
                            <a href={release.apple_music_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded bg-muted hover:bg-primary/20 transition-colors">
                              <SiApplemusic className="w-4 h-4" />
                            </a>
                          )}
                          {release.youtube_url && (
                            <a href={release.youtube_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded bg-muted hover:bg-primary/20 transition-colors">
                              <SiYoutube className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Back link */}
          <div className="pb-16">
            <Link to="/media">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back to Music & Film
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ArtistPage;
