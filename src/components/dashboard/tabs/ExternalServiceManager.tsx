import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Wrench, Users, MapPin, Package, FileText, ClipboardList, DollarSign, AlertCircle, CalendarClock } from "lucide-react";
import ExtClientsPanel from "./external-service/ExtClientsPanel";
import ExtLocationsPanel from "./external-service/ExtLocationsPanel";
import ExtMachinesPanel from "./external-service/ExtMachinesPanel";
import ExtTicketsPanel from "./external-service/ExtTicketsPanel";
import ExtInvoicesPanel from "./external-service/ExtInvoicesPanel";
import ExtPackagesPanel from "./external-service/ExtPackagesPanel";
import ExtSoldMachinesPanel from "./external-service/ExtSoldMachinesPanel";
import ExtSchedulesPanel from "./external-service/ExtSchedulesPanel";

const ExternalServiceManager = () => {
  const [tab, setTab] = useState("tickets");

  const { data: stats } = useQuery({
    queryKey: ["ext-service-overview-stats"],
    queryFn: async () => {
      const [tk, mk, inv, sold] = await Promise.all([
        supabase.from("vendx_external_service_tickets" as any).select("status", { count: "exact" }),
        supabase.from("vendx_external_machines" as any).select("id", { count: "exact", head: true }),
        supabase.from("vendx_external_service_invoices" as any).select("total, amount_paid, status"),
        supabase.from("vendx_external_machines" as any).select("id", { count: "exact", head: true }).eq("purchased_from_us", true),
      ]);
      const tickets = (tk.data as any[]) || [];
      const open = tickets.filter(t => !["completed","invoiced","cancelled"].includes(t.status)).length;
      const invoices = (inv.data as any[]) || [];
      const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
      const totalPaid = invoices.reduce((s, i) => s + Number(i.amount_paid || 0), 0);
      return {
        totalTickets: tk.count || 0,
        openTickets: open,
        machines: mk.count || 0,
        soldByUs: sold.count || 0,
        invoiced: totalInvoiced,
        paid: totalPaid,
        outstanding: totalInvoiced - totalPaid,
      };
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wrench className="w-6 h-6 text-primary" /> External Service Management</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Servicing client-owned machines &amp; the units VendX sold or built. Track clients, machines, manuals, service history, and invoiced labor/parts in one place.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <StatCard icon={<ClipboardList className="w-3.5 h-3.5" />} label="Total tickets" value={stats?.totalTickets ?? "—"} />
        <StatCard icon={<AlertCircle className="w-3.5 h-3.5 text-amber-400" />} label="Open" value={stats?.openTickets ?? "—"} accent />
        <StatCard icon={<Package className="w-3.5 h-3.5" />} label="Machines tracked" value={stats?.machines ?? "—"} />
        <StatCard icon={<Package className="w-3.5 h-3.5 text-primary" />} label="VendX-built" value={stats?.soldByUs ?? "—"} accent />
        <StatCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Invoiced" value={`$${(stats?.invoiced ?? 0).toFixed(0)}`} />
        <StatCard icon={<DollarSign className="w-3.5 h-3.5 text-amber-400" />} label="Outstanding" value={`$${(stats?.outstanding ?? 0).toFixed(0)}`} accent />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto">
          <TabsList className="bg-muted/40 p-1">
            <TabsTrigger value="tickets" className="gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Tickets</TabsTrigger>
            <TabsTrigger value="sold" className="gap-1.5"><Package className="w-3.5 h-3.5" /> Sold / Built</TabsTrigger>
            <TabsTrigger value="machines" className="gap-1.5"><Wrench className="w-3.5 h-3.5" /> All Machines</TabsTrigger>
            <TabsTrigger value="clients" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Clients</TabsTrigger>
            <TabsTrigger value="locations" className="gap-1.5"><MapPin className="w-3.5 h-3.5" /> Sites</TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Invoices</TabsTrigger>
            <TabsTrigger value="packages" className="gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Packages</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="tickets" className="mt-4"><ExtTicketsPanel /></TabsContent>
        <TabsContent value="sold" className="mt-4"><ExtSoldMachinesPanel /></TabsContent>
        <TabsContent value="machines" className="mt-4"><ExtMachinesPanel /></TabsContent>
        <TabsContent value="clients" className="mt-4"><ExtClientsPanel /></TabsContent>
        <TabsContent value="locations" className="mt-4"><ExtLocationsPanel /></TabsContent>
        <TabsContent value="invoices" className="mt-4"><ExtInvoicesPanel /></TabsContent>
        <TabsContent value="packages" className="mt-4"><ExtPackagesPanel /></TabsContent>
      </Tabs>
    </div>
  );
};

const StatCard = ({ icon, label, value, accent }: any) => (
  <Card className={`p-2.5 ${accent ? "border-primary/30" : ""}`}>
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon} {label}</div>
    <div className="text-lg font-bold mt-0.5">{value}</div>
  </Card>
);

export default ExternalServiceManager;
