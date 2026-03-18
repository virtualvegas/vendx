import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { FileText, RefreshCw, Shield, Clock, User, Search } from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  user_email: string | null;
  user_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

const actionColors: Record<string, string> = {
  create: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  update: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  delete: "bg-destructive/10 text-destructive border-destructive/20",
  assign: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  remove: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

const getActionColor = (action: string) => {
  const key = Object.keys(actionColors).find(k => action.toLowerCase().includes(k));
  return key ? actionColors[key] : "bg-muted text-muted-foreground border-border";
};

const AuditLogsViewer = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    fetchLogs();
  }, [page, entityFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (entityFilter) {
        query = query.eq("entity_type", entityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data as AuditLog[]) || []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log =>
    !searchQuery ||
    log.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const uniqueEntityTypes = [...new Set(logs.map(l => l.entity_type))];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Audit Logs</h2>
        <p className="text-muted-foreground">
          Track all important changes across the system — who did what and when.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" /> Total Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{logs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4" /> Unique Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {new Set(logs.map(l => l.user_email)).size}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4" /> Entity Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{uniqueEntityTypes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" /> Latest
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {logs[0] ? format(new Date(logs[0].created_at), "MMM d, h:mm a") : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Search className="w-5 h-5" /> Filter Logs</span>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Search</Label>
              <Input
                placeholder="Search by user, action, details..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div>
              <Label>Entity Type</Label>
              <SearchableSelect
                options={[
                  { value: "", label: "All Types" },
                  ...uniqueEntityTypes.map(t => ({ value: t, label: t })),
                ]}
                value={entityFilter}
                onValueChange={setEntityFilter}
                placeholder="All Types"
                searchPlaceholder="Filter entity type..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Page {page + 1} — showing up to {pageSize} entries</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No audit logs found</p>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {filteredLogs.map(log => (
                  <div key={log.id} className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                        <Badge variant="secondary">{log.entity_type}</Badge>
                        {log.entity_id && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {log.entity_id.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), "MMM d, yyyy h:mm:ss a")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium">{log.user_email || "System"}</span>
                      {log.user_role && (
                        <Badge variant="outline" className="text-xs">
                          {log.user_role}
                        </Badge>
                      )}
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="bg-muted/50 rounded p-2 text-xs font-mono text-muted-foreground overflow-x-auto">
                        {Object.entries(log.details).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-foreground/70">{key}:</span>{" "}
                            {typeof value === "object" ? JSON.stringify(value) : String(value)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          <div className="flex items-center justify-between mt-4">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={filteredLogs.length < pageSize}>
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogsViewer;
