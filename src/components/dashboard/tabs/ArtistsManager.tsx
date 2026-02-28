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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Heart, Music, Film, Users } from "lucide-react";

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
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
}

const emptyForm = {
  name: "", slug: "", artist_type: "music", bio: "", short_bio: "",
  profile_image_url: "", banner_image_url: "",
  is_legacy: false, legacy_tribute_text: "", birth_date: "", death_date: "",
  website_url: "", instagram_url: "", twitter_url: "", youtube_url: "",
  spotify_url: "", apple_music_url: "", soundcloud_url: "", tiktok_url: "",
  contact_email: "", booking_email: "", management_company: "",
  is_active: true, is_featured: false, display_order: 0,
};

const ArtistsManager = () => {
  const [artists, setArtists] = useState<MediaArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MediaArtist | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchArtists = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("media_artists")
      .select("*")
      .order("display_order", { ascending: true });
    if (!error) setArtists((data as unknown as MediaArtist[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchArtists(); }, []);

  const generateSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (a: MediaArtist) => {
    setEditing(a);
    setForm({
      name: a.name, slug: a.slug, artist_type: a.artist_type,
      bio: a.bio || "", short_bio: a.short_bio || "",
      profile_image_url: a.profile_image_url || "", banner_image_url: a.banner_image_url || "",
      is_legacy: a.is_legacy, legacy_tribute_text: a.legacy_tribute_text || "",
      birth_date: a.birth_date || "", death_date: a.death_date || "",
      website_url: a.website_url || "", instagram_url: a.instagram_url || "",
      twitter_url: a.twitter_url || "", youtube_url: a.youtube_url || "",
      spotify_url: a.spotify_url || "", apple_music_url: a.apple_music_url || "",
      soundcloud_url: a.soundcloud_url || "", tiktok_url: a.tiktok_url || "",
      contact_email: a.contact_email || "", booking_email: a.booking_email || "",
      management_company: a.management_company || "",
      is_active: a.is_active, is_featured: a.is_featured, display_order: a.display_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error("Name is required"); return; }
    const slug = form.slug || generateSlug(form.name);
    const payload: any = {
      ...form,
      slug,
      bio: form.bio || null, short_bio: form.short_bio || null,
      profile_image_url: form.profile_image_url || null,
      banner_image_url: form.banner_image_url || null,
      legacy_tribute_text: form.legacy_tribute_text || null,
      birth_date: form.birth_date || null, death_date: form.death_date || null,
      website_url: form.website_url || null, instagram_url: form.instagram_url || null,
      twitter_url: form.twitter_url || null, youtube_url: form.youtube_url || null,
      spotify_url: form.spotify_url || null, apple_music_url: form.apple_music_url || null,
      soundcloud_url: form.soundcloud_url || null, tiktok_url: form.tiktok_url || null,
      contact_email: form.contact_email || null, booking_email: form.booking_email || null,
      management_company: form.management_company || null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("media_artists").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("media_artists").insert(payload));
    }

    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Artist updated" : "Artist created");
    setDialogOpen(false);
    fetchArtists();
  };

  const handleDelete = async (a: MediaArtist) => {
    if (!confirm(`Delete "${a.name}"?`)) return;
    const { error } = await supabase.from("media_artists").delete().eq("id", a.id);
    if (error) toast.error(error.message);
    else { toast.success("Artist deleted"); fetchArtists(); }
  };

  const updateField = (key: string, value: any) => setForm((p) => ({ ...p, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6" /> Artists & Filmmakers
          </h2>
          <p className="text-muted-foreground text-sm">Manage artist profiles, legacy memorials, and contact info</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Add Artist</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{artists.length}</p><p className="text-xs text-muted-foreground">Total Artists</p>
        </CardContent></Card>
        <Card className="bg-card/50 border-border/50"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{artists.filter(a => a.artist_type === "music" || a.artist_type === "both").length}</p><p className="text-xs text-muted-foreground">Music Artists</p>
        </CardContent></Card>
        <Card className="bg-card/50 border-border/50"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{artists.filter(a => a.artist_type === "film" || a.artist_type === "both").length}</p><p className="text-xs text-muted-foreground">Filmmakers</p>
        </CardContent></Card>
        <Card className="bg-card/50 border-border/50"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{artists.filter(a => a.is_legacy).length}</p><p className="text-xs text-muted-foreground">Legacy Memorials</p>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card className="bg-card/50 border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Artist</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Legacy</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : artists.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No artists yet</TableCell></TableRow>
            ) : artists.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {a.profile_image_url ? (
                      <img src={a.profile_image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><Music className="w-5 h-5 text-muted-foreground" /></div>
                    )}
                    <div>
                      <p className="font-medium text-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground">/{a.slug}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{a.artist_type === "both" ? "Music & Film" : a.artist_type}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={a.is_active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}>
                    {a.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {a.is_legacy && <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1"><Heart className="w-3 h-3" /> Legacy</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(a)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Artist" : "Create Artist"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => { updateField("name", e.target.value); if (!editing) updateField("slug", generateSlug(e.target.value)); }} /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => updateField("slug", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Artist Type</Label>
                <Select value={form.artist_type} onValueChange={(v) => updateField("artist_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="music">Music</SelectItem>
                    <SelectItem value="film">Film</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Display Order</Label><Input type="number" value={form.display_order} onChange={(e) => updateField("display_order", parseInt(e.target.value) || 0)} /></div>
            </div>
            <div><Label>Short Bio</Label><Input value={form.short_bio} onChange={(e) => updateField("short_bio", e.target.value)} placeholder="One-liner shown on cards" /></div>
            <div><Label>Full Bio</Label><Textarea value={form.bio} onChange={(e) => updateField("bio", e.target.value)} rows={4} /></div>

            {/* Images */}
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Profile Image URL</Label><Input value={form.profile_image_url} onChange={(e) => updateField("profile_image_url", e.target.value)} /></div>
              <div><Label>Banner Image URL</Label><Input value={form.banner_image_url} onChange={(e) => updateField("banner_image_url", e.target.value)} /></div>
            </div>

            {/* Legacy Section */}
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Heart className="w-4 h-4 text-destructive" /> Legacy Memorial</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_legacy} onCheckedChange={(v) => updateField("is_legacy", v)} />
                  <Label>This is a legacy/memorial page</Label>
                </div>
                {form.is_legacy && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Birth Date</Label><Input type="date" value={form.birth_date} onChange={(e) => updateField("birth_date", e.target.value)} /></div>
                      <div><Label>Death Date</Label><Input type="date" value={form.death_date} onChange={(e) => updateField("death_date", e.target.value)} /></div>
                    </div>
                    <div><Label>Tribute Text</Label><Textarea value={form.legacy_tribute_text} onChange={(e) => updateField("legacy_tribute_text", e.target.value)} rows={3} placeholder="A tribute message honoring this artist..." /></div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Social Links */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Social & Streaming Links</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div><Label>Website</Label><Input value={form.website_url} onChange={(e) => updateField("website_url", e.target.value)} /></div>
                <div><Label>Instagram</Label><Input value={form.instagram_url} onChange={(e) => updateField("instagram_url", e.target.value)} /></div>
                <div><Label>X / Twitter</Label><Input value={form.twitter_url} onChange={(e) => updateField("twitter_url", e.target.value)} /></div>
                <div><Label>YouTube</Label><Input value={form.youtube_url} onChange={(e) => updateField("youtube_url", e.target.value)} /></div>
                <div><Label>Spotify</Label><Input value={form.spotify_url} onChange={(e) => updateField("spotify_url", e.target.value)} /></div>
                <div><Label>Apple Music</Label><Input value={form.apple_music_url} onChange={(e) => updateField("apple_music_url", e.target.value)} /></div>
                <div><Label>SoundCloud</Label><Input value={form.soundcloud_url} onChange={(e) => updateField("soundcloud_url", e.target.value)} /></div>
                <div><Label>TikTok</Label><Input value={form.tiktok_url} onChange={(e) => updateField("tiktok_url", e.target.value)} /></div>
              </CardContent>
            </Card>

            {/* Contact */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Contact & Booking</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div><Label>Contact Email</Label><Input value={form.contact_email} onChange={(e) => updateField("contact_email", e.target.value)} /></div>
                <div><Label>Booking Email</Label><Input value={form.booking_email} onChange={(e) => updateField("booking_email", e.target.value)} /></div>
                <div className="col-span-2"><Label>Management Company</Label><Input value={form.management_company} onChange={(e) => updateField("management_company", e.target.value)} /></div>
              </CardContent>
            </Card>

            {/* Toggles */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => updateField("is_active", v)} /><Label>Active</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_featured} onCheckedChange={(v) => updateField("is_featured", v)} /><Label>Featured</Label></div>
            </div>

            <Button onClick={handleSave} className="w-full">{editing ? "Update Artist" : "Create Artist"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArtistsManager;
