import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Map, Globe2, MapPin, Lock, Users } from "lucide-react";
import { logAuditEvent } from "@/hooks/useAuditLog";

const FranchiseTerritoryManager = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [franchiseId, setFranchiseId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "region", region_id: "", location_id: "", is_exclusive: false, notes: "" });

  const franchises = useQuery({
    queryKey: ["tm-franchises"],
    queryFn: async () => (await supabase.from("vendx_franchises" as any).select("id, business_name, status").order("business_name")).data as any[] || [],
  });
  const regions = useQuery({
    queryKey: ["tm-regions"],
    queryFn: async () => (await supabase.from("regions").select("id, name, country").order("name")).data || [],
  });
  const locations = useQuery({
    queryKey: ["tm-locations"],
    queryFn: async () => (await supabase.from("locations").select("id, name, city, country").order("name")).data || [],
  });
  const territories = useQuery({
    queryKey: ["tm-territories", franchiseId],
    enabled: !!franchiseId,
    queryFn: async () => (await supabase.from("vendx_franchise_territories" as any)
      .select("*, regions(name, country), locations(name, city, country)")
      .eq("franchise_id", franchiseId)).data as any[] || [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!franchiseId) throw new Error("Select a franchise");
      const payload: any = { franchise_id: franchiseId, is_exclusive: form.is_exclusive, notes: form.notes || null };
      if (form.kind === "region") {
        if (!form.region_id) throw new Error("Pick a region");
        payload.region_id = form.region_id;
      } else {
        if (!form.location_id) throw new Error("Pick a location");
        payload.location_id = form.location_id;
      }
      const { error } = await supabase.from("vendx_franchise_territories" as any).insert(payload);
      if (error) throw error;
      await logAuditEvent({ action: "franchise.territory.assign", entity_type: "vendx_franchise_territories", entity_id: franchiseId, details: payload });
    },
    onSuccess: () => {
      toast({ title: "Territory assigned" });
      setForm({ kind: "region", region_id: "", location_id: "", is_exclusive: false, notes: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["tm-territories"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendx_franchise_territories" as any).delete().eq("id", id);
      if (error) throw error;
      await logAuditEvent({ action: "franchise.territory.remove", entity_type: "vendx_franchise_territories", entity_id: id });
    },
    onSuccess: () => { toast({ title: "Removed" }); qc.invalidateQueries({ queryKey: ["tm-territories"] }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const regs = (territories.data || []).filter((t: any) => t.region_id);
  const locs = (territories.data || []).filter((t: any) => t.location_id);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Map className="h-6 w-6" />Franchise Territory Assignments</h1>
        <p className="text-sm text-muted-foreground">Assign regions and specific locations to franchisees. Mark exclusivity to protect a territory from other franchises.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Select Franchise</CardTitle></CardHeader>
        <CardContent>
          <Select value={franchiseId} onValueChange={setFranchiseId}>
            <SelectTrigger className="max-w-md"><SelectValue placeholder="Pick a franchise..." /></SelectTrigger>
            <SelectContent>
              {franchises.data?.map((f: any) => (
                <SelectItem key={f.id} value={f.id}>{f.business_name} · <span className="text-xs opacity-70">{f.status}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {franchiseId && (
        <>
          <div className="flex justify-end">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Assign Territory</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Assign Territory</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v, region_id: "", location_id: "" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="region">Region (broad area)</SelectItem>
                        <SelectItem value="location">Specific Location</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.kind === "region" ? (
                    <div>
                      <Label>Region</Label>
                      <Select value={form.region_id} onValueChange={(v) => setForm({ ...form, region_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select region..." /></SelectTrigger>
                        <SelectContent>
                          {regions.data?.map((r: any) => (<SelectItem key={r.id} value={r.id}>{r.name} ({r.country})</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <Label>Location</Label>
                      <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select location..." /></SelectTrigger>
                        <SelectContent>
                          {locations.data?.map((l: any) => (<SelectItem key={l.id} value={l.id}>{l.name} — {[l.city, l.country].filter(Boolean).join(", ")}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_exclusive} onCheckedChange={(v) => setForm({ ...form, is_exclusive: v })} />
                    <Label>Exclusive territory (blocks other franchises)</Label>
                  </div>
                  <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
                  <Button className="w-full" onClick={() => add.mutate()} disabled={add.isPending}>
                    {add.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Assign
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5" />Assigned Regions ({regs.length})</CardTitle></CardHeader>
            <CardContent>
              {territories.isLoading ? <Loader2 className="animate-spin" /> :
                !regs.length ? <p className="text-sm text-muted-foreground">No regions assigned.</p> :
                  <div className="space-y-2">
                    {regs.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between border rounded p-2">
                        <div>
                          <div className="font-medium">{t.regions?.name}</div>
                          <div className="text-xs text-muted-foreground">{t.regions?.country}{t.notes && ` · ${t.notes}`}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {t.is_exclusive && <Badge><Lock className="h-3 w-3 mr-1" />Exclusive</Badge>}
                          <Button size="icon" variant="ghost" onClick={() => remove.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Assigned Locations ({locs.length})</CardTitle></CardHeader>
            <CardContent>
              {territories.isLoading ? <Loader2 className="animate-spin" /> :
                !locs.length ? <p className="text-sm text-muted-foreground">No specific locations assigned.</p> :
                  <div className="space-y-2">
                    {locs.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between border rounded p-2">
                        <div>
                          <div className="font-medium">{t.locations?.name}</div>
                          <div className="text-xs text-muted-foreground">{[t.locations?.city, t.locations?.country].filter(Boolean).join(", ")}{t.notes && ` · ${t.notes}`}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {t.is_exclusive && <Badge><Lock className="h-3 w-3 mr-1" />Exclusive</Badge>}
                          <Button size="icon" variant="ghost" onClick={() => remove.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default FranchiseTerritoryManager;
