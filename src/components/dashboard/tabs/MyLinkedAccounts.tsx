import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link2, ShieldX, Clock, ShieldCheck } from "lucide-react";

interface LinkedAccount {
  id: string;
  app_id: string;
  scopes_granted: string[];
  linked_at: string;
  last_used_at: string;
  revoked_at: string | null;
  vendx_sso_apps: {
    name: string;
    logo_url: string | null;
    homepage_url: string | null;
    description: string | null;
  } | null;
}

const MyLinkedAccounts = () => {
  const { toast } = useToast();
  const [links, setLinks] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendx_sso_linked_accounts")
      .select("id, app_id, scopes_granted, linked_at, last_used_at, revoked_at, vendx_sso_apps(name, logo_url, homepage_url, description)")
      .order("last_used_at", { ascending: false });
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    setLinks((data as unknown as LinkedAccount[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const revoke = async (id: string) => {
    if (!confirm("Revoke this app's access? It will no longer be able to read your VendX data.")) return;
    // Revoke link + active tokens
    const link = links.find((l) => l.id === id);
    if (!link) return;
    await supabase.from("vendx_sso_tokens").delete().eq("app_id", link.app_id);
    const { error } = await supabase.from("vendx_sso_linked_accounts").delete().eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Access revoked" });
    load();
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Link2 className="w-6 h-6 text-primary" /> Linked Accounts
        </h2>
        <p className="text-sm text-muted-foreground">Apps and services connected to your VendX account.</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : links.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No linked services yet</p>
            <p className="text-sm text-muted-foreground">When you sign into another VendX service with your account, it will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {links.map((l) => (
            <Card key={l.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    {l.vendx_sso_apps?.logo_url ? (
                      <img src={l.vendx_sso_apps.logo_url} alt="" className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                        <Link2 className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="text-lg">{l.vendx_sso_apps?.name ?? "Unknown app"}</CardTitle>
                      {l.vendx_sso_apps?.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{l.vendx_sso_apps.description}</p>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => revoke(l.id)}>
                    <ShieldX className="w-4 h-4 mr-1" /> Revoke
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-sm space-y-2">
                <div className="flex flex-wrap gap-1">
                  {l.scopes_granted.map((s) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Linked {new Date(l.linked_at).toLocaleDateString()} · last used {new Date(l.last_used_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyLinkedAccounts;
