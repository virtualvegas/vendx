import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/hooks/useAuditLog";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, ExternalLink } from "lucide-react";

const PoliciesManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const { data: policies, isLoading } = useQuery({
    queryKey: ["admin-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_policies")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, title, content }: { id: string; title: string; content: string }) => {
      const { error } = await supabase
        .from("site_policies")
        .update({ title, content })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-policies"] });
      setEditingId(null);
      toast({ title: "Policy updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const startEditing = (policy: any) => {
    setEditingId(policy.id);
    setEditTitle(policy.title);
    setEditContent(policy.content);
  };

  if (isLoading) return <p className="text-muted-foreground p-4">Loading policies...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Site Policies</h2>
        <p className="text-muted-foreground">Manage Privacy Policy, Terms of Service, and Cookie Policy. Content supports basic Markdown.</p>
      </div>

      <Tabs defaultValue={policies?.[0]?.slug}>
        <TabsList className="w-full justify-start">
          {policies?.map((p) => (
            <TabsTrigger key={p.slug} value={p.slug}>{p.title}</TabsTrigger>
          ))}
        </TabsList>

        {policies?.map((policy) => (
          <TabsContent key={policy.slug} value={policy.slug}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{policy.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Last updated: {new Date(policy.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/policy/${policy.slug}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-1" /> Preview
                    </a>
                  </Button>
                  {editingId !== policy.id && (
                    <Button size="sm" onClick={() => startEditing(policy)}>Edit</Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingId === policy.id ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Title</label>
                      <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Content (Markdown)</label>
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[400px] font-mono text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => updateMutation.mutate({ id: policy.id, title: editTitle, content: editContent })}
                        disabled={updateMutation.isPending}
                      >
                        <Save className="w-4 h-4 mr-1" />
                        {updateMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg max-h-[400px] overflow-y-auto">
                    {policy.content}
                  </pre>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default PoliciesManager;
