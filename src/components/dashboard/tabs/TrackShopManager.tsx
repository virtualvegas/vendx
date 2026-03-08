import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Music, Play, Crown, Star, DollarSign } from "lucide-react";

const defaultForm = {
  title: "",
  slug: "",
  description: "",
  producer: "",
  genre: "",
  bpm: "",
  key: "",
  duration_seconds: "",
  preview_url: "",
  full_file_url: "",
  cover_image_url: "",
  price: "0",
  license_type: "standard",
  is_active: true,
  is_featured: false,
  display_order: "0",
  tags: "",
};

const TrackShopManager = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);

  const { data: beats, isLoading } = useQuery({
    queryKey: ["admin-beat-tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beat_tracks")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: purchases } = useQuery({
    queryKey: ["admin-beat-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beat_purchases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        title: values.title,
        slug: values.slug || values.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        description: values.description || null,
        producer: values.producer || null,
        genre: values.genre ? values.genre.split(",").map((g) => g.trim()).filter(Boolean) : null,
        bpm: values.bpm ? parseInt(values.bpm) : null,
        key: values.key || null,
        duration_seconds: values.duration_seconds ? parseInt(values.duration_seconds) : null,
        preview_url: values.preview_url || null,
        full_file_url: values.full_file_url || null,
        cover_image_url: values.cover_image_url || null,
        price: parseFloat(values.price) || 0,
        license_type: values.license_type,
        is_active: values.is_active,
        is_featured: values.is_featured,
        display_order: parseInt(values.display_order) || 0,
        tags: values.tags ? values.tags.split(",").map((t) => t.trim()).filter(Boolean) : null,
      };

      if (editingId) {
        const { error } = await supabase.from("beat_tracks").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("beat_tracks").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-beat-tracks"] });
      toast.success(editingId ? "Beat updated" : "Beat created");
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error("Failed to save", { description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("beat_tracks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-beat-tracks"] });
      toast.success("Beat deleted");
    },
  });

  const resetForm = () => { setForm(defaultForm); setEditingId(null); };

  const openEdit = (beat: any) => {
    setEditingId(beat.id);
    setForm({
      title: beat.title,
      slug: beat.slug,
      description: beat.description || "",
      producer: beat.producer || "",
      genre: beat.genre?.join(", ") || "",
      bpm: beat.bpm ? String(beat.bpm) : "",
      key: beat.key || "",
      duration_seconds: beat.duration_seconds ? String(beat.duration_seconds) : "",
      preview_url: beat.preview_url || "",
      full_file_url: beat.full_file_url || "",
      cover_image_url: beat.cover_image_url || "",
      price: String(beat.price),
      license_type: beat.license_type || "standard",
      is_active: beat.is_active ?? true,
      is_featured: beat.is_featured ?? false,
      display_order: String(beat.display_order ?? 0),
      tags: beat.tags?.join(", ") || "",
    });
    setDialogOpen(true);
  };

  const totalRevenue = purchases?.filter(p => p.payment_status === "completed").reduce((s, p) => s + Number(p.amount), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Track Shop Manager</h2>
          <p className="text-muted-foreground">Manage beats, previews, and track sales</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Add Beat</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Beat" : "Add Beat"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <Label>Producer</Label>
                  <Input value={form.producer} onChange={(e) => setForm({ ...form, producer: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Price ($)</Label>
                  <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
                <div>
                  <Label>BPM</Label>
                  <Input type="number" value={form.bpm} onChange={(e) => setForm({ ...form, bpm: e.target.value })} />
                </div>
                <div>
                  <Label>Key</Label>
                  <Input placeholder="e.g. C Minor" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Duration (seconds)</Label>
                  <Input type="number" value={form.duration_seconds} onChange={(e) => setForm({ ...form, duration_seconds: e.target.value })} />
                </div>
                <div>
                  <Label>License Type</Label>
                  <Select value={form.license_type} onValueChange={(v) => setForm({ ...form, license_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="exclusive">Exclusive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Genres (comma separated)</Label>
                <Input placeholder="Hip Hop, Trap, R&B" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
              </div>
              <div>
                <Label>Preview Audio URL (30s clip)</Label>
                <Input value={form.preview_url} onChange={(e) => setForm({ ...form, preview_url: e.target.value })} placeholder="Upload to beat-previews bucket" />
              </div>
              <div>
                <Label>Full File URL (private)</Label>
                <Input value={form.full_file_url} onChange={(e) => setForm({ ...form, full_file_url: e.target.value })} placeholder="Upload to beat-files bucket" />
              </div>
              <div>
                <Label>Cover Image URL</Label>
                <Input value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} />
              </div>
              <div>
                <Label>Tags (comma separated)</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Display Order</Label>
                  <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} />
                </div>
                <div className="space-y-3 pt-5">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} />
                    <Label>Active</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_featured} onCheckedChange={(c) => setForm({ ...form, is_featured: c })} />
                    <Label>Featured</Label>
                  </div>
                </div>
              </div>
              <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="w-full">
                {saveMutation.isPending ? "Saving..." : editingId ? "Update Beat" : "Create Beat"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{beats?.length || 0}</p><p className="text-sm text-muted-foreground">Total Beats</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{purchases?.filter(p => p.payment_status === "completed").length || 0}</p><p className="text-sm text-muted-foreground">Sales</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p><p className="text-sm text-muted-foreground">Revenue</p></CardContent></Card>
      </div>

      {/* Beats Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden sm:table-cell">Producer</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="hidden md:table-cell">License</TableHead>
                <TableHead className="hidden lg:table-cell">Plays</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : beats && beats.length > 0 ? (
                beats.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.title}</TableCell>
                    <TableCell>{b.producer || "—"}</TableCell>
                    <TableCell>${Number(b.price).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{b.license_type}</Badge></TableCell>
                    <TableCell>{b.play_count}</TableCell>
                    <TableCell>
                      <Badge variant={b.is_active ? "default" : "secondary"}>
                        {b.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(b.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No beats yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrackShopManager;
