import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const TechnicalSupport = () => {
  const { data: divisions } = useQuery({
    queryKey: ["support-divisions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("divisions")
        .select("*")
        .eq("status", "active");
      
      if (error) throw error;
      return data;
    },
  });

  const tickets = [
    { id: "TKT-2024-145", issue: "Payment terminal offline", priority: "critical", time: "15 min ago", division: "VendX Max" },
    { id: "TKT-2024-144", issue: "Low inventory alert not working", priority: "high", time: "1 hour ago", division: "VendX Fresh" },
    { id: "TKT-2024-143", issue: "Display screen flickering", priority: "medium", time: "3 hours ago", division: "VendX Digital" },
    { id: "TKT-2024-142", issue: "App sync delay", priority: "low", time: "5 hours ago", division: "VendX Mini" },
  ];

  const criticalTickets = tickets.filter(t => t.priority === "critical");
  const openTickets = tickets.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Technical Support</h2>
        <p className="text-muted-foreground">
          Monitor support tickets, machine issues, and maintenance schedules
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Open Tickets</h3>
          <p className="text-3xl font-bold text-foreground">{openTickets}</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Avg Resolution Time</h3>
          <p className="text-3xl font-bold text-foreground">2.4h</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Critical Issues</h3>
          <p className="text-3xl font-bold text-destructive">{criticalTickets.length}</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Satisfaction Rate</h3>
          <p className="text-3xl font-bold text-primary">94%</p>
        </Card>
      </div>

      {criticalTickets.length > 0 && (
        <Card className="p-6 border-destructive/50">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h3 className="text-lg font-semibold text-foreground">Critical Issues</h3>
          </div>
          <div className="space-y-3">
            {criticalTickets.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <p className="font-medium text-foreground">{ticket.issue}</p>
                  <p className="text-sm text-muted-foreground">{ticket.id} • {ticket.division} • {ticket.time}</p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full font-medium bg-destructive/10 text-destructive">
                  {ticket.priority}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Recent Support Tickets</h3>
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex-1">
                <p className="font-medium text-foreground">{ticket.issue}</p>
                <p className="text-sm text-muted-foreground">{ticket.id} • {ticket.division} • {ticket.time}</p>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                ticket.priority === "critical" ? "bg-destructive/10 text-destructive" :
                ticket.priority === "high" ? "bg-orange-500/10 text-orange-500" :
                ticket.priority === "medium" ? "bg-yellow-500/10 text-yellow-500" :
                "bg-muted text-muted-foreground"
              }`}>
                {ticket.priority}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Maintenance Schedule</h3>
          <div className="space-y-3">
            {[
              { location: "NYC - Main St", type: "Routine", date: "Tomorrow" },
              { location: "LA - Downtown", type: "Emergency", date: "Today" },
              { location: "Chicago - Loop", type: "Routine", date: "Next Week" },
            ].map((maintenance, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-foreground">{maintenance.location}</p>
                  <p className="text-muted-foreground">{maintenance.type}</p>
                </div>
                <span className="text-muted-foreground">{maintenance.date}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Issues by Division</h3>
          <div className="space-y-3">
            {divisions?.map((division) => {
              const issueCount = Math.floor(Math.random() * 15) + 1;
              return (
                <div key={division.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{division.name}</span>
                  <span className="text-muted-foreground">{issueCount} issues</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TechnicalSupport;
