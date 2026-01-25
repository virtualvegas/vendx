import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MapPin, Zap, Star, Trash2, Edit, RefreshCw } from "lucide-react";

const QuestsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [questDialogOpen, setQuestDialogOpen] = useState(false);

  // Fetch nodes
  const { data: nodes = [], isLoading: nodesLoading } = useQuery({
    queryKey: ["admin-quest-nodes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quest_nodes").select("*").order("created_at", { ascending: false });
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
      const { data, error } = await supabase.from("locations").select("id, name, city").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Stats
  const stats = {
    totalNodes: nodes.length,
    activeNodes: nodes.filter((n: any) => n.is_active).length,
    totalQuests: quests.length,
    activeQuests: quests.filter((q: any) => q.status === "active").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">VendX Quests Manager</h1>
          <p className="text-muted-foreground">Manage quest nodes, quests, and rewards</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-quest"] })}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setNodeDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Node
          </Button>
          <Button onClick={() => setQuestDialogOpen(true)} variant="secondary">
            <Plus className="w-4 h-4 mr-2" />
            Add Quest
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><MapPin className="w-6 h-6 mx-auto mb-2 text-primary" /><p className="text-2xl font-bold">{stats.totalNodes}</p><p className="text-xs text-muted-foreground">Total Nodes</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><MapPin className="w-6 h-6 mx-auto mb-2 text-accent" /><p className="text-2xl font-bold">{stats.activeNodes}</p><p className="text-xs text-muted-foreground">Active Nodes</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><Zap className="w-6 h-6 mx-auto mb-2 text-primary" /><p className="text-2xl font-bold">{stats.totalQuests}</p><p className="text-xs text-muted-foreground">Total Quests</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><Zap className="w-6 h-6 mx-auto mb-2 text-accent" /><p className="text-2xl font-bold">{stats.activeQuests}</p><p className="text-xs text-muted-foreground">Active Quests</p></CardContent></Card>
      </div>

      {/* Nodes List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" />Quest Nodes</CardTitle>
        </CardHeader>
        <CardContent>
          {nodesLoading ? <p>Loading...</p> : nodes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No quest nodes yet. Create one to get started!</p>
          ) : (
            <div className="space-y-2">
              {nodes.slice(0, 10).map((node: any) => (
                <div key={node.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: node.color || "#00d4ff" }}>
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">{node.name}</p>
                      <div className="flex gap-2"><Badge variant="outline" className="capitalize">{node.rarity}</Badge><Badge variant="outline">{node.node_type}</Badge></div>
                    </div>
                  </div>
                  <Badge variant={node.is_active ? "default" : "secondary"}>{node.is_active ? "Active" : "Inactive"}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quests List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5" />Quests</CardTitle>
        </CardHeader>
        <CardContent>
          {questsLoading ? <p>Loading...</p> : quests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No quests yet. Create one to get started!</p>
          ) : (
            <div className="space-y-2">
              {quests.slice(0, 10).map((quest: any) => (
                <div key={quest.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{quest.title}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="capitalize">{quest.quest_type}</Badge>
                      <Badge variant="outline">{quest.xp_reward} XP</Badge>
                      <Badge variant="outline" className="capitalize">{quest.difficulty}</Badge>
                    </div>
                  </div>
                  <Badge variant={quest.status === "active" ? "default" : "secondary"} className="capitalize">{quest.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuestsManager;
