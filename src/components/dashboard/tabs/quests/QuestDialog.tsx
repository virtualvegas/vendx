import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface QuestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quest?: any;
}

const questTypes = [
  { value: "free", label: "Free Quest" },
  { value: "game", label: "Game Quest" },
  { value: "paid", label: "Paid Quest" },
  { value: "order", label: "Order-Based Quest" },
];

const difficulties = ["easy", "medium", "hard", "extreme"];
const statuses = ["active", "inactive", "scheduled", "expired"];

const QuestDialog = ({ open, onOpenChange, quest }: QuestDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!quest;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    short_description: "",
    quest_type: "free",
    status: "active",
    difficulty: "easy",
    xp_reward: "25",
    points_reward: "0",
    credits_reward: "0",
    required_purchase_amount: "",
    requires_checkin: true,
    requires_qr_scan: false,
    requires_transaction: false,
    estimated_time_minutes: "",
    is_featured: false,
    max_completions_per_user: "1",
  });

  useEffect(() => {
    if (quest) {
      setFormData({
        title: quest.title || "",
        description: quest.description || "",
        short_description: quest.short_description || "",
        quest_type: quest.quest_type || "free",
        status: quest.status || "active",
        difficulty: quest.difficulty || "easy",
        xp_reward: quest.xp_reward?.toString() || "25",
        points_reward: quest.points_reward?.toString() || "0",
        credits_reward: quest.credits_reward?.toString() || "0",
        required_purchase_amount: quest.required_purchase_amount?.toString() || "",
        requires_checkin: quest.requires_checkin ?? true,
        requires_qr_scan: quest.requires_qr_scan ?? false,
        requires_transaction: quest.requires_transaction ?? false,
        estimated_time_minutes: quest.estimated_time_minutes?.toString() || "",
        is_featured: quest.is_featured ?? false,
        max_completions_per_user: quest.max_completions_per_user?.toString() || "1",
      });
    } else {
      setFormData({
        title: "",
        description: "",
        short_description: "",
        quest_type: "free",
        status: "active",
        difficulty: "easy",
        xp_reward: "25",
        points_reward: "0",
        credits_reward: "0",
        required_purchase_amount: "",
        requires_checkin: true,
        requires_qr_scan: false,
        requires_transaction: false,
        estimated_time_minutes: "",
        is_featured: false,
        max_completions_per_user: "1",
      });
    }
  }, [quest, open]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        title: data.title,
        description: data.description,
        short_description: data.short_description || null,
        quest_type: data.quest_type as "free" | "game" | "paid" | "order",
        status: data.status as "active" | "inactive" | "scheduled" | "expired",
        difficulty: data.difficulty,
        xp_reward: parseInt(data.xp_reward) || 25,
        points_reward: parseInt(data.points_reward) || 0,
        credits_reward: parseFloat(data.credits_reward) || 0,
        required_purchase_amount: data.required_purchase_amount ? parseFloat(data.required_purchase_amount) : null,
        requires_checkin: data.requires_checkin,
        requires_qr_scan: data.requires_qr_scan,
        requires_transaction: data.requires_transaction,
        estimated_time_minutes: data.estimated_time_minutes ? parseInt(data.estimated_time_minutes) : null,
        is_featured: data.is_featured,
        max_completions_per_user: parseInt(data.max_completions_per_user) || 1,
      };

      if (isEditing) {
        const { error } = await supabase.from("quests").update(payload).eq("id", quest.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quests").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quests"] });
      toast({ title: isEditing ? "Quest updated" : "Quest created" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({ title: "Title and description are required", variant: "destructive" });
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Quest" : "Create Quest"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Visit the Arcade"
              />
            </div>

            <div className="col-span-2">
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Visit our downtown arcade location..."
                rows={3}
              />
            </div>

            <div className="col-span-2">
              <Label>Short Description</Label>
              <Input
                value={formData.short_description}
                onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                placeholder="Check in at the arcade"
              />
            </div>

            <div>
              <Label>Quest Type</Label>
              <Select value={formData.quest_type} onValueChange={(v) => setFormData({ ...formData, quest_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {questTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Difficulty</Label>
              <Select value={formData.difficulty} onValueChange={(v) => setFormData({ ...formData, difficulty: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {difficulties.map((d) => (
                    <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Estimated Time (min)</Label>
              <Input
                type="number"
                value={formData.estimated_time_minutes}
                onChange={(e) => setFormData({ ...formData, estimated_time_minutes: e.target.value })}
                placeholder="15"
              />
            </div>

            <div>
              <Label>XP Reward *</Label>
              <Input
                type="number"
                value={formData.xp_reward}
                onChange={(e) => setFormData({ ...formData, xp_reward: e.target.value })}
              />
            </div>

            <div>
              <Label>Points Reward</Label>
              <Input
                type="number"
                value={formData.points_reward}
                onChange={(e) => setFormData({ ...formData, points_reward: e.target.value })}
              />
            </div>

            <div>
              <Label>Credits Reward ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.credits_reward}
                onChange={(e) => setFormData({ ...formData, credits_reward: e.target.value })}
              />
            </div>

            <div>
              <Label>Max Completions / User</Label>
              <Input
                type="number"
                value={formData.max_completions_per_user}
                onChange={(e) => setFormData({ ...formData, max_completions_per_user: e.target.value })}
              />
            </div>

            {(formData.quest_type === "paid" || formData.quest_type === "order") && (
              <div className="col-span-2">
                <Label>Required Purchase Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.required_purchase_amount}
                  onChange={(e) => setFormData({ ...formData, required_purchase_amount: e.target.value })}
                  placeholder="5.00"
                />
              </div>
            )}

            <div className="col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Requires Check-in</Label>
                <Switch
                  checked={formData.requires_checkin}
                  onCheckedChange={(v) => setFormData({ ...formData, requires_checkin: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Requires QR Scan</Label>
                <Switch
                  checked={formData.requires_qr_scan}
                  onCheckedChange={(v) => setFormData({ ...formData, requires_qr_scan: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Requires Transaction</Label>
                <Switch
                  checked={formData.requires_transaction}
                  onCheckedChange={(v) => setFormData({ ...formData, requires_transaction: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Featured Quest</Label>
                <Switch
                  checked={formData.is_featured}
                  onCheckedChange={(v) => setFormData({ ...formData, is_featured: v })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuestDialog;
