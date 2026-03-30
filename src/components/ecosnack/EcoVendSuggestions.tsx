import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ThumbsUp, Send, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface EcoVendSuggestionsProps {
  machineId: string;
  machineCode: string;
}

const getSessionId = () => {
  let id = localStorage.getItem("vendx_suggestion_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("vendx_suggestion_session", id);
  }
  return id;
};

const EcoVendSuggestions = ({ machineId, machineCode }: EcoVendSuggestionsProps) => {
  const [newSuggestion, setNewSuggestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const sessionId = getSessionId();

  const { data: suggestions = [] } = useQuery({
    queryKey: ["ecovend-suggestions", machineCode],
    queryFn: async () => {
      const { data } = await supabase
        .from("ecovend_suggestions")
        .select("*")
        .eq("machine_code", machineCode)
        .order("upvotes", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const { data: myVotes = [] } = useQuery({
    queryKey: ["ecovend-my-votes", sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ecovend_suggestion_votes")
        .select("suggestion_id")
        .eq("session_id", sessionId);
      return (data || []).map((v: any) => v.suggestion_id);
    },
  });

  const handleSubmit = async () => {
    const text = newSuggestion.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("ecovend_suggestions").insert({
        machine_id: machineId,
        machine_code: machineCode,
        user_id: user?.id || null,
        suggestion_text: text,
      });
      if (error) throw error;
      setNewSuggestion("");
      toast.success("Suggestion submitted! Thanks for your feedback.");
      queryClient.invalidateQueries({ queryKey: ["ecovend-suggestions", machineCode] });
    } catch {
      toast.error("Failed to submit suggestion");
    }
    setSubmitting(false);
  };

  const handleUpvote = async (suggestionId: string) => {
    if (myVotes.includes(suggestionId)) return;
    try {
      await supabase.from("ecovend_suggestion_votes").insert({
        suggestion_id: suggestionId,
        session_id: sessionId,
      });
      await supabase
        .from("ecovend_suggestions")
        .update({ upvotes: suggestions.find((s: any) => s.id === suggestionId)?.upvotes + 1 })
        .eq("id", suggestionId);
      queryClient.invalidateQueries({ queryKey: ["ecovend-suggestions", machineCode] });
      queryClient.invalidateQueries({ queryKey: ["ecovend-my-votes", sessionId] });
    } catch {
      toast.error("Already voted");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-accent" />
        <h3 className="text-base font-semibold text-foreground">Suggest a Snack</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        What would you like to see stocked in this machine?
      </p>

      {/* Submit form */}
      <div className="flex gap-2">
        <Input
          placeholder="e.g. Kind Bars, RXBARs..."
          value={newSuggestion}
          onChange={(e) => setNewSuggestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="text-sm"
          maxLength={100}
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!newSuggestion.trim() || submitting}
          className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {/* Popular suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Popular Requests
          </p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {suggestions.slice(0, 8).map((s: any) => (
              <div
                key={s.id}
                className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-foreground truncate">{s.suggestion_text}</span>
                  {s.status === "stocked" && (
                    <Badge variant="outline" className="text-accent border-accent/50 text-[10px] shrink-0">
                      Stocked!
                    </Badge>
                  )}
                </div>
                <button
                  onClick={() => handleUpvote(s.id)}
                  disabled={myVotes.includes(s.id)}
                  className={`flex items-center gap-1 text-xs shrink-0 ml-2 px-2 py-1 rounded-md transition-colors ${
                    myVotes.includes(s.id)
                      ? "text-accent bg-accent/10"
                      : "text-muted-foreground hover:text-accent hover:bg-accent/10"
                  }`}
                >
                  <ThumbsUp className="h-3 w-3" />
                  <span>{s.upvotes || 0}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EcoVendSuggestions;
