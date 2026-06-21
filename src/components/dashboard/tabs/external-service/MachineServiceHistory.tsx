import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, FileText, Calendar, DollarSign } from "lucide-react";
import { formatDisplayDate } from "@/lib/dateUtils";

interface Props {
  machineId: string;
}

const MachineServiceHistory = ({ machineId }: Props) => {
  const { data: stats } = useQuery({
    queryKey: ["ext-machine-stats", machineId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_external_machine_service_stats" as any, { p_machine_id: machineId });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as any;
    },
    enabled: !!machineId,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["ext-machine-tickets", machineId],
    queryFn: async () => {
      const { data } = await supabase.from("vendx_external_service_tickets" as any)
        .select("id, ticket_number, subject, status, priority, scheduled_date, resolved_at, resolution, created_at, service_package")
        .eq("machine_id", machineId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!machineId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["ext-machine-invoices", machineId],
    queryFn: async () => {
      const { data } = await supabase.from("vendx_external_service_invoices" as any)
        .select("id, invoice_number, status, total, amount_paid, issue_date, ticket_id, vendx_external_service_tickets!inner(machine_id)")
        .eq("vendx_external_service_tickets.machine_id", machineId)
        .order("issue_date", { ascending: false });
      return data || [];
    },
    enabled: !!machineId,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard icon={<Wrench className="w-3.5 h-3.5" />} label="Total services" value={stats?.total_tickets ?? 0} />
        <StatCard icon={<Calendar className="w-3.5 h-3.5" />} label="Open tickets" value={stats?.open_tickets ?? 0} />
        <StatCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Total invoiced" value={`$${Number(stats?.total_invoiced ?? 0).toFixed(2)}`} />
        <StatCard icon={<FileText className="w-3.5 h-3.5" />} label="Last service" value={stats?.last_service_date ? formatDisplayDate(stats.last_service_date, { month: "short", day: "numeric", year: "numeric" }) : "—"} small />
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Wrench className="w-4 h-4" /> Service tickets</h4>
        {tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No service tickets logged for this machine yet.</p>
        ) : (
          <div className="space-y-1.5">
            {tickets.map((t: any) => (
              <Card key={t.id} className="p-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] text-muted-foreground">{t.ticket_number}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{t.status}</Badge>
                      {t.service_package && <Badge variant="secondary" className="text-[10px]">{t.service_package.replace(/_/g, " ")}</Badge>}
                    </div>
                    <div className="text-sm font-medium truncate">{t.subject}</div>
                    {t.resolution && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">→ {t.resolution}</div>}
                  </div>
                  <div className="text-[11px] text-muted-foreground text-right shrink-0">
                    {formatDisplayDate(t.created_at, { month: "short", day: "numeric" })}
                    {t.resolved_at && <div className="text-emerald-500">✓ {formatDisplayDate(t.resolved_at, { month: "short", day: "numeric" })}</div>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {invoices.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><FileText className="w-4 h-4" /> Invoices</h4>
          <div className="space-y-1.5">
            {invoices.map((i: any) => (
              <Card key={i.id} className="p-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px]">{i.invoice_number}</span>
                    <Badge variant="outline" className="text-[10px]">{i.status}</Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{i.issue_date}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">${Number(i.total).toFixed(2)}</div>
                  {Number(i.amount_paid) > 0 && <div className="text-[10px] text-emerald-500">Paid ${Number(i.amount_paid).toFixed(2)}</div>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, small }: any) => (
  <Card className="p-2.5">
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon} {label}</div>
    <div className={small ? "text-sm font-semibold mt-0.5" : "text-lg font-bold mt-0.5"}>{value}</div>
  </Card>
);

export default MachineServiceHistory;
