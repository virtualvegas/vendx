import { useMyFranchise } from "@/hooks/useMyFranchise";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, MapPin, Globe2, Lock } from "lucide-react";

const FranchiseTerritory = () => {
  const { data: franchise, isLoading } = useMyFranchise();

  const territories = useQuery({
    queryKey: ["franchise-territories", franchise?.id],
    enabled: !!franchise?.id,
    queryFn: async () => {
      const { data } = await supabase.from("vendx_franchise_territories" as any)
        .select("*, regions(name, country), locations(name, address, city, country)")
        .eq("franchise_id", franchise.id);
      return (data || []) as any[];
    },
  });

  if (isLoading) return <div className="p-6"><Loader2 className="animate-spin" /></div>;
  if (!franchise) return <div className="p-6 text-muted-foreground">Complete your franchise application first.</div>;

  const regions = (territories.data || []).filter((t: any) => t.region_id);
  const locations = (territories.data || []).filter((t: any) => t.location_id);
  const exclusive = (territories.data || []).some((t: any) => t.is_exclusive);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">My Territory</h1>
        <p className="text-sm text-muted-foreground">Your protected franchise operating area.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-500" />Exclusivity Status
          </CardTitle>
          <CardDescription>
            {exclusive
              ? "You hold exclusive rights within the territory below. No other VendX franchise may operate here."
              : "Your territory is shared. Multiple franchises may operate in overlapping areas."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant={exclusive ? "default" : "secondary"} className="text-sm">
            <Lock className="h-3 w-3 mr-1" />{exclusive ? "Exclusive" : "Non-exclusive"}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5" />Assigned Regions</CardTitle></CardHeader>
        <CardContent>
          {territories.isLoading ? <Loader2 className="animate-spin" /> :
            !regions.length ? <p className="text-sm text-muted-foreground">No regions assigned yet.</p> :
              <div className="space-y-1">
                {regions.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between border rounded p-2">
                    <div><div className="font-medium">{t.regions?.name}</div><div className="text-xs text-muted-foreground">{t.regions?.country}</div></div>
                    {t.is_exclusive && <Badge variant="default"><Lock className="h-3 w-3 mr-1" />Exclusive</Badge>}
                  </div>
                ))}
              </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Assigned Locations</CardTitle></CardHeader>
        <CardContent>
          {territories.isLoading ? <Loader2 className="animate-spin" /> :
            !locations.length ? <p className="text-sm text-muted-foreground">No specific locations assigned.</p> :
              <div className="space-y-1">
                {locations.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between border rounded p-2">
                    <div>
                      <div className="font-medium">{t.locations?.name}</div>
                      <div className="text-xs text-muted-foreground">{[t.locations?.address, t.locations?.city, t.locations?.country].filter(Boolean).join(", ")}</div>
                    </div>
                    {t.is_exclusive && <Badge variant="default"><Lock className="h-3 w-3 mr-1" />Exclusive</Badge>}
                  </div>
                ))}
              </div>}
        </CardContent>
      </Card>

      <Card className="border-yellow-500/40 bg-yellow-500/5">
        <CardContent className="pt-6 text-sm">
          <strong>Need more territory?</strong> Open a support ticket in the <em>Support</em> tab and request a territory expansion or exclusivity upgrade.
        </CardContent>
      </Card>
    </div>
  );
};

export default FranchiseTerritory;
