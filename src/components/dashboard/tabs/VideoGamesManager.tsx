import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, Gamepad2, Trash2, Edit, Search, RefreshCw, Eye, EyeOff, ExternalLink } from "lucide-react";
import { FaGooglePlay, FaApple, FaSteam, FaWindows, FaItchIo, FaAmazon, FaXbox, FaPlaystation } from "react-icons/fa";
import { SiNintendoswitch } from "react-icons/si";
import { Globe } from "lucide-react";

interface VideoGame {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  full_description: string | null;
  cover_image_url: string | null;
  platforms: any;
  release_status: string;
  google_play_url: string | null;
  apple_store_url: string | null;
  microsoft_store_url: string | null;
  steam_url: string | null;
  itch_io_url: string | null;
  amazon_app_store_url: string | null;
  xbox_store_url: string | null;
  playstation_store_url: string | null;
  nintendo_eshop_url: string | null;
  browser_play_url: string | null;
  trailer_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  display_order: number;
}

const RELEASE_STATUSES = [
  { value: "live", label: "Live" },
  { value: "beta", label: "Beta" },
  { value: "coming_soon", label: "Coming Soon" },
];

const VideoGamesManager = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingGame, setEditingGame] = useState<VideoGame | null>(null);
  const [selectedGame, setSelectedGame] = useState<VideoGame | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    short_description: "",
    full_description: "",
    cover_image_url: "",
    release_status: "coming_soon",
    google_play_url: "",
    apple_store_url: "",
    microsoft_store_url: "",
    steam_url: "",
    itch_io_url: "",
    amazon_app_store_url: "",
    xbox_store_url: "",
    playstation_store_url: "",
    nintendo_eshop_url: "",
    browser_play_url: "",
    trailer_url: "",
    is_featured: false,
    is_active: true,
    display_order: 0,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: games, isLoading } = useQuery({
    queryKey: ["video-games-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_games")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as VideoGame[];
    },
  });

  const gameMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const platforms = [];
      if (data.google_play_url) platforms.push("android");
      if (data.apple_store_url) platforms.push("ios");
      if (data.microsoft_store_url) platforms.push("windows");
      if (data.steam_url) platforms.push("steam");
      if (data.itch_io_url) platforms.push("itchio");
      if (data.amazon_app_store_url) platforms.push("amazon");
      if (data.xbox_store_url) platforms.push("xbox");
      if (data.playstation_store_url) platforms.push("playstation");
      if (data.nintendo_eshop_url) platforms.push("nintendo");
      if (data.browser_play_url) platforms.push("browser");

      const payload = {
        title: data.title,
        slug: data.slug || data.title.toLowerCase().replace(/\s+/g, "-"),
        short_description: data.short_description || null,
        full_description: data.full_description || null,
        cover_image_url: data.cover_image_url || null,
        platforms: platforms,
        release_status: data.release_status,
        google_play_url: data.google_play_url || null,
        apple_store_url: data.apple_store_url || null,
        microsoft_store_url: data.microsoft_store_url || null,
        steam_url: data.steam_url || null,
        itch_io_url: data.itch_io_url || null,
        amazon_app_store_url: data.amazon_app_store_url || null,
        xbox_store_url: data.xbox_store_url || null,
        playstation_store_url: data.playstation_store_url || null,
        nintendo_eshop_url: data.nintendo_eshop_url || null,
        browser_play_url: data.browser_play_url || null,
        trailer_url: data.trailer_url || null,
        is_featured: data.is_featured,
        is_active: data.is_active,
        display_order: data.display_order,
      };

      if (editingGame) {
        const { error } = await supabase
          .from("video_games")
          .update(payload)
          .eq("id", editingGame.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("video_games").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-games-admin"] });
      toast({ title: editingGame ? "Game updated" : "Game created" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("video_games").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-games-admin"] });
      toast({ title: "Game deleted" });
      setShowDeleteConfirm(false);
      setSelectedGame(null);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      slug: "",
      short_description: "",
      full_description: "",
      cover_image_url: "",
      release_status: "coming_soon",
      google_play_url: "",
      apple_store_url: "",
      microsoft_store_url: "",
      steam_url: "",
      itch_io_url: "",
      amazon_app_store_url: "",
      xbox_store_url: "",
      playstation_store_url: "",
      nintendo_eshop_url: "",
      browser_play_url: "",
      trailer_url: "",
      is_featured: false,
      is_active: true,
      display_order: 0,
    });
    setEditingGame(null);
  };

  const handleEdit = (game: VideoGame) => {
    setEditingGame(game);
    setFormData({
      title: game.title,
      slug: game.slug,
      short_description: game.short_description || "",
      full_description: game.full_description || "",
      cover_image_url: game.cover_image_url || "",
      release_status: game.release_status,
      google_play_url: game.google_play_url || "",
      apple_store_url: game.apple_store_url || "",
      microsoft_store_url: game.microsoft_store_url || "",
      steam_url: game.steam_url || "",
      itch_io_url: game.itch_io_url || "",
      amazon_app_store_url: game.amazon_app_store_url || "",
      xbox_store_url: game.xbox_store_url || "",
      playstation_store_url: game.playstation_store_url || "",
      nintendo_eshop_url: game.nintendo_eshop_url || "",
      browser_play_url: game.browser_play_url || "",
      trailer_url: game.trailer_url || "",
      is_featured: game.is_featured || false,
      is_active: game.is_active,
      display_order: game.display_order || 0,
    });
    setShowDialog(true);
  };

  const filteredGames = useMemo(() => {
    return (games || []).filter((game) =>
      game.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [games, searchTerm]);

  const stats = useMemo(
    () => ({
      total: games?.length || 0,
      live: games?.filter((g) => g.release_status === "live").length || 0,
      active: games?.filter((g) => g.is_active).length || 0,
    }),
    [games]
  );

  const getPlatformIcons = (game: VideoGame) => {
    const icons = [];
    if (game.google_play_url) icons.push(<FaGooglePlay key="android" className="w-4 h-4" />);
    if (game.apple_store_url) icons.push(<FaApple key="ios" className="w-4 h-4" />);
    if (game.microsoft_store_url) icons.push(<FaWindows key="windows" className="w-4 h-4" />);
    if (game.steam_url) icons.push(<FaSteam key="steam" className="w-4 h-4" />);
    if (game.itch_io_url) icons.push(<FaItchIo key="itchio" className="w-4 h-4" />);
    if (game.amazon_app_store_url) icons.push(<FaAmazon key="amazon" className="w-4 h-4" />);
    if (game.xbox_store_url) icons.push(<FaXbox key="xbox" className="w-4 h-4" />);
    if (game.playstation_store_url) icons.push(<FaPlaystation key="playstation" className="w-4 h-4" />);
    if (game.nintendo_eshop_url) icons.push(<SiNintendoswitch key="nintendo" className="w-4 h-4" />);
    if (game.browser_play_url) icons.push(<span key="browser" className="w-4 h-4"><Globe className="w-4 h-4" /></span>);
    return icons;
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Gamepad2 className="w-6 h-6 text-primary" />
          Video Games Manager
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["video-games-admin"] })}>
            <RefreshCw className="w-4 h-4 mr-2" />Refresh
          </Button>
          <Button onClick={() => { resetForm(); setShowDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />Add Game
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Games</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Live</p>
            <p className="text-2xl font-bold text-green-500">{stats.live}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Published</p>
            <p className="text-2xl font-bold text-primary">{stats.active}</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search games..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Games ({filteredGames.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Game</TableHead>
                  <TableHead>Platforms</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Visible</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGames.map((game) => (
                  <TableRow key={game.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {game.cover_image_url && (
                          <img src={game.cover_image_url} alt={game.title} className="w-12 h-12 object-cover rounded" />
                        )}
                        <div>
                          <p className="font-medium">{game.title}</p>
                          {game.short_description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{game.short_description}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">{getPlatformIcons(game)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={game.release_status === "live" ? "default" : game.release_status === "beta" ? "secondary" : "outline"}>
                        {RELEASE_STATUSES.find((s) => s.value === game.release_status)?.label || game.release_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {game.is_active ? <Eye className="w-4 h-4 text-green-500" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell>{game.display_order}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(game)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { setSelectedGame(game); setShowDeleteConfirm(true); }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGame ? "Edit Game" : "Add New Game"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); gameMutation.mutate(formData); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="auto-generated" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Short Description</Label>
                <Input value={formData.short_description} onChange={(e) => setFormData({ ...formData, short_description: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Full Description</Label>
                <Textarea value={formData.full_description} onChange={(e) => setFormData({ ...formData, full_description: e.target.value })} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Cover Image URL</Label>
                <Input value={formData.cover_image_url} onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Trailer URL</Label>
                <Input value={formData.trailer_url} onChange={(e) => setFormData({ ...formData, trailer_url: e.target.value })} placeholder="YouTube/Vimeo URL" />
              </div>
              <div className="space-y-2">
                <Label>Release Status</Label>
                <Select value={formData.release_status} onValueChange={(v) => setFormData({ ...formData, release_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RELEASE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input type="number" value={formData.display_order} onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="space-y-3 border rounded-lg p-4">
              <h3 className="font-semibold">Platform Links</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><FaGooglePlay />Google Play</Label>
                  <Input value={formData.google_play_url} onChange={(e) => setFormData({ ...formData, google_play_url: e.target.value })} placeholder="https://play.google.com/..." />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><FaApple />App Store</Label>
                  <Input value={formData.apple_store_url} onChange={(e) => setFormData({ ...formData, apple_store_url: e.target.value })} placeholder="https://apps.apple.com/..." />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><FaWindows />Microsoft Store</Label>
                  <Input value={formData.microsoft_store_url} onChange={(e) => setFormData({ ...formData, microsoft_store_url: e.target.value })} placeholder="https://microsoft.com/..." />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><FaSteam />Steam</Label>
                  <Input value={formData.steam_url} onChange={(e) => setFormData({ ...formData, steam_url: e.target.value })} placeholder="https://store.steampowered.com/..." />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><FaItchIo />itch.io</Label>
                  <Input value={formData.itch_io_url} onChange={(e) => setFormData({ ...formData, itch_io_url: e.target.value })} placeholder="https://itch.io/..." />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><FaAmazon />Amazon Appstore</Label>
                  <Input value={formData.amazon_app_store_url} onChange={(e) => setFormData({ ...formData, amazon_app_store_url: e.target.value })} placeholder="https://amazon.com/..." />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><FaXbox />Xbox Store</Label>
                  <Input value={formData.xbox_store_url} onChange={(e) => setFormData({ ...formData, xbox_store_url: e.target.value })} placeholder="https://xbox.com/..." />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><FaPlaystation />PlayStation Store</Label>
                  <Input value={formData.playstation_store_url} onChange={(e) => setFormData({ ...formData, playstation_store_url: e.target.value })} placeholder="https://store.playstation.com/..." />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><SiNintendoswitch />Nintendo eShop</Label>
                  <Input value={formData.nintendo_eshop_url} onChange={(e) => setFormData({ ...formData, nintendo_eshop_url: e.target.value })} placeholder="https://nintendo.com/..." />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="flex items-center gap-2"><Globe className="w-4 h-4" />Browser Play URL (embed)</Label>
                  <Input value={formData.browser_play_url} onChange={(e) => setFormData({ ...formData, browser_play_url: e.target.value })} placeholder="https://... (embeddable game URL)" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
                <Label>Published</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.is_featured} onCheckedChange={(v) => setFormData({ ...formData, is_featured: v })} />
                <Label>Featured</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={gameMutation.isPending}>
                {editingGame ? "Update" : "Add"} Game
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Game</DialogTitle>
            <DialogDescription>Are you sure you want to delete "{selectedGame?.title}"?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => selectedGame && deleteMutation.mutate(selectedGame.id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideoGamesManager;
