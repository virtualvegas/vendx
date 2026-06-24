import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Package,
  Wrench,
  FileText,
  Search,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Cpu,
  Calendar,
  DollarSign,
} from "lucide-react";
import { formatDisplayDate } from "@/lib/dateUtils";
import MachineServiceHistory from "./external-service/MachineServiceHistory";

/**
 * My Machines — customer / business-owner view of every machine VendX has on file for them.
 * Shows machines they bought from VendX, custom-built units, and any client-owned units
 * we service externally. Pulls from vendx_external_machines (RLS scoped via linked_user_id).
 */
const MyMachines = () => {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<any>(null);

  const { data: machines = [], isLoading } = useQuery({
    queryKey: ["my-owned-machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_external_machines" as any)
        .select(
          "id, asset_label, machine_type, make, model, serial_number, photo_url, status, install_date, warranty_expires_on, sale_date, sale_price, purchased_from_us, custom_arcade_request_id, manual_urls, warranty_pdf_url, location:vendx_external_locations(name), client:vendx_external_clients(company_name), custom_request:vendx_custom_arcade_requests(request_number, build_type)"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["my-machine-tickets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendx_external_service_tickets" as any)
        .select("id, machine_id, status, subject, created_at, resolved_at")
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const ticketStats = useMemo(() => {
    const map = new Map<string, { total: number; open: number; last?: string }>();
    tickets.forEach((t: any) => {
      if (!t.machine_id) return;
      const s = map.get(t.machine_id) || { total: 0, open: 0 };
      s.total++;
      if (!["completed", "invoiced", "cancelled"].includes(t.status)) s.open++;
      if (!s.last || new Date(t.created_at) > new Date(s.last)) s.last = t.created_at;
      map.set(t.machine_id, s);
    });
    return map;
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return machines;
    return machines.filter((m: any) =>
      [m.asset_label, m.make, m.model, m.serial_number, m.machine_type, m.location?.name]
        .some((v: any) => (v || "").toString().toLowerCase().includes(q))
    );
  }, [machines, search]);

  const owned = filtered.filter((m: any) => m.purchased_from_us);
  const custom = filtered.filter((m: any) => m.custom_arcade_request_id);
  const serviced = filtered.filter((m: any) => !m.purchased_from_us);

  const totals = useMemo(() => {
    const totalSpend = owned.reduce((s: number, m: any) => s + Number(m.sale_price || 0), 0);
    const underWarranty = filtered.filter(
      (m: any) => m.warranty_expires_on && new Date(m.warranty_expires_on) > new Date()
    ).length;
    const totalOpen = filtered.reduce(
      (s: number, m: any) => s + (ticketStats.get(m.id)?.open || 0),
      0
    );
    return { totalSpend, underWarranty, totalOpen };
  }, [filtered, owned, ticketStats]);

  if (isLoading) {
    return (
      <Card className="p-8 text-center text-muted-foreground">Loading your machines…</Card>
    );
  }

  if (machines.length === 0) {
    return (
      <div className="space-y-4">
        <Header />
        <Card className="p-8 text-center">
          <Cpu className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-60" />
          <h3 className="font-semibold mb-1">No machines on file yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Once VendX delivers, builds, or services a machine for you it will appear here with manuals,
            warranty info and the full service history.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat icon={<Package className="w-3.5 h-3.5" />} label="Total machines" value={filtered.length} />
        <Stat icon={<Sparkles className="w-3.5 h-3.5 text-primary" />} label="Bought from VendX" value={owned.length} accent />
        <Stat icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />} label="Under warranty" value={totals.underWarranty} />
        <Stat icon={<Wrench className="w-3.5 h-3.5 text-amber-400" />} label="Open service tickets" value={totals.totalOpen} accent />
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, serial, model…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
          <TabsTrigger value="owned">Sales / Built ({owned.length})</TabsTrigger>
          <TabsTrigger value="custom">Custom Builds ({custom.length})</TabsTrigger>
          <TabsTrigger value="serviced">Serviced ({serviced.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <Grid items={filtered} stats={ticketStats} onOpen={setActive} />
        </TabsContent>
        <TabsContent value="owned" className="mt-4">
          <Grid items={owned} stats={ticketStats} onOpen={setActive} emptyText="No machines purchased from VendX yet." />
        </TabsContent>
        <TabsContent value="custom" className="mt-4">
          <Grid items={custom} stats={ticketStats} onOpen={setActive} emptyText="No linked custom-arcade builds." />
        </TabsContent>
        <TabsContent value="serviced" className="mt-4">
          <Grid items={serviced} stats={ticketStats} onOpen={setActive} emptyText="No third-party machines on file for service." />
        </TabsContent>
      </Tabs>

      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              {active?.asset_label}
              {active?.custom_request?.request_number && (
                <Badge variant="outline" className="text-[10px] font-mono ml-1">
                  {active.custom_request.request_number}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {active && (
            <div className="space-y-5">
              {/* Specs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <Info label="Type" value={active.machine_type || "—"} />
                <Info label="Make / Model" value={[active.make, active.model].filter(Boolean).join(" ") || "—"} />
                <Info label="Serial" value={active.serial_number || "—"} mono />
                <Info label="Location" value={active.location?.name || "—"} />
                <Info label="Installed" value={active.install_date ? formatDisplayDate(active.install_date, { month: "short", day: "numeric", year: "numeric" }) : "—"} />
                <Info label="Warranty until" value={active.warranty_expires_on ? formatDisplayDate(active.warranty_expires_on, { month: "short", day: "numeric", year: "numeric" }) : "—"} />
                {active.purchased_from_us && (
                  <>
                    <Info label="Sold" value={active.sale_date ? formatDisplayDate(active.sale_date, { month: "short", day: "numeric", year: "numeric" }) : "—"} />
                    <Info label="Price" value={active.sale_price ? `$${Number(active.sale_price).toFixed(2)}` : "—"} />
                  </>
                )}
              </div>

              {/* Documents */}
              {(active.warranty_pdf_url || (Array.isArray(active.manual_urls) && active.manual_urls.length > 0)) && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Manuals & documents
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {active.warranty_pdf_url && (
                      <a
                        href={active.warranty_pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border bg-card hover:bg-muted"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Warranty PDF{" "}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {(active.manual_urls || []).map((m: any, i: number) => (
                      <a
                        key={i}
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border bg-card hover:bg-muted"
                      >
                        <FileText className="w-3.5 h-3.5" /> {m.label || "Manual"}{" "}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Service history */}
              <MachineServiceHistory machineId={active.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Header = () => (
  <div>
    <h1 className="text-2xl font-bold flex items-center gap-2">
      <Cpu className="w-6 h-6 text-primary" /> My Machines
    </h1>
    <p className="text-sm text-muted-foreground max-w-2xl">
      Every machine VendX has on file for you — purchases, custom builds, and units we service. View
      manuals, warranty info, and the full service record on each one.
    </p>
  </div>
);

const Grid = ({ items, stats, onOpen, emptyText }: any) => {
  if (items.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        {emptyText || "Nothing here yet."}
      </Card>
    );
  }
  return (
    <div className="grid gap-2.5 md:grid-cols-2">
      {items.map((m: any) => {
        const s = stats.get(m.id) || { total: 0, open: 0 };
        const isWarranty = m.warranty_expires_on && new Date(m.warranty_expires_on) > new Date();
        const manualCount = Array.isArray(m.manual_urls) ? m.manual_urls.length : 0;
        return (
          <Card
            key={m.id}
            className="p-3.5 hover:border-primary/40 transition-colors cursor-pointer"
            onClick={() => onOpen(m)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <Badge variant={m.status === "active" ? "default" : "outline"} className="text-[10px] capitalize">
                    {m.status}
                  </Badge>
                  {m.purchased_from_us && (
                    <Badge className="text-[10px] bg-primary/20 text-primary border-primary/40">VendX-built</Badge>
                  )}
                  {isWarranty && (
                    <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                      Warranty
                    </Badge>
                  )}
                  {s.open > 0 && (
                    <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/40">
                      {s.open} open
                    </Badge>
                  )}
                  {m.custom_request?.request_number && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {m.custom_request.request_number}
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold truncate">{m.asset_label}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {[m.make, m.model].filter(Boolean).join(" ") || m.machine_type || "—"}
                  {m.location?.name ? ` · ${m.location.name}` : ""}
                </p>
                {m.serial_number && (
                  <p className="text-[11px] text-muted-foreground font-mono truncate">SN: {m.serial_number}</p>
                )}
              </div>
              {m.photo_url && (
                <img src={m.photo_url} alt="" className="w-16 h-16 rounded object-cover border shrink-0" />
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
              <Cell icon={<Wrench className="w-3 h-3" />} label="Services" value={s.total} />
              <Cell icon={<FileText className="w-3 h-3" />} label="Manuals" value={manualCount + (m.warranty_pdf_url ? 1 : 0)} />
              <Cell
                icon={<Calendar className="w-3 h-3" />}
                label="Last service"
                value={s.last ? formatDisplayDate(s.last, { month: "short", day: "numeric" }) : "—"}
              />
            </div>
            <Button size="sm" variant="outline" className="w-full mt-3 gap-1.5">
              <Wrench className="w-3.5 h-3.5" /> View service history & manuals
            </Button>
          </Card>
        );
      })}
    </div>
  );
};

const Stat = ({ icon, label, value, accent }: any) => (
  <Card className={`p-2.5 ${accent ? "border-primary/30" : ""}`}>
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      {icon} {label}
    </div>
    <div className="text-lg font-bold mt-0.5">{value}</div>
  </Card>
);

const Info = ({ label, value, mono }: any) => (
  <div className="p-2 rounded bg-muted/40">
    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    <div className={`text-xs font-medium truncate ${mono ? "font-mono" : ""}`}>{value}</div>
  </div>
);

const Cell = ({ icon, label, value }: any) => (
  <div className="p-1.5 rounded bg-muted/40">
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">{icon} {label}</div>
    <div className="font-semibold text-sm">{value}</div>
  </div>
);

export default MyMachines;
