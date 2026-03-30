import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lightbulb, ThumbsUp, Search, Loader2, CheckCircle, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  reviewed: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  approved: "bg-accent/10 text-accent border-accent/30",
  declined: "bg-destructive/10 text-destructive border-destructive/30",
  stocked: "bg-green-500/10 text-green-500 border-green-500/30",
};

const EcoVendSuggestionsManager = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["admin-ecovend-suggestions", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("ecovend_suggestions")
        .select("*")
        .order("upvotes", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data } = await query.limit(100);
      return data || [];
    },
  });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("ecovend_suggestions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update");
      return;
    }
    toast.success(`Suggestion marked as ${status}`);
    queryClient.invalidateQueries({ queryKey: ["admin-ecovend-suggestions"] });
  };

  const filtered = suggestions.filter((s: any) =>
    s.suggestion_text.toLowerCase().includes(search.toLowerCase()) ||
    s.machine_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Lightbulb className="h-6 w-6 text-accent" />
          EcoVend Suggestions
        </h2>
        <p className="text-muted-foreground text-sm">Customer product suggestions for EcoVend machines</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suggestions or machine codes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="stocked">Stocked</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No suggestions found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s: any) => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-foreground">{s.suggestion_text}</span>
                      <Badge variant="outline" className={statusColors[s.status] || ""}>
                        {s.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Machine: {s.machine_code}</span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" /> {s.upvotes || 0} votes
                      </span>
                      <span>{new Date(s.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {s.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(s.id, "reviewed")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-accent" onClick={() => updateStatus(s.id, "approved")}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateStatus(s.id, "declined")}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {s.status === "approved" && (
                      <Button size="sm" variant="outline" className="text-accent border-accent/30" onClick={() => updateStatus(s.id, "stocked")}>
                        Mark Stocked
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EcoVendSuggestionsManager;
