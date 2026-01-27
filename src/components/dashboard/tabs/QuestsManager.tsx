import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MapPin, Zap, Trash2, Edit, RefreshCw, Link, BarChart3, Users } from "lucide-react";
import NodeDialog from "./quests/NodeDialog";
import QuestDialog from "./quests/QuestDialog";
import AssignQuestDialog from "./quests/AssignQuestDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const QuestsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [questDialogOpen, setQuestDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<any>(null);
  const [editingQuest, setEditingQuest] = useState<any>(null);
  const [selectedNodeForAssign, setSelectedNodeForAssign] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: "node" | "quest"; id: string } | null>(null);

  // Fetch nodes
  const { data: nodes = [], isLoading: nodesLoading } = useQuery({
    queryKey: ["admin-quest-nodes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quest_nodes")
        .select("*, location:locations(name, city)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch quests
  const { data: quests = [], isLoading: questsLoading } = useQuery({
    queryKey: ["admin-quests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch locations for linking
  const { data: locations = [] } = useQuery({
    queryKey: ["admin-locations-for-quests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("id, name, city, latitude, longitude").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch analytics
  const { data: analytics } = useQuery({
    queryKey: ["quest-analytics"],
    queryFn: async () => {
      const { data: completions, error } = await supabase
        .from("quest_completions")
        .select("id, status, quest_id, node_id");
      if (error) throw error;
      
      const completed = completions?.filter(c => c.status === "completed" || c.status === "claimed").length || 0;
      const inProgress = completions?.filter(c => c.status === "in_progress").length || 0;
      
      return { completed, inProgress, total: completions?.length || 0 };
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: "node" | "quest"; id: string }) => {
      const table = type === "node" ? "quest_nodes" : "quests";
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries({ queryKey: type === "node" ? ["admin-quest-nodes"] : ["admin-quests"] });
      toast({ title: `${type === "node" ? "Node" : "Quest"} deleted` });
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEditNode = (node: any) => {
    setEditingNode(node);
    setNodeDialogOpen(true);
  };

  const handleEditQuest = (quest: any) => {
    setEditingQuest(quest);
    setQuestDialogOpen(true);
  };

  const handleAssignQuests = (node: any) => {
    setSelectedNodeForAssign(node);
    setAssignDialogOpen(true);
  };

  const handleDelete = (type: "node" | "quest", id: string) => {
    setItemToDelete({ type, id });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteMutation.mutate(itemToDelete);
    }
  };

  // Stats
  const stats = {
    totalNodes: nodes.length,
    activeNodes: nodes.filter((n: any) => n.is_active).length,
    totalQuests: quests.length,
    activeQuests: quests.filter((q: any) => q.status === "active").length,
  };

  const filteredNodes = nodes.filter((n: any) =>
    n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.location?.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredQuests = quests.filter((q: any) =>
    q.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const rarityColors: Record<string, string> = {
    common: "bg-muted text-muted-foreground",
    rare: "bg-blue-500/20 text-blue-400",
    epic: "bg-purple-500/20 text-purple-400",
    legendary: "bg-amber-500/20 text-amber-400",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">VendX Quests Manager</h1>
          <p className="text-muted-foreground">Manage quest nodes, quests, and rewards</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-quest"] })}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { setEditingNode(null); setNodeDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Node
          </Button>
          <Button onClick={() => { setEditingQuest(null); setQuestDialogOpen(true); }} variant="secondary">
            <Plus className="w-4 h-4 mr-2" />
            Add Quest
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <MapPin className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{stats.totalNodes}</p>
            <p className="text-xs text-muted-foreground">Total Nodes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <MapPin className="w-6 h-6 mx-auto mb-2 text-accent" />
            <p className="text-2xl font-bold">{stats.activeNodes}</p>
            <p className="text-xs text-muted-foreground">Active Nodes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Zap className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{stats.totalQuests}</p>
            <p className="text-xs text-muted-foreground">Total Quests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Zap className="w-6 h-6 mx-auto mb-2 text-accent" />
            <p className="text-2xl font-bold">{stats.activeQuests}</p>
            <p className="text-xs text-muted-foreground">Active Quests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="w-6 h-6 mx-auto mb-2 text-green-400" />
            <p className="text-2xl font-bold">{analytics?.completed || 0}</p>
            <p className="text-xs text-muted-foreground">Completions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 mx-auto mb-2 text-blue-400" />
            <p className="text-2xl font-bold">{analytics?.inProgress || 0}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search nodes or quests..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="nodes">
        <TabsList>
          <TabsTrigger value="nodes" className="gap-2">
            <MapPin className="w-4 h-4" />
            Nodes ({nodes.length})
          </TabsTrigger>
          <TabsTrigger value="quests" className="gap-2">
            <Zap className="w-4 h-4" />
            Quests ({quests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nodes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Quest Nodes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nodesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : filteredNodes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchQuery ? "No nodes match your search" : "No quest nodes yet. Create one to get started!"}
                </p>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2 pr-4">
                    {filteredNodes.map((node: any) => (
                      <div key={node.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: node.color || "#00d4ff" }}
                          >
                            <MapPin className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{node.name}</p>
                            <div className="flex gap-2 flex-wrap mt-1">
                              <Badge className={rarityColors[node.rarity]} variant="outline">
                                {node.rarity}
                              </Badge>
                              <Badge variant="outline" className="capitalize">{node.node_type}</Badge>
                              {node.location?.city && (
                                <Badge variant="secondary" className="text-xs">{node.location.city}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <Badge variant={node.is_active ? "default" : "secondary"}>
                            {node.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Button size="icon" variant="ghost" onClick={() => handleAssignQuests(node)} title="Assign Quests">
                            <Link className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleEditNode(node)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete("node", node.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Quests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {questsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : filteredQuests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchQuery ? "No quests match your search" : "No quests yet. Create one to get started!"}
                </p>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2 pr-4">
                    {filteredQuests.map((quest: any) => (
                      <div key={quest.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{quest.title}</p>
                          <div className="flex gap-2 flex-wrap mt-1">
                            <Badge variant="outline" className="capitalize">{quest.quest_type}</Badge>
                            <Badge variant="outline">{quest.xp_reward} XP</Badge>
                            <Badge variant="outline" className="capitalize">{quest.difficulty}</Badge>
                            {quest.credits_reward > 0 && (
                              <Badge variant="secondary">${quest.credits_reward}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <Badge variant={quest.status === "active" ? "default" : "secondary"} className="capitalize">
                            {quest.status}
                          </Badge>
                          <Button size="icon" variant="ghost" onClick={() => handleEditQuest(quest)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete("quest", quest.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <NodeDialog
        open={nodeDialogOpen}
        onOpenChange={(open) => {
          setNodeDialogOpen(open);
          if (!open) setEditingNode(null);
        }}
        node={editingNode}
        locations={locations}
      />

      <QuestDialog
        open={questDialogOpen}
        onOpenChange={(open) => {
          setQuestDialogOpen(open);
          if (!open) setEditingQuest(null);
        }}
        quest={editingQuest}
      />

      <AssignQuestDialog
        open={assignDialogOpen}
        onOpenChange={(open) => {
          setAssignDialogOpen(open);
          if (!open) setSelectedNodeForAssign(null);
        }}
        node={selectedNodeForAssign}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this {itemToDelete?.type}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default QuestsManager;
