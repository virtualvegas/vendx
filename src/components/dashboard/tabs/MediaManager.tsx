import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Music, Film, Disc3 } from "lucide-react";

interface MediaRelease {
  id: string;
  title: string;
  slug: string;
  media_type: string;
  short_description: string | null;
  full_description: string | null;
  cover_image_url: string | null;
  trailer_url: string | null;
  release_date: string | null;
  release_status: string;
  genre: string[] | null;
  artist_director: string | null;
  is_featured: boolean | null;
  is_active: boolean | null;
  display_order: number;
  [key: string]: any;
}

interface TracklistItem {
  number: number;
  title: string;
  duration: string;
  featured_artist: string;
}

const emptyForm = {
  title: "",
  slug: "",
  media_type: "music" as string,
  music_release_type: "single" as string,
  short_description: "",
  full_description: "",
  cover_image_url: "",
  trailer_url: "",
  release_date: "",
  release_status: "coming_soon",
  genre: "",
  artist_director: "",
  is_featured: false,
  is_active: true,
  display_order: 0,
  tracklist: [] as TracklistItem[],
  // Music platform links
  spotify_url: "",
  apple_music_url: "",
  youtube_music_url: "",
  soundcloud_url: "",
  tidal_url: "",
  amazon_music_url: "",
  deezer_url: "",
  bandcamp_url: "",
  // Film platform links
  netflix_url: "",
  prime_video_url: "",
  disney_plus_url: "",
  hulu_url: "",
  youtube_url: "",
  apple_tv_url: "",
  peacock_url: "",
  paramount_plus_url: "",
  tubi_url: "",
  itunes_url: "",
  google_play_url: "",
  vudu_url: "",
  // Film-specific details
  film_type: "feature",
  runtime_minutes: "",
  mpaa_rating: "",
  language: "",
  country: "",
  director: "",
  writers: "",
  producers: "",
  cast_members: "",
  synopsis: "",
  season_count: "",
  episode_count: "",
  imdb_url: "",
  letterboxd_url: "",
  tmdb_url: "",
  rotten_tomatoes_url: "",
  backdrop_image_url: "",
  poster_image_url: "",
};

const musicPlatforms = [
  { key: "spotify_url", label: "Spotify" },
  { key: "apple_music_url", label: "Apple Music" },
  { key: "youtube_music_url", label: "YouTube Music" },
  { key: "soundcloud_url", label: "SoundCloud" },
  { key: "tidal_url", label: "Tidal" },
  { key: "amazon_music_url", label: "Amazon Music" },
  { key: "deezer_url", label: "Deezer" },
  { key: "bandcamp_url", label: "Bandcamp" },
];

const filmPlatforms = [
  { key: "netflix_url", label: "Netflix" },
  { key: "prime_video_url", label: "Prime Video" },
  { key: "disney_plus_url", label: "Disney+" },
  { key: "hulu_url", label: "Hulu" },
  { key: "youtube_url", label: "YouTube" },
  { key: "apple_tv_url", label: "Apple TV+" },
  { key: "peacock_url", label: "Peacock" },
  { key: "paramount_plus_url", label: "Paramount+" },
  { key: "tubi_url", label: "Tubi" },
];

const purchasePlatforms = [
  { key: "itunes_url", label: "iTunes" },
  { key: "google_play_url", label: "Google Play" },
  { key: "vudu_url", label: "Vudu" },
];

const filmExternalLinks = [
  { key: "imdb_url", label: "IMDb" },
  { key: "letterboxd_url", label: "Letterboxd" },
  { key: "tmdb_url", label: "TMDb" },
  { key: "rotten_tomatoes_url", label: "Rotten Tomatoes" },
];

const splitList = (s: string) =>
  s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];

const joinList = (arr: any) => (Array.isArray(arr) ? arr.join(", ") : "");

const MediaManager = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"music" | "film">("music");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: releases, isLoading } = useQuery({
    queryKey: ["admin-media-releases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_releases")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as MediaRelease[];
    },
  });

  const filtered = useMemo(
    () => (releases || []).filter((r) => r.media_type === activeTab),
    [releases, activeTab],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const isFilm = form.media_type === "film";
      const payload: any = {
        title: form.title,
        slug: form.slug,
        media_type: form.media_type,
        release_status: form.release_status,
        display_order: form.display_order,
        is_featured: form.is_featured,
        is_active: form.is_active,
        genre: splitList(form.genre),
        short_description: form.short_description || null,
        full_description: form.full_description || null,
        cover_image_url: form.cover_image_url || null,
        trailer_url: form.trailer_url || null,
        release_date: form.release_date || null,
        artist_director: form.artist_director || (isFilm ? form.director || null : null),
        // Music
        music_release_type: isFilm ? "single" : form.music_release_type,
        tracklist: !isFilm && form.music_release_type !== "single" ? form.tracklist : [],
        spotify_url: form.spotify_url || null,
        apple_music_url: form.apple_music_url || null,
        youtube_music_url: form.youtube_music_url || null,
        soundcloud_url: form.soundcloud_url || null,
        tidal_url: form.tidal_url || null,
        amazon_music_url: form.amazon_music_url || null,
        deezer_url: form.deezer_url || null,
        bandcamp_url: form.bandcamp_url || null,
        // Film platforms
        netflix_url: form.netflix_url || null,
        prime_video_url: form.prime_video_url || null,
        disney_plus_url: form.disney_plus_url || null,
        hulu_url: form.hulu_url || null,
        youtube_url: form.youtube_url || null,
        apple_tv_url: form.apple_tv_url || null,
        peacock_url: form.peacock_url || null,
        paramount_plus_url: form.paramount_plus_url || null,
        tubi_url: form.tubi_url || null,
        itunes_url: form.itunes_url || null,
        google_play_url: form.google_play_url || null,
        vudu_url: form.vudu_url || null,
        // Film-specific
        film_type: isFilm ? form.film_type : null,
        runtime_minutes: isFilm && form.runtime_minutes ? parseInt(String(form.runtime_minutes)) : null,
        mpaa_rating: isFilm ? form.mpaa_rating || null : null,
        language: isFilm ? form.language || null : null,
        country: isFilm ? form.country || null : null,
        director: isFilm ? form.director || null : null,
        writers: isFilm ? splitList(form.writers) : null,
        producers: isFilm ? splitList(form.producers) : null,
        cast_members: isFilm ? splitList(form.cast_members) : null,
        synopsis: isFilm ? form.synopsis || null : null,
        season_count: isFilm && form.film_type === "series" && form.season_count ? parseInt(String(form.season_count)) : null,
        episode_count: isFilm && form.film_type === "series" && form.episode_count ? parseInt(String(form.episode_count)) : null,
        imdb_url: isFilm ? form.imdb_url || null : null,
        letterboxd_url: isFilm ? form.letterboxd_url || null : null,
        tmdb_url: isFilm ? form.tmdb_url || null : null,
        rotten_tomatoes_url: isFilm ? form.rotten_tomatoes_url || null : null,
        backdrop_image_url: isFilm ? form.backdrop_image_url || null : null,
        poster_image_url: isFilm ? form.poster_image_url || null : null,
      };

      if (editingId) {
        const { error } = await supabase.from("media_releases").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("media_releases").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media-releases"] });
      toast.success(editingId ? "Release updated" : "Release created");
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("media_releases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media-releases"] });
      toast.success("Release deleted");
    },
  });

  const resetForm = () => {
    setForm({ ...emptyForm, media_type: activeTab });
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setForm((p) => ({ ...p, media_type: activeTab }));
    setDialogOpen(true);
  };

  const openEdit = (r: MediaRelease) => {
    setEditingId(r.id);
    setForm({
      ...emptyForm,
      title: r.title,
      slug: r.slug,
      media_type: r.media_type,
      music_release_type: r.music_release_type || "single",
      short_description: r.short_description || "",
      full_description: r.full_description || "",
      cover_image_url: r.cover_image_url || "",
      trailer_url: r.trailer_url || "",
      release_date: r.release_date || "",
      release_status: r.release_status,
      genre: r.genre?.join(", ") || "",
      artist_director: r.artist_director || "",
      is_featured: r.is_featured || false,
      is_active: r.is_active !== false,
      display_order: r.display_order,
      tracklist: (r.tracklist as TracklistItem[]) || [],
      spotify_url: r.spotify_url || "",
      apple_music_url: r.apple_music_url || "",
      youtube_music_url: r.youtube_music_url || "",
      soundcloud_url: r.soundcloud_url || "",
      tidal_url: r.tidal_url || "",
      amazon_music_url: r.amazon_music_url || "",
      deezer_url: r.deezer_url || "",
      bandcamp_url: r.bandcamp_url || "",
      netflix_url: r.netflix_url || "",
      prime_video_url: r.prime_video_url || "",
      disney_plus_url: r.disney_plus_url || "",
      hulu_url: r.hulu_url || "",
      youtube_url: r.youtube_url || "",
      apple_tv_url: r.apple_tv_url || "",
      peacock_url: r.peacock_url || "",
      paramount_plus_url: r.paramount_plus_url || "",
      tubi_url: r.tubi_url || "",
      itunes_url: r.itunes_url || "",
      google_play_url: r.google_play_url || "",
      vudu_url: r.vudu_url || "",
      film_type: r.film_type || "feature",
      runtime_minutes: r.runtime_minutes ? String(r.runtime_minutes) : "",
      mpaa_rating: r.mpaa_rating || "",
      language: r.language || "",
      country: r.country || "",
      director: r.director || "",
      writers: joinList(r.writers),
      producers: joinList(r.producers),
      cast_members: joinList(r.cast_members),
      synopsis: r.synopsis || "",
      season_count: r.season_count ? String(r.season_count) : "",
      episode_count: r.episode_count ? String(r.episode_count) : "",
      imdb_url: r.imdb_url || "",
      letterboxd_url: r.letterboxd_url || "",
      tmdb_url: r.tmdb_url || "",
      rotten_tomatoes_url: r.rotten_tomatoes_url || "",
      backdrop_image_url: r.backdrop_image_url || "",
      poster_image_url: r.poster_image_url || "",
    });
    setDialogOpen(true);
  };

  const updateField = (key: string, value: string | boolean | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isFilm = form.media_type === "film";
  const activePlatforms = isFilm ? filmPlatforms : musicPlatforms;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Disc3 className="w-6 h-6" /> Music & Film Manager
          </h2>
          <p className="text-muted-foreground">Manage music and film releases — separated by type</p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Add {activeTab === "music" ? "Music Release" : "Film"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "music" | "film")}>
        <TabsList>
          <TabsTrigger value="music" className="gap-2">
            <Music className="w-4 h-4" /> Music ({releases?.filter((r) => r.media_type === "music").length || 0})
          </TabsTrigger>
          <TabsTrigger value="film" className="gap-2">
            <Film className="w-4 h-4" /> Film ({releases?.filter((r) => r.media_type === "film").length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="grid gap-4">
              {filtered.map((r) => (
                <Card key={r.id} className="bg-card/50">
                  <CardContent className="p-4 flex items-center gap-4">
                    {r.cover_image_url ? (
                      <img src={r.cover_image_url} alt={r.title} className="w-16 h-16 rounded object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                        {r.media_type === "music" ? <Music className="w-6 h-6 text-muted-foreground" /> : <Film className="w-6 h-6 text-muted-foreground" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{r.title}</h3>
                        <Badge variant="outline" className="capitalize">{r.media_type}</Badge>
                        {r.media_type === "film" && r.film_type && (
                          <Badge variant="secondary" className="capitalize">{r.film_type}</Badge>
                        )}
                        <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge>
                        {r.is_featured && <Badge>Featured</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {r.artist_director || r.director || "—"} • {r.release_status}
                        {r.runtime_minutes ? ` • ${r.runtime_minutes} min` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => openEdit(r)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => deleteMutation.mutate(r.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No {activeTab} releases yet. Click "Add" to create one.
                </p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isFilm ? <Film className="w-5 h-5" /> : <Music className="w-5 h-5" />}
              {editingId ? "Edit" : "New"} {isFilm ? "Film" : "Music Release"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Core Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => updateField("title", e.target.value)} />
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => updateField("slug", e.target.value)} placeholder="auto-from-title" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={form.media_type} onValueChange={(v) => updateField("media_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="music">Music</SelectItem>
                    <SelectItem value="film">Film</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!isFilm && (
                <div>
                  <Label>Release Type</Label>
                  <Select value={form.music_release_type} onValueChange={(v) => updateField("music_release_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="album">Album</SelectItem>
                      <SelectItem value="ep">EP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isFilm && (
                <div>
                  <Label>Film Type</Label>
                  <Select value={form.film_type} onValueChange={(v) => updateField("film_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feature">Feature Film</SelectItem>
                      <SelectItem value="short">Short Film</SelectItem>
                      <SelectItem value="documentary">Documentary</SelectItem>
                      <SelectItem value="series">Series</SelectItem>
                      <SelectItem value="music_video">Music Video</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={form.release_status} onValueChange={(v) => updateField("release_status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="released">Released</SelectItem>
                    <SelectItem value="coming_soon">Coming Soon</SelectItem>
                    <SelectItem value="in_production">In Production</SelectItem>
                    <SelectItem value="past_release">Past Release</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Release Date</Label>
                <Input type="date" value={form.release_date} onChange={(e) => updateField("release_date", e.target.value)} />
              </div>
            </div>

            {/* Music tracklist */}
            {!isFilm && form.music_release_type !== "single" && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Music className="w-4 h-4" /> Tracklist
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        tracklist: [...prev.tracklist, { number: prev.tracklist.length + 1, title: "", duration: "", featured_artist: "" }],
                      }));
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Track
                  </Button>
                </div>
                {form.tracklist.length === 0 && (
                  <p className="text-sm text-muted-foreground">No tracks added yet.</p>
                )}
                <div className="space-y-2">
                  {form.tracklist.map((track, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-6 text-center">{idx + 1}</span>
                      <Input
                        placeholder="Track title"
                        value={track.title}
                        onChange={(e) => {
                          const updated = [...form.tracklist];
                          updated[idx] = { ...updated[idx], title: e.target.value, number: idx + 1 };
                          setForm((prev) => ({ ...prev, tracklist: updated }));
                        }}
                        className="flex-1"
                      />
                      <Input
                        placeholder="3:45"
                        value={track.duration}
                        onChange={(e) => {
                          const updated = [...form.tracklist];
                          updated[idx] = { ...updated[idx], duration: e.target.value };
                          setForm((prev) => ({ ...prev, tracklist: updated }));
                        }}
                        className="w-20"
                      />
                      <Input
                        placeholder="Feat. artist"
                        value={track.featured_artist}
                        onChange={(e) => {
                          const updated = [...form.tracklist];
                          updated[idx] = { ...updated[idx], featured_artist: e.target.value };
                          setForm((prev) => ({ ...prev, tracklist: updated }));
                        }}
                        className="w-32"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            tracklist: prev.tracklist.filter((_, i) => i !== idx).map((t, i) => ({ ...t, number: i + 1 })),
                          }));
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isFilm ? "Director" : "Artist"}</Label>
                <Input
                  value={isFilm ? form.director : form.artist_director}
                  onChange={(e) => updateField(isFilm ? "director" : "artist_director", e.target.value)}
                />
              </div>
              <div>
                <Label>Genre (comma-separated)</Label>
                <Input value={form.genre} onChange={(e) => updateField("genre", e.target.value)} placeholder={isFilm ? "Thriller, Sci-Fi" : "Pop, Electronic"} />
              </div>
            </div>

            <div>
              <Label>Short Description / Tagline</Label>
              <Textarea value={form.short_description} onChange={(e) => updateField("short_description", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cover / Poster Image URL</Label>
                <Input value={form.cover_image_url} onChange={(e) => updateField("cover_image_url", e.target.value)} />
              </div>
              <div>
                <Label>Trailer URL</Label>
                <Input value={form.trailer_url} onChange={(e) => updateField("trailer_url", e.target.value)} placeholder="YouTube / Vimeo embed" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Display Order</Label>
                <Input type="number" value={form.display_order} onChange={(e) => updateField("display_order", parseInt(e.target.value) || 0)} />
              </div>
              <div className="flex items-center gap-6 pt-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_featured} onCheckedChange={(v) => updateField("is_featured", v)} />
                  <Label>Featured</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={(v) => updateField("is_active", v)} />
                  <Label>Active</Label>
                </div>
              </div>
            </div>

            {/* Film-specific details */}
            {isFilm && (
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Film className="w-4 h-4" /> Film Details
                </h4>

                <div>
                  <Label>Synopsis</Label>
                  <Textarea
                    value={form.synopsis}
                    onChange={(e) => updateField("synopsis", e.target.value)}
                    placeholder="Full plot synopsis"
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Label>Runtime (min)</Label>
                    <Input
                      type="number"
                      value={form.runtime_minutes}
                      onChange={(e) => updateField("runtime_minutes", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>MPAA Rating</Label>
                    <Select value={form.mpaa_rating || "unrated"} onValueChange={(v) => updateField("mpaa_rating", v === "unrated" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unrated">Unrated</SelectItem>
                        <SelectItem value="G">G</SelectItem>
                        <SelectItem value="PG">PG</SelectItem>
                        <SelectItem value="PG-13">PG-13</SelectItem>
                        <SelectItem value="R">R</SelectItem>
                        <SelectItem value="NC-17">NC-17</SelectItem>
                        <SelectItem value="TV-Y">TV-Y</SelectItem>
                        <SelectItem value="TV-PG">TV-PG</SelectItem>
                        <SelectItem value="TV-14">TV-14</SelectItem>
                        <SelectItem value="TV-MA">TV-MA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Language</Label>
                    <Input value={form.language} onChange={(e) => updateField("language", e.target.value)} placeholder="English" />
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Input value={form.country} onChange={(e) => updateField("country", e.target.value)} placeholder="USA" />
                  </div>
                </div>

                {form.film_type === "series" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Seasons</Label>
                      <Input type="number" value={form.season_count} onChange={(e) => updateField("season_count", e.target.value)} />
                    </div>
                    <div>
                      <Label>Episodes</Label>
                      <Input type="number" value={form.episode_count} onChange={(e) => updateField("episode_count", e.target.value)} />
                    </div>
                  </div>
                )}

                <div>
                  <Label>Writers (comma-separated)</Label>
                  <Input value={form.writers} onChange={(e) => updateField("writers", e.target.value)} />
                </div>
                <div>
                  <Label>Producers (comma-separated)</Label>
                  <Input value={form.producers} onChange={(e) => updateField("producers", e.target.value)} />
                </div>
                <div>
                  <Label>Cast (comma-separated)</Label>
                  <Textarea value={form.cast_members} onChange={(e) => updateField("cast_members", e.target.value)} rows={2} placeholder="Lead Actor, Supporting Actor, ..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Backdrop / Banner Image URL</Label>
                    <Input value={form.backdrop_image_url} onChange={(e) => updateField("backdrop_image_url", e.target.value)} placeholder="Wide hero image" />
                  </div>
                  <div>
                    <Label>Poster (vertical) URL</Label>
                    <Input value={form.poster_image_url} onChange={(e) => updateField("poster_image_url", e.target.value)} placeholder="2:3 poster" />
                  </div>
                </div>

                <div className="border-t pt-3">
                  <h5 className="font-medium mb-2 text-sm">External Databases</h5>
                  <div className="grid grid-cols-2 gap-3">
                    {filmExternalLinks.map((p) => (
                      <div key={p.key}>
                        <Label className="text-xs">{p.label}</Label>
                        <Input
                          value={(form as Record<string, unknown>)[p.key] as string || ""}
                          onChange={(e) => updateField(p.key, e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Platform links */}
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                {isFilm ? <Film className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                {isFilm ? "Streaming" : "Music"} Platforms
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {activePlatforms.map((p) => (
                  <div key={p.key}>
                    <Label className="text-xs">{p.label}</Label>
                    <Input
                      value={(form as Record<string, unknown>)[p.key] as string || ""}
                      onChange={(e) => updateField(p.key, e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Purchase / Rent Platforms</h4>
              <div className="grid grid-cols-2 gap-3">
                {purchasePlatforms.map((p) => (
                  <div key={p.key}>
                    <Label className="text-xs">{p.label}</Label>
                    <Input
                      value={(form as Record<string, unknown>)[p.key] as string || ""}
                      onChange={(e) => updateField(p.key, e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.title || !form.slug}
              className="w-full"
            >
              {saveMutation.isPending ? "Saving..." : editingId ? `Update ${isFilm ? "Film" : "Release"}` : `Create ${isFilm ? "Film" : "Release"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MediaManager;
