import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Gamepad2, Trash2, Edit, Search, RefreshCw, ImageIcon } from "lucide-react";

interface ArcadeGameTitle {
  id: string;
  name: string;
  description: string | null;
  game_type: string;
  image_url: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

const GAME_TYPES = [
  { value: "classic", label: "Classic Arcade" },
  { value: "redemption", label: "Redemption" },
  { value: "skill", label: "Skill Game" },
  { value: "racing", label: "Racing" },
  { value: "fighting", label: "Fighting" },
  { value: "shooter", label: "Shooter" },
  { value: "sports", label: "Sports" },
  { value: "pinball", label: "Pinball" },
  { value: "crane", label: "Crane / Claw" },
  { value: "rhythm", label: "Rhythm / Music" },
  { value: "other", label: "Other" },
];

const emptyForm = {
  name: "",
  description: "",
  game_type: "classic",
  image_url: "",
  is_active: true,
};

const ArcadeGameTitlesManager = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingGame, setEditingGame] = useState<ArcadeGameTitle | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState(emptyForm);

  const { data: games = [], isLoading, refetch } = useQuery({
    queryKey: ["arcade-game-titles-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arcade_game_titles")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as ArcadeGameTitle[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof emptyForm & { id?: string }) => {
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        game_type: values.game_type,
        image_url: values.image_url?.trim() || null,
        is_active: values.is_active,
      };

      if (values.id) {
        const { error } = await supabase.from("arcade_game_titles").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("arcade_game_titles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arcade-game-titles-admin"] });
      toast.success(editingGame ? "Game updated" : "Game added");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("arcade_game_titles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arcade-game-titles-admin"] });
      toast.success("Game deleted");
      setDeleteConfirmId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingGame(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (game: ArcadeGameTitle) => {
    setEditingGame(game);
    setForm({
      name: game.name,
      description: game.description || "",
      game_type: game.game_type,
      image_url: game.image_url || "",
      is_active: game.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingGame(null);
    setForm(emptyForm);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    saveMutation.mutate({ ...form, id: editingGame?.id });
  };

  const filtered = games.filter((g) =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.game_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeLabel = (type: string) =>
    GAME_TYPES.find((t) => t.value === type)?.label || type;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
            <span className="truncate">Arcade Game Titles</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage the library of physical arcade games available at locations
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Game</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{games.length}</p>
          <p className="text-xs text-muted-foreground">Total Games</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-accent">{games.filter((g) => g.is_active).length}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{new Set(games.map((g) => g.game_type)).size}</p>
          <p className="text-xs text-muted-foreground">Game Types</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-muted-foreground">{games.filter((g) => !g.is_active).length}</p>
          <p className="text-xs text-muted-foreground">Inactive</p>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search games..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No games match your search" : "No arcade games added yet"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((game) => (
                  <TableRow key={game.id}>
                    <TableCell className="hidden sm:table-cell">
                      {game.image_url ? (
                        <img src={game.image_url} alt={game.name} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{game.name}</div>
                      {game.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{game.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">{getTypeLabel(game.game_type)}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge className={game.is_active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}>
                        {game.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(game)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(game.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGame ? "Edit Arcade Game" : "Add Arcade Game"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Game Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. PAC-MAN" />
            </div>
            <div>
              <Label>Game Type</Label>
              <Select value={form.game_type} onValueChange={(v) => setForm((p) => ({ ...p, game_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GAME_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of the game"
                rows={3}
              />
            </div>
            <div>
              <Label>Image URL</Label>
              <Input
                value={form.image_url}
                onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                placeholder="https://..."
              />
              {form.image_url && (
                <img src={form.image_url} alt="Preview" className="mt-2 w-20 h-20 rounded-lg object-cover" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={(c) => setForm((p) => ({ ...p, is_active: c }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editingGame ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Arcade Game?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will remove the game from all location assignments. This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArcadeGameTitlesManager;
