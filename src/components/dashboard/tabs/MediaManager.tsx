import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  spotify_url: "",
  apple_music_url: "",
  youtube_music_url: "",
  soundcloud_url: "",
  tidal_url: "",
  amazon_music_url: "",
  deezer_url: "",
  bandcamp_url: "",
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

const MediaManager = () => {
  const queryClient = useQueryClient();
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        genre: form.genre ? form.genre.split(",").map((g) => g.trim()).filter(Boolean) : [],
        tracklist: (form.media_type === "music" && form.music_release_type !== "single" ? form.tracklist : []) as any,
        music_release_type: (form.media_type === "music" ? form.music_release_type : "single") as any,
        short_description: form.short_description || null,
        full_description: form.full_description || null,
        cover_image_url: form.cover_image_url || null,
        trailer_url: form.trailer_url || null,
        release_date: form.release_date || null,
        artist_director: form.artist_director || null,
        spotify_url: form.spotify_url || null,
        apple_music_url: form.apple_music_url || null,
        youtube_music_url: form.youtube_music_url || null,
        soundcloud_url: form.soundcloud_url || null,
        tidal_url: form.tidal_url || null,
        amazon_music_url: form.amazon_music_url || null,
        deezer_url: form.deezer_url || null,
        bandcamp_url: form.bandcamp_url || null,
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
      };

      if (editingId) {
        const { error } = await supabase.from("media_releases").update(payload as any).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("media_releases").insert(payload as any);
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
    setForm(emptyForm);
    setEditingId(null);
  };

  const openEdit = (r: MediaRelease) => {
    setEditingId(r.id);
    setForm({
      title: r.title,
      slug: r.slug,
      media_type: r.media_type,
      music_release_type: (r as any).music_release_type || "single",
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
      tracklist: ((r as any).tracklist as TracklistItem[]) || [],
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
    });
    setDialogOpen(true);
  };

  const updateField = (key: string, value: string | boolean | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const activePlatforms = form.media_type === "music" ? musicPlatforms : filmPlatforms;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Disc3 className="w-6 h-6" /> Music & Film Manager
          </h2>
          <p className="text-muted-foreground">Manage music and film releases</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Add Release</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Release" : "New Release"}</DialogTitle>
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
                {form.media_type === "music" && (
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

              {/* Tracklist for Albums/EPs */}
              {form.media_type === "music" && form.music_release_type !== "single" && (
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
                  <Label>Artist / Director</Label>
                  <Input value={form.artist_director} onChange={(e) => updateField("artist_director", e.target.value)} />
                </div>
                <div>
                  <Label>Genre (comma-separated)</Label>
                  <Input value={form.genre} onChange={(e) => updateField("genre", e.target.value)} placeholder="Pop, Electronic" />
                </div>
              </div>
              <div>
                <Label>Short Description</Label>
                <Textarea value={form.short_description} onChange={(e) => updateField("short_description", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cover Image URL</Label>
                  <Input value={form.cover_image_url} onChange={(e) => updateField("cover_image_url", e.target.value)} />
                </div>
                <div>
                  <Label>Trailer URL</Label>
                  <Input value={form.trailer_url} onChange={(e) => updateField("trailer_url", e.target.value)} />
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

              {/* Platform Links */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  {form.media_type === "music" ? <Music className="w-4 h-4" /> : <Film className="w-4 h-4" />}
                  {form.media_type === "music" ? "Music" : "Streaming"} Platforms
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {activePlatforms.map((p) => (
                    <div key={p.key}>
                      <Label className="text-xs">{p.label}</Label>
                      <Input
                        value={(form as Record<string, unknown>)[p.key] as string || ""}
                        onChange={(e) => updateField(p.key, e.target.value)}
                        placeholder={`https://...`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Purchase Platforms</h4>
                <div className="grid grid-cols-2 gap-3">
                  {purchasePlatforms.map((p) => (
                    <div key={p.key}>
                      <Label className="text-xs">{p.label}</Label>
                      <Input
                        value={(form as Record<string, unknown>)[p.key] as string || ""}
                        onChange={(e) => updateField(p.key, e.target.value)}
                        placeholder={`https://...`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title || !form.slug} className="w-full">
                {saveMutation.isPending ? "Saving..." : editingId ? "Update Release" : "Create Release"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid gap-4">
          {releases?.map((r) => (
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{r.title}</h3>
                    <Badge variant="outline" className="capitalize">{r.media_type}</Badge>
                    <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.artist_director || "No artist/director"} • {r.release_status}</p>
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
          {(!releases || releases.length === 0) && (
            <p className="text-center text-muted-foreground py-8">No releases yet. Click "Add Release" to create one.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default MediaManager;
