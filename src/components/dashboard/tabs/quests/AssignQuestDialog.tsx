import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap, MapPin } from "lucide-react";

interface AssignQuestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: any;
}

const AssignQuestDialog = ({ open, onOpenChange, node }: AssignQuestDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedQuests, setSelectedQuests] = useState<string[]>([]);

  // Fetch all quests
  const { data: allQuests = [] } = useQuery({
    queryKey: ["all-quests-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quests")
        .select("*")
        .order("title");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch current assignments for this node
  const { data: currentAssignments = [], isSuccess: assignmentsLoaded } = useQuery({
    queryKey: ["node-assignments", node?.id],
    queryFn: async () => {
      if (!node) return [];
      const { data, error } = await supabase
        .from("quest_node_assignments")
        .select("quest_id")
        .eq("node_id", node.id);
      if (error) throw error;
      return data.map((a) => a.quest_id);
    },
    enabled: !!node && open,
  });

  // Set initial selection when assignments are loaded
  useEffect(() => {
    if (assignmentsLoaded && currentAssignments.length >= 0) {
      setSelectedQuests(currentAssignments);
    }
  }, [currentAssignments, assignmentsLoaded]);

  // Reset selection when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedQuests([]);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!node) return;

      // Delete all existing assignments for this node
      await supabase
        .from("quest_node_assignments")
        .delete()
        .eq("node_id", node.id);

      // Insert new assignments
      if (selectedQuests.length > 0) {
        const assignments = selectedQuests.map((questId) => ({
          node_id: node.id,
          quest_id: questId,
          is_active: true,
        }));
        const { error } = await supabase.from("quest_node_assignments").insert(assignments);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["node-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-quest-nodes"] });
      toast({ title: "Quests assigned successfully" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleQuest = (questId: string) => {
    setSelectedQuests((prev) =>
      prev.includes(questId)
        ? prev.filter((id) => id !== questId)
        : [...prev, questId]
    );
  };

  const selectAll = () => {
    setSelectedQuests(allQuests.map((q: any) => q.id));
  };

  const clearAll = () => {
    setSelectedQuests([]);
  };

  if (!node) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Assign Quests to {node.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll}>
            Clear All
          </Button>
        </div>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-2">
            {allQuests.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No quests available. Create quests first.
              </p>
            ) : (
              allQuests.map((quest: any) => (
                <div
                  key={quest.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedQuests.includes(quest.id)
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => toggleQuest(quest.id)}
                >
                  <Checkbox
                    checked={selectedQuests.includes(quest.id)}
                    onCheckedChange={() => toggleQuest(quest.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary flex-shrink-0" />
                      <p className="font-medium text-foreground truncate">{quest.title}</p>
                    </div>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs capitalize">
                        {quest.quest_type}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {quest.xp_reward} XP
                      </Badge>
                      <Badge
                        variant={quest.status === "active" ? "default" : "secondary"}
                        className="text-xs capitalize"
                      >
                        {quest.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save ({selectedQuests.length} selected)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignQuestDialog;
