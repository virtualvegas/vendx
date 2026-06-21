import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Search, Wrench, ExternalLink, DollarSign, Package, AlertCircle, FileText } from "lucide-react";
import { formatDisplayDate } from "@/lib/dateUtils";
import MachineServiceHistory from "./MachineServiceHistory";

const ExtSoldMachinesPanel = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [activeMachine, setActiveMachine] = useState<any>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sold-machines-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_sold_machines_with_stats" as any);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return rows.filter((r: any) => {
      if (filter === "serviced" && Number(r.total_tickets) === 0) return false;
      if (filter === "never_serviced" && Number(r.total_tickets) > 0) return false;
      if (filter === "open" && Number(r.open_tickets) === 0) return false;
      if (!s) return true;
      return [r.asset_label, r.client_name, r.make, r.model, r.serial_number, r.custom_request_number]
        .some((v: any) => (v || "").toString().toLowerCase().includes(s));
    });
  }, [rows, search, filter]);

  const totals = useMemo(() => ({
    machines: rows.length,
    serviced: rows.filter((r: any) => Number(r.total_tickets) > 0).length,
    revenue: rows.reduce((sum: number, r: any) => sum + Number(r.total_invoiced || 0), 0),
    sales: rows.reduce((sum: number, r: any) => sum + Number(r.sale_price || 0), 0),
    openTickets: rows.reduce((sum: number, r: any) => sum + Number(r.open_tickets || 0), 0),
  }), [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat icon={<Package className="w-3.5 h-3.5" />} label="Machines sold/built" value={totals.machines} />
        <Stat icon={<Wrench className="w-3.5 h-3.5" />} label="Serviced at least once" value={`${totals.serviced} / ${totals.machines}`} />
        <Stat icon={<AlertCircle className="w-3.5 h-3.5" />} label="Open service tickets" value={totals.openTickets} />
        <Stat icon={<DollarSign className="w-3.5 h-3.5" />} label="Sale revenue" value={`$${totals.sales.toFixed(0)}`} />
        <Stat icon={<DollarSign className="w-3.5 h-3.5" />} label="Service revenue" value={`$${totals.revenue.toFixed(0)}`} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by machine, client, serial, request #..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="w-56">
          <SearchableSelect value={filter} onValueChange={setFilter}
            options={[
              { value: "all", label: "All machines" },
              { value: "serviced", label: "Serviced at least once" },
              { value: "never_serviced", label: "Never serviced" },
              { value: "open", label: "Has open tickets" },
            ]}
            placeholder="Filter" searchPlaceholder="Search filters..." />
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading sold machines...</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
          {rows.length === 0 ? "No machines marked as sold/built by us yet. Edit a client machine and toggle \"Purchased from us\"." : "No machines match this filter."}
        </Card>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {filtered.map((m: any) => {
            const isWarrantyActive = m.warranty_expires_on && new Date(m.warranty_expires_on) > new Date();
            return (
              <Card key={m.machine_id} className="p-3.5 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <Badge variant={m.status === "active" ? "default" : "outline"} className="text-[10px] capitalize">{m.status}</Badge>
                      {Number(m.open_tickets) > 0 && <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/40">{m.open_tickets} open</Badge>}
                      {isWarrantyActive && <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-500/40">Under warranty</Badge>}
                      {m.custom_request_number && <Badge variant="outline" className="text-[10px] font-mono">{m.custom_request_number}</Badge>}
                    </div>
                    <h3 className="font-semibold truncate">{m.asset_label}</h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.client_name || "(no client)"} · {[m.make, m.model].filter(Boolean).join(" ") || m.machine_type || "—"}
                    </p>
                    {m.serial_number && <p className="text-[11px] text-muted-foreground font-mono">SN: {m.serial_number}</p>}
                  </div>
                  {m.photo_url && (
                    <img src={m.photo_url} alt="" className="w-14 h-14 rounded object-cover border shrink-0" />
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                  <div>
                    <div className="text-muted-foreground">Sold</div>
                    <div className="font-medium">{m.sale_date ? formatDisplayDate(m.sale_date, { month: "short", day: "numeric", year: "numeric" }) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Services</div>
                    <div className="font-medium">{m.total_tickets}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Invoiced</div>
                    <div className="font-medium">${Number(m.total_invoiced).toFixed(0)}</div>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-3">
                  <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => setActiveMachine(m)}>
                    <Wrench className="w-3.5 h-3.5" /> Service history
                  </Button>
                  {m.custom_arcade_request_id && (
                    <Button size="sm" variant="ghost" className="gap-1" asChild>
                      <a href={`#custom-arcade/${m.custom_arcade_request_id}`}><FileText className="w-3.5 h-3.5" /> Build</a>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!activeMachine} onOpenChange={(v) => !v && setActiveMachine(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              {activeMachine?.asset_label}
              <span className="text-xs font-normal text-muted-foreground">· {activeMachine?.client_name}</span>
            </DialogTitle>
          </DialogHeader>
          {activeMachine && <MachineServiceHistory machineId={activeMachine.machine_id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Stat = ({ icon, label, value }: any) => (
  <Card className="p-2.5">
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon} {label}</div>
    <div className="text-lg font-bold mt-0.5">{value}</div>
  </Card>
);

export default ExtSoldMachinesPanel;
