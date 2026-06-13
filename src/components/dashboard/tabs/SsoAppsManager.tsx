import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Trash2, Copy, ShieldCheck, ExternalLink } from "lucide-react";

const ALL_SCOPES = ["profile", "email", "wallet:read", "rewards:read", "tickets:read", "roles:read", "divisions:read"];

interface SsoApp {
  id: string;
  client_id: string;
  client_secret_prefix: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  homepage_url: string | null;
  redirect_uris: string[];
  allowed_scopes: string[];
  is_active: boolean;
  is_first_party: boolean;
  owner_email: string | null;
  created_at: string;
}

const SsoAppsManager = () => {
  const { toast } = useToast();
  const [apps, setApps] = useState<SsoApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SsoApp | null>(null);
  const [credentialDialog, setCredentialDialog] = useState<{ client_id: string; client_secret: string } | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    logo_url: "",
    homepage_url: "",
    redirect_uris: "",
    allowed_scopes: ["profile", "email"] as string[],
    owner_email: "",
    is_first_party: false,
    is_active: true,
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendx_sso_apps")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    setApps((data as SsoApp[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({
      name: "", description: "", logo_url: "", homepage_url: "",
      redirect_uris: "", allowed_scopes: ["profile", "email"],
      owner_email: "", is_first_party: false, is_active: true,
    });
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setOpen(true); };
  const openEdit = (a: SsoApp) => {
    setEditing(a);
    setForm({
      name: a.name,
      description: a.description ?? "",
      logo_url: a.logo_url ?? "",
      homepage_url: a.homepage_url ?? "",
      redirect_uris: a.redirect_uris.join("\n"),
      allowed_scopes: a.allowed_scopes,
      owner_email: a.owner_email ?? "",
      is_first_party: a.is_first_party,
      is_active: a.is_active,
    });
    setOpen(true);
  };

  const toggleScope = (s: string) => {
    setForm((f) => ({
      ...f,
      allowed_scopes: f.allowed_scopes.includes(s) ? f.allowed_scopes.filter((x) => x !== s) : [...f.allowed_scopes, s],
    }));
  };

  const save = async () => {
    const redirectUris = form.redirect_uris.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!form.name || redirectUris.length === 0) {
      toast({ title: "Name and at least one redirect URI required", variant: "destructive" });
      return;
    }
    if (editing) {
      const { error } = await supabase.from("vendx_sso_apps").update({
        name: form.name,
        description: form.description || null,
        logo_url: form.logo_url || null,
        homepage_url: form.homepage_url || null,
        redirect_uris: redirectUris,
        allowed_scopes: form.allowed_scopes,
        owner_email: form.owner_email || null,
        is_first_party: form.is_first_party,
        is_active: form.is_active,
      }).eq("id", editing.id);
      if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
      toast({ title: "Updated" });
    } else {
      const { data, error } = await supabase.rpc("create_vendx_sso_app", {
        p_name: form.name,
        p_description: form.description || null,
        p_logo_url: form.logo_url || null,
        p_homepage_url: form.homepage_url || null,
        p_redirect_uris: redirectUris,
        p_allowed_scopes: form.allowed_scopes,
        p_owner_email: form.owner_email || null,
        p_is_first_party: form.is_first_party,
      });
      if (error || !data?.[0]) return toast({ title: "Create failed", description: error?.message, variant: "destructive" });
      const row = data[0] as { client_id: string; client_secret: string };
      setCredentialDialog({ client_id: row.client_id, client_secret: row.client_secret });
    }
    setOpen(false);
    resetForm();
    load();
  };

  const rotate = async (appId: string) => {
    if (!confirm("Rotate client secret? The previous secret will stop working.")) return;
    const { data, error } = await supabase.rpc("rotate_vendx_sso_app_secret", { p_app_id: appId });
    if (error) return toast({ title: "Rotate failed", description: error.message, variant: "destructive" });
    const app = apps.find((a) => a.id === appId);
    if (app && data) setCredentialDialog({ client_id: app.client_id, client_secret: data as unknown as string });
    load();
  };

  const remove = async (appId: string) => {
    if (!confirm("Delete this SSO app? All linked accounts and tokens will be removed.")) return;
    const { error } = await supabase.from("vendx_sso_apps").delete().eq("id", appId);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    toast({ title: "Deleted" });
    load();
  };

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast({ title: "Copied" }); };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" /> SSO Applications
          </h2>
          <p className="text-sm text-muted-foreground">
            Register apps that can sign users in with their VendX account.{" "}
            <a href="/developers/sso" target="_blank" className="text-primary inline-flex items-center gap-1 hover:underline">
              Developer docs <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> New App</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : apps.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No SSO apps yet. Create one to get started.</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {apps.map((a) => (
            <Card key={a.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    {a.logo_url ? (
                      <img src={a.logo_url} alt="" className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="text-lg truncate">{a.name}</CardTitle>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <code className="text-xs bg-muted px-2 py-0.5 rounded">{a.client_id}</code>
                        <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => copy(a.client_id)}><Copy className="w-3 h-3" /></Button>
                        {a.is_first_party && <Badge variant="default">First-party</Badge>}
                        <Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? "Active" : "Disabled"}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(a)}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => rotate(a.id)}><RefreshCw className="w-3 h-3 mr-1" /> Rotate</Button>
                    <Button size="sm" variant="outline" onClick={() => remove(a.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-sm space-y-2">
                {a.description && <p className="text-muted-foreground">{a.description}</p>}
                <div className="text-xs text-muted-foreground">
                  Secret prefix: <code className="bg-muted px-1.5 py-0.5 rounded">{a.client_secret_prefix}…</code>
                </div>
                <div className="flex flex-wrap gap-1">
                  {a.allowed_scopes.map((s) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Redirect URIs:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {a.redirect_uris.map((u) => <li key={u}><code className="bg-muted px-1.5 py-0.5 rounded">{u}</code></li>)}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit App" : "Register New App"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Owner email</Label><Input type="email" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Logo URL</Label><Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} /></div>
              <div><Label>Homepage URL</Label><Input value={form.homepage_url} onChange={(e) => setForm({ ...form, homepage_url: e.target.value })} /></div>
            </div>
            <div>
              <Label>Redirect URIs * (one per line)</Label>
              <Textarea rows={3} placeholder="https://yourapp.com/auth/callback" value={form.redirect_uris} onChange={(e) => setForm({ ...form, redirect_uris: e.target.value })} />
            </div>
            <div>
              <Label>Allowed Scopes</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ALL_SCOPES.map((s) => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox checked={form.allowed_scopes.includes(s)} onCheckedChange={() => toggleScope(s)} />
                    <code>{s}</code>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <Switch checked={form.is_first_party} onCheckedChange={(v) => setForm({ ...form, is_first_party: v })} />
                First-party app
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                Active
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time credentials dialog */}
      <Dialog open={!!credentialDialog} onOpenChange={(o) => !o && setCredentialDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save these credentials now</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The client secret is shown only once. Store it in your service's environment as a secret — you cannot retrieve it later.
          </p>
          <div className="space-y-3 mt-3">
            <div>
              <Label>Client ID</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={credentialDialog?.client_id ?? ""} className="font-mono text-xs" />
                <Button size="sm" variant="outline" onClick={() => copy(credentialDialog!.client_id)}><Copy className="w-4 h-4" /></Button>
              </div>
            </div>
            <div>
              <Label>Client Secret</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={credentialDialog?.client_secret ?? ""} className="font-mono text-xs" />
                <Button size="sm" variant="outline" onClick={() => copy(credentialDialog!.client_secret)}><Copy className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setCredentialDialog(null)}>I've saved them</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SsoAppsManager;
