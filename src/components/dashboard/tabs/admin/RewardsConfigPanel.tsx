import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, RotateCcw } from "lucide-react";

interface ConfigRow {
  id: string;
  source: string;
  display_name: string;
  points_per_dollar: number;
  bronze_multiplier: number;
  silver_multiplier: number;
  gold_multiplier: number;
  platinum_multiplier: number;
  is_active: boolean;
  notes: string | null;
}

const RewardsConfigPanel = () => {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [dirty, setDirty] = useState<Record<string, ConfigRow>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendx_rewards_config")
      .select("*")
      .order("display_name");
    if (error) toast({ title: "Error loading config", description: error.message, variant: "destructive" });
    setRows((data as ConfigRow[]) || []);
    setDirty({});
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (id: string, patch: Partial<ConfigRow>) => {
    const base = dirty[id] || rows.find((r) => r.id === id)!;
    setDirty({ ...dirty, [id]: { ...base, ...patch } });
  };

  const value = (id: string, key: keyof ConfigRow) => {
    const r = dirty[id] || rows.find((x) => x.id === id);
    return r ? (r[key] as any) : "";
  };

  const save = async (id: string) => {
    const row = dirty[id];
    if (!row) return;
    const { error } = await supabase.from("vendx_rewards_config").update({
      points_per_dollar: Number(row.points_per_dollar) || 0,
      bronze_multiplier: Number(row.bronze_multiplier) || 1,
      silver_multiplier: Number(row.silver_multiplier) || 1,
      gold_multiplier: Number(row.gold_multiplier) || 1,
      platinum_multiplier: Number(row.platinum_multiplier) || 1,
      is_active: row.is_active,
      notes: row.notes,
    }).eq("id", id);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Saved", description: `${row.display_name} updated` });
    const next = { ...dirty }; delete next[id]; setDirty(next);
    load();
  };

  if (loading) return <p className="text-muted-foreground">Loading rewards configuration...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Points Earn Rates</span>
          <Button variant="outline" size="sm" onClick={load}><RotateCcw className="w-4 h-4 mr-1" />Refresh</Button>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure how many points customers earn per dollar by source, with multipliers per tier. Loyverse POS uses the "pos" row.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Pts / $</TableHead>
              <TableHead>Bronze ×</TableHead>
              <TableHead>Silver ×</TableHead>
              <TableHead>Gold ×</TableHead>
              <TableHead>Platinum ×</TableHead>
              <TableHead>Active</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.display_name}</div>
                  <div className="text-xs text-muted-foreground">{r.source}</div>
                </TableCell>
                <TableCell><Input type="number" step="0.01" className="w-20" value={value(r.id, "points_per_dollar")} onChange={(e) => update(r.id, { points_per_dollar: Number(e.target.value) })} /></TableCell>
                <TableCell><Input type="number" step="0.01" className="w-20" value={value(r.id, "bronze_multiplier")} onChange={(e) => update(r.id, { bronze_multiplier: Number(e.target.value) })} /></TableCell>
                <TableCell><Input type="number" step="0.01" className="w-20" value={value(r.id, "silver_multiplier")} onChange={(e) => update(r.id, { silver_multiplier: Number(e.target.value) })} /></TableCell>
                <TableCell><Input type="number" step="0.01" className="w-20" value={value(r.id, "gold_multiplier")} onChange={(e) => update(r.id, { gold_multiplier: Number(e.target.value) })} /></TableCell>
                <TableCell><Input type="number" step="0.01" className="w-20" value={value(r.id, "platinum_multiplier")} onChange={(e) => update(r.id, { platinum_multiplier: Number(e.target.value) })} /></TableCell>
                <TableCell><Switch checked={!!value(r.id, "is_active")} onCheckedChange={(v) => update(r.id, { is_active: v })} /></TableCell>
                <TableCell>
                  <Button size="sm" disabled={!dirty[r.id]} onClick={() => save(r.id)}>
                    <Save className="w-4 h-4 mr-1" />Save
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default RewardsConfigPanel;
