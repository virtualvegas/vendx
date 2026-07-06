import { useMyFranchise } from "@/hooks/useMyFranchise";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Monitor, MapPin } from "lucide-react";

const FranchiseRoute = () => {
  const { data: franchise, isLoading: fl } = useMyFranchise();

  const { data: machines, isLoading: ml } = useQuery({
    queryKey: ["franchise-route-machines", franchise?.id],
    enabled: !!franchise?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendx_franchise_machines" as any)
        .select("id, assigned_at, machine:vendx_machines(id, name, machine_code, status, machine_type, last_seen, location:locations(name, city, country))")
        .eq("franchise_id", franchise.id);
      return (data || []) as any[];
    },
  });

  const { data: territories } = useQuery({
    queryKey: ["franchise-territories", franchise?.id],
    enabled: !!franchise?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendx_franchise_territories" as any)
        .select("id, region:regions(name), location:locations(name, city, country)")
        .eq("franchise_id", franchise.id);
      return (data || []) as any[];
    },
  });

  if (fl || ml) return <div className="p-6"><Loader2 className="animate-spin" /></div>;
  if (!franchise) return <div className="p-6 text-muted-foreground">No franchise on file.</div>;

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Territories</CardTitle></CardHeader>
        <CardContent>
          {!territories?.length ? (
            <p className="text-sm text-muted-foreground">No territories assigned yet. Contact VendX to expand your route.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {territories.map((t: any) => (
                <Badge key={t.id} variant="outline">
                  {t.region?.name || (t.location ? `${t.location.name || t.location.city}, ${t.location.country}` : "—")}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Monitor className="h-5 w-5" />Machines on My Route ({machines?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {!machines?.length ? (
            <p className="text-sm text-muted-foreground">No machines assigned yet. Order machines through VendX to build your route.</p>
          ) : (
            <div className="space-y-2">
              {machines.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{m.machine?.name || m.machine?.machine_code}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.machine?.machine_code} • {m.machine?.machine_type}
                      {m.machine?.location && ` • ${m.machine.location.city}, ${m.machine.location.country}`}
                    </div>
                  </div>
                  <Badge variant={m.machine?.status === "active" ? "default" : "secondary"}>{m.machine?.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FranchiseRoute;
