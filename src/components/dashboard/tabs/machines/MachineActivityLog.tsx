import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Gamepad2, ShoppingCart, CreditCard, AlertCircle, Power } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityLog {
  id: string;
  machine_id: string;
  activity_type: string;
  user_id: string | null;
  amount: number;
  credits_used: number;
  item_name: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

interface Machine {
  id: string;
  name: string;
  machine_code: string;
}

interface MachineActivityLogProps {
  machineId?: string;
  machines?: Machine[];
  limit?: number;
}

const ACTIVITY_TYPES = [
  { value: "all", label: "All Activity" },
  { value: "play", label: "Plays" },
  { value: "vend", label: "Vends" },
  { value: "payment", label: "Payments" },
  { value: "status_change", label: "Status Changes" },
  { value: "error", label: "Errors" },
];

const getActivityIcon = (type: string) => {
  switch (type) {
    case "play":
      return <Gamepad2 className="w-4 h-4 text-purple-500" />;
    case "vend":
      return <ShoppingCart className="w-4 h-4 text-green-500" />;
    case "payment":
      return <CreditCard className="w-4 h-4 text-blue-500" />;
    case "status_change":
      return <Power className="w-4 h-4 text-yellow-500" />;
    case "error":
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
};

const getActivityBadge = (type: string) => {
  switch (type) {
    case "play":
      return <Badge variant="secondary" className="bg-purple-500/10 text-purple-500">Play</Badge>;
    case "vend":
      return <Badge variant="secondary" className="bg-green-500/10 text-green-500">Vend</Badge>;
    case "payment":
      return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">Payment</Badge>;
    case "status_change":
      return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500">Status</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
};

export const MachineActivityLog = ({ 
  machineId, 
  machines = [],
  limit = 50 
}: MachineActivityLogProps) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterMachine, setFilterMachine] = useState(machineId || "all");

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from("machine_activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (filterMachine && filterMachine !== "all") {
      query = query.eq("machine_id", filterMachine);
    }

    if (filterType !== "all") {
      query = query.eq("activity_type", filterType);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching activity logs:", error);
    } else {
      setLogs((data || []).map(log => ({
        ...log,
        metadata: (log.metadata as Record<string, any>) || {},
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("machine_activity_log")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "machine_activity_log",
        },
        (payload) => {
          const newLog = payload.new as ActivityLog;
          // Only add if it matches current filters
          if (
            (filterMachine === "all" || newLog.machine_id === filterMachine) &&
            (filterType === "all" || newLog.activity_type === filterType)
          ) {
            setLogs(prev => [{
              ...newLog,
              metadata: (newLog.metadata as Record<string, any>) || {},
            }, ...prev.slice(0, limit - 1)]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterType, filterMachine, limit]);

  const getMachineName = (machineId: string) => {
    const machine = machines.find(m => m.id === machineId);
    return machine?.name || machine?.machine_code || "Unknown";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Activity Log
          </CardTitle>
          <div className="flex gap-2">
            {machines.length > 0 && !machineId && (
              <Select value={filterMachine} onValueChange={setFilterMachine}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Machines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Machines</SelectItem>
                  {machines.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Activity Type" />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading activity...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No activity recorded yet</div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {logs.map(log => (
                <div 
                  key={log.id} 
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="mt-0.5">
                    {getActivityIcon(log.activity_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getActivityBadge(log.activity_type)}
                      {machines.length > 0 && !machineId && (
                        <Badge variant="outline" className="text-xs">
                          {getMachineName(log.machine_id)}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-sm">
                      {log.item_name && (
                        <span className="font-medium">{log.item_name}</span>
                      )}
                      {log.amount > 0 && (
                        <span className="text-green-500 ml-2">+${log.amount.toFixed(2)}</span>
                      )}
                      {log.credits_used > 0 && (
                        <span className="text-muted-foreground ml-2">
                          ({log.credits_used} credits)
                        </span>
                      )}
                    </div>
                    {log.metadata?.message && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {log.metadata.message}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
