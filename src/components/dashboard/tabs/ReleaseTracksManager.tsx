import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Music, Film, Upload, Disc3, ListMusic, Video } from "lucide-react";

interface Artist {
  id: string;
  name: string;
  slug: string;
}

interface Release {
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
  artist_id: string | null;
  spotify_url: string | null;
  apple_music_url: string | null;
  youtube_url: string | null;
  is_active: boolean;
}

interface Track {
  id: string;
  release_id: string | null;
  artist_id: string | null;
  title: string;
  track_number: number;
  duration_seconds: number | null;
  audio_file_url: string | null;
  preview_url: string | null;
  external_stream_url: string | null;
  lyrics: string | null;
  is_playable: boolean;
  is_active: boolean;
  play_count: number;
  media_type: string;
  video_file_url: string | null;
  video_embed_url: string | null;
  cover_image_url: string | null;
}

const emptyRelease = {
  title: "", slug: "", media_type: "music", music_release_type: "album",
  cover_image_url: "", release_date: "", release_status: "live",
  genre: "", short_description: "", artist_id: "",
  spotify_url: "", apple_music_url: "", youtube_url: "", is_active: true,
};

const emptyTrack = {
  title: "", track_number: 1, duration_seconds: "",
  audio_file_url: "", preview_url: "", external_stream_url: "",
  lyrics: "", is_playable: false, is_active: true, release_id: "", artist_id: "",
  media_type: "audio", video_file_url: "", video_embed_url: "", cover_image_url: "",
};

const ReleaseTracksManager = () => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("releases");

  // Release dialog
  const [releaseDialog, setReleaseDialog] = useState(false);
  const [editingRelease, setEditingRelease] = useState<Release | null>(null);
  const [releaseForm, setReleaseForm] = useState(emptyRelease);

  // Track dialog
  const [trackDialog, setTrackDialog] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [trackForm, setTrackForm] = useState(emptyTrack);
  const [uploading, setUploading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [a, r, t] = await Promise.all([
      supabase.from("media_artists").select("id, name, slug").eq("is_active", true).order("name"),
      supabase.from("media_releases").select("*").order("release_date", { ascending: false }),
      supabase.from("media_tracks").select("*").order("track_number"),
    ]);
    if (a.data) setArtists(a.data as unknown as Artist[]);
    if (r.data) setReleases(r.data as unknown as Release[]);
    if (t.data) setTracks(t.data as unknown as Track[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const generateSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const getArtistName = (id: string | null) => artists.find(a => a.id === id)?.name || "—";

  // ============= RELEASES =============
  const openCreateRelease = () => {
    setEditingRelease(null);
    setReleaseForm(emptyRelease);
    setReleaseDialog(true);
  };

  const openEditRelease = (r: Release) => {
    setEditingRelease(r);
    setReleaseForm({
      title: r.title, slug: r.slug, media_type: r.media_type,
      music_release_type: r.music_release_type || "album",
      cover_image_url: r.cover_image_url || "", release_date: r.release_date || "",
      release_status: r.release_status, genre: r.genre?.join(", ") || "",
      short_description: r.short_description || "", artist_id: r.artist_id || "",
      spotify_url: r.spotify_url || "", apple_music_url: r.apple_music_url || "",
      youtube_url: r.youtube_url || "", is_active: r.is_active,
    });
    setReleaseDialog(true);
  };

  const saveRelease = async () => {
    if (!releaseForm.title) { toast.error("Title required"); return; }
    const slug = releaseForm.slug || generateSlug(releaseForm.title);
    const payload: any = {
      title: releaseForm.title, slug,
      media_type: releaseForm.media_type,
      music_release_type: releaseForm.media_type === "music" ? releaseForm.music_release_type : null,
      cover_image_url: releaseForm.cover_image_url || null,
      release_date: releaseForm.release_date || null,
      release_status: releaseForm.release_status,
      genre: releaseForm.genre ? releaseForm.genre.split(",").map(g => g.trim()).filter(Boolean) : null,
      short_description: releaseForm.short_description || null,
      artist_id: releaseForm.artist_id || null,
      spotify_url: releaseForm.spotify_url || null,
      apple_music_url: releaseForm.apple_music_url || null,
      youtube_url: releaseForm.youtube_url || null,
      is_active: releaseForm.is_active,
    };

    let error;
    if (editingRelease) {
      ({ error } = await supabase.from("media_releases").update(payload).eq("id", editingRelease.id));
    } else {
      ({ error } = await supabase.from("media_releases").insert(payload));
    }
    if (error) { toast.error(error.message); return; }
    toast.success(editingRelease ? "Release updated" : "Release created");
    setReleaseDialog(false);
    fetchAll();
  };

  const deleteRelease = async (r: Release) => {
    if (!confirm(`Delete "${r.title}"?`)) return;
    const { error } = await supabase.from("media_releases").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); fetchAll(); }
  };

  // ============= TRACKS =============
  const openCreateTrack = (releaseId?: string, artistId?: string) => {
    setEditingTrack(null);
    const nextNum = tracks.filter(t => t.release_id === releaseId).length + 1;
    setTrackForm({ ...emptyTrack, release_id: releaseId || "", artist_id: artistId || "", track_number: nextNum });
    setTrackDialog(true);
  };

  const openEditTrack = (t: Track) => {
    setEditingTrack(t);
    setTrackForm({
      title: t.title, track_number: t.track_number,
      duration_seconds: t.duration_seconds?.toString() || "",
      audio_file_url: t.audio_file_url || "", preview_url: t.preview_url || "",
      external_stream_url: t.external_stream_url || "", lyrics: t.lyrics || "",
      is_playable: t.is_playable, is_active: t.is_active,
      release_id: t.release_id || "", artist_id: t.artist_id || "",
      media_type: t.media_type || "audio",
      video_file_url: t.video_file_url || "",
      video_embed_url: t.video_embed_url || "",
      cover_image_url: t.cover_image_url || "",
    });
    setTrackDialog(true);
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `tracks/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage.from("artist-audio").upload(path, file);
    if (error) { toast.error("Upload failed: " + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("artist-audio").getPublicUrl(data.path);
    setTrackForm(f => ({ ...f, audio_file_url: urlData.publicUrl, is_playable: true }));
    toast.success("Audio uploaded");
    setUploading(false);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage.from("artist-audio").upload(path, file);
    if (error) { toast.error("Upload failed: " + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("artist-audio").getPublicUrl(data.path);
    setTrackForm(f => ({ ...f, video_file_url: urlData.publicUrl, is_playable: true }));
    toast.success("Video uploaded");
    setUploading(false);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage.from("media-covers").upload(path, file);
    if (error) { toast.error("Upload failed: " + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("media-covers").getPublicUrl(data.path);
    setTrackForm(f => ({ ...f, cover_image_url: urlData.publicUrl }));
    toast.success("Cover uploaded");
    setUploading(false);
  };

  const handleReleaseCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `releases/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage.from("media-covers").upload(path, file);
    if (error) { toast.error("Upload failed: " + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("media-covers").getPublicUrl(data.path);
    setReleaseForm(f => ({ ...f, cover_image_url: urlData.publicUrl }));
    toast.success("Cover uploaded");
    setUploading(false);
  };

  const saveTrack = async () => {
    if (!trackForm.title) { toast.error("Title required"); return; }
    const payload: any = {
      title: trackForm.title, track_number: trackForm.track_number,
      duration_seconds: trackForm.duration_seconds ? parseInt(trackForm.duration_seconds as string) : null,
      audio_file_url: trackForm.audio_file_url || null,
      preview_url: trackForm.preview_url || null,
      external_stream_url: trackForm.external_stream_url || null,
      lyrics: trackForm.lyrics || null,
      is_playable: trackForm.is_playable,
      is_active: trackForm.is_active,
      release_id: trackForm.release_id || null,
      artist_id: trackForm.artist_id || null,
      media_type: trackForm.media_type,
      video_file_url: trackForm.video_file_url || null,
      video_embed_url: trackForm.video_embed_url || null,
      cover_image_url: trackForm.cover_image_url || null,
    };

    let error;
    if (editingTrack) {
      ({ error } = await supabase.from("media_tracks").update(payload).eq("id", editingTrack.id));
    } else {
      ({ error } = await supabase.from("media_tracks").insert(payload));
    }
    if (error) { toast.error(error.message); return; }
    toast.success(editingTrack ? "Track updated" : "Track added");
    setTrackDialog(false);
    fetchAll();
  };

  const deleteTrack = async (t: Track) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    const { error } = await supabase.from("media_tracks").delete().eq("id", t.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); fetchAll(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Disc3 className="w-6 h-6" /> Releases & Tracks
        </h2>
        <p className="text-muted-foreground text-sm">Manage albums, singles, films and individual tracks linked to artist profiles</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{releases.length}</p>
          <p className="text-xs text-muted-foreground">Total Releases</p>
        </CardContent></Card>
        <Card className="bg-card/50 border-border/50"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{tracks.length}</p>
          <p className="text-xs text-muted-foreground">Total Tracks</p>
        </CardContent></Card>
        <Card className="bg-card/50 border-border/50"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{tracks.filter(t => t.is_playable).length}</p>
          <p className="text-xs text-muted-foreground">Playable Tracks</p>
        </CardContent></Card>
        <Card className="bg-card/50 border-border/50"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{releases.filter(r => r.media_type === "film").length}</p>
          <p className="text-xs text-muted-foreground">Film Releases</p>
        </CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="releases" className="gap-1.5"><Disc3 className="w-4 h-4" /> Releases</TabsTrigger>
          <TabsTrigger value="tracks" className="gap-1.5"><ListMusic className="w-4 h-4" /> Tracks</TabsTrigger>
        </TabsList>

        {/* ========= RELEASES TAB ========= */}
        <TabsContent value="releases" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateRelease} className="gap-2"><Plus className="w-4 h-4" /> Add Release</Button>
          </div>
          <Card className="bg-card/50 border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Release</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tracks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : releases.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No releases yet</TableCell></TableRow>
                ) : releases.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {r.cover_image_url ? (
                          <img src={r.cover_image_url} alt="" className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            {r.media_type === "music" ? <Music className="w-5 h-5 text-muted-foreground" /> : <Film className="w-5 h-5 text-muted-foreground" />}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{r.title}</p>
                          <p className="text-xs text-muted-foreground">{r.release_date || "No date"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{getArtistName(r.artist_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {r.media_type === "music" && r.music_release_type ? (r.music_release_type === "ep" ? "EP" : r.music_release_type) : r.media_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={r.release_status === "live" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}>
                        {r.release_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => openCreateTrack(r.id, r.artist_id || "")}>
                        <Plus className="w-3 h-3" /> {tracks.filter(t => t.release_id === r.id).length} tracks
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditRelease(r)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteRelease(r)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ========= TRACKS TAB ========= */}
        <TabsContent value="tracks" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openCreateTrack()} className="gap-2"><Plus className="w-4 h-4" /> Add Track</Button>
          </div>
          <Card className="bg-card/50 border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Release</TableHead>
                  <TableHead>Playable</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : tracks.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No tracks yet</TableCell></TableRow>
                ) : tracks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground">{t.track_number}</TableCell>
                    <TableCell className="font-medium text-foreground">{t.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize gap-1">
                        {t.media_type === "video" ? <><Film className="w-3 h-3" /> Video</> : <><Music className="w-3 h-3" /> Audio</>}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{getArtistName(t.artist_id)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {releases.find(r => r.id === t.release_id)?.title || "—"}
                    </TableCell>
                    <TableCell>
                      {t.is_playable ? (
                        <Badge className="bg-accent text-accent-foreground">Playable</Badge>
                      ) : (
                        <Badge variant="outline">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditTrack(t)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteTrack(t)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========= RELEASE DIALOG ========= */}
      <Dialog open={releaseDialog} onOpenChange={setReleaseDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRelease ? "Edit Release" : "Create Release"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Title *</Label><Input value={releaseForm.title} onChange={e => { setReleaseForm(f => ({ ...f, title: e.target.value, slug: editingRelease ? f.slug : generateSlug(e.target.value) })); }} /></div>
              <div><Label>Slug</Label><Input value={releaseForm.slug} onChange={e => setReleaseForm(f => ({ ...f, slug: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Media Type</Label>
                <Select value={releaseForm.media_type} onValueChange={v => setReleaseForm(f => ({ ...f, media_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="music">Music</SelectItem>
                    <SelectItem value="film">Film</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {releaseForm.media_type === "music" && (
                <div>
                  <Label>Release Type</Label>
                  <Select value={releaseForm.music_release_type} onValueChange={v => setReleaseForm(f => ({ ...f, music_release_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="album">Album</SelectItem>
                      <SelectItem value="ep">EP</SelectItem>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="mixtape">Mixtape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Status</Label>
                <Select value={releaseForm.release_status} onValueChange={v => setReleaseForm(f => ({ ...f, release_status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="coming_soon">Coming Soon</SelectItem>
                    <SelectItem value="in_production">In Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Artist</Label>
                <Select value={releaseForm.artist_id} onValueChange={v => setReleaseForm(f => ({ ...f, artist_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select artist" /></SelectTrigger>
                  <SelectContent>
                    {artists.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Release Date</Label><Input type="date" value={releaseForm.release_date} onChange={e => setReleaseForm(f => ({ ...f, release_date: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Cover Image</Label>
              <div className="flex gap-2">
                <Input value={releaseForm.cover_image_url} onChange={e => setReleaseForm(f => ({ ...f, cover_image_url: e.target.value }))} placeholder="URL or upload" className="flex-1" />
                <Input type="file" accept="image/*" onChange={handleReleaseCoverUpload} disabled={uploading} className="w-40" />
              </div>
            </div>
            <div><Label>Genre (comma-separated)</Label><Input value={releaseForm.genre} onChange={e => setReleaseForm(f => ({ ...f, genre: e.target.value }))} placeholder="Hip-Hop, R&B" /></div>
            <div><Label>Description</Label><Textarea value={releaseForm.short_description} onChange={e => setReleaseForm(f => ({ ...f, short_description: e.target.value }))} rows={2} /></div>
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Streaming Links</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div><Label>Spotify</Label><Input value={releaseForm.spotify_url} onChange={e => setReleaseForm(f => ({ ...f, spotify_url: e.target.value }))} /></div>
                <div><Label>Apple Music</Label><Input value={releaseForm.apple_music_url} onChange={e => setReleaseForm(f => ({ ...f, apple_music_url: e.target.value }))} /></div>
                <div><Label>YouTube</Label><Input value={releaseForm.youtube_url} onChange={e => setReleaseForm(f => ({ ...f, youtube_url: e.target.value }))} /></div>
              </CardContent>
            </Card>
            <div className="flex items-center gap-2">
              <Switch checked={releaseForm.is_active} onCheckedChange={v => setReleaseForm(f => ({ ...f, is_active: v }))} />
              <Label>Active</Label>
            </div>
            <Button onClick={saveRelease} className="w-full">{editingRelease ? "Update Release" : "Create Release"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========= TRACK DIALOG ========= */}
      <Dialog open={trackDialog} onOpenChange={setTrackDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTrack ? "Edit Track" : "Add Track"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={trackForm.title} onChange={e => setTrackForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Track #</Label><Input type="number" value={trackForm.track_number} onChange={e => setTrackForm(f => ({ ...f, track_number: parseInt(e.target.value) || 1 }))} /></div>
              <div><Label>Duration (sec)</Label><Input type="number" value={trackForm.duration_seconds} onChange={e => setTrackForm(f => ({ ...f, duration_seconds: e.target.value }))} /></div>
              <div>
                <Label>Media Type</Label>
                <Select value={trackForm.media_type} onValueChange={v => setTrackForm(f => ({ ...f, media_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="audio">Audio / Music</SelectItem>
                    <SelectItem value="video">Video / Film</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Artist</Label>
                <Select value={trackForm.artist_id} onValueChange={v => setTrackForm(f => ({ ...f, artist_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select artist" /></SelectTrigger>
                  <SelectContent>
                    {artists.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Release</Label>
                <Select value={trackForm.release_id} onValueChange={v => setTrackForm(f => ({ ...f, release_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select release" /></SelectTrigger>
                  <SelectContent>
                    {releases.map(r => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cover Image */}
            <div>
              <Label>Cover Image</Label>
              <div className="flex gap-2">
                <Input value={trackForm.cover_image_url} onChange={e => setTrackForm(f => ({ ...f, cover_image_url: e.target.value }))} placeholder="URL or upload" className="flex-1" />
                <Input type="file" accept="image/*" onChange={handleCoverUpload} disabled={uploading} className="w-40" />
              </div>
            </div>

            {/* Audio Upload (for audio type) */}
            {trackForm.media_type === "audio" && (
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Upload className="w-4 h-4" /> Audio File</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Upload Audio (MP3, WAV, etc.)</Label>
                    <Input type="file" accept="audio/*" onChange={handleAudioUpload} disabled={uploading} />
                    {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading...</p>}
                  </div>
                  <div><Label>Or paste Audio URL</Label><Input value={trackForm.audio_file_url} onChange={e => setTrackForm(f => ({ ...f, audio_file_url: e.target.value, is_playable: !!e.target.value }))} placeholder="https://..." /></div>
                  <div><Label>External Stream URL (Spotify, YouTube, etc.)</Label><Input value={trackForm.external_stream_url} onChange={e => setTrackForm(f => ({ ...f, external_stream_url: e.target.value }))} /></div>
                </CardContent>
              </Card>
            )}

            {/* Video Upload (for video type) */}
            {trackForm.media_type === "video" && (
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Upload className="w-4 h-4" /> Video File</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Upload Video (MP4, WebM, etc.)</Label>
                    <Input type="file" accept="video/*" onChange={handleVideoUpload} disabled={uploading} />
                    {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading...</p>}
                  </div>
                  <div><Label>Or paste Video URL</Label><Input value={trackForm.video_file_url} onChange={e => setTrackForm(f => ({ ...f, video_file_url: e.target.value, is_playable: !!e.target.value }))} placeholder="https://..." /></div>
                  <div><Label>Embed URL (YouTube, Vimeo link)</Label><Input value={trackForm.video_embed_url} onChange={e => setTrackForm(f => ({ ...f, video_embed_url: e.target.value, is_playable: !!e.target.value }))} placeholder="https://youtube.com/watch?v=..." /></div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={trackForm.is_playable} onCheckedChange={v => setTrackForm(f => ({ ...f, is_playable: v }))} />
                <Label>Playable in browser</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={trackForm.is_active} onCheckedChange={v => setTrackForm(f => ({ ...f, is_active: v }))} />
                <Label>Active</Label>
              </div>
            </div>

            {trackForm.media_type === "audio" && (
              <div><Label>Lyrics</Label><Textarea value={trackForm.lyrics} onChange={e => setTrackForm(f => ({ ...f, lyrics: e.target.value }))} rows={4} placeholder="Song lyrics..." /></div>
            )}

            <Button onClick={saveTrack} className="w-full">{editingTrack ? "Update Track" : "Add Track"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReleaseTracksManager;
