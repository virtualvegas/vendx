import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Download, Copy, Users, Briefcase } from "lucide-react";
import { toast } from "sonner";

interface Subscriber {
  id: string;
  email: string;
  audience: string;
  source: string | null;
  unsubscribed_at: string | null;
  created_at: string;
}

const EmailSubscribersManager = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "customer" | "business">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["email-subscribers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_email_subscribers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Subscriber[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter(
      (s) =>
        (filter === "all" || s.audience === filter) &&
        (search === "" || s.email.toLowerCase().includes(search.toLowerCase())),
    );
  }, [data, search, filter]);

  const counts = useMemo(() => {
    const active = (data ?? []).filter((s) => !s.unsubscribed_at);
    return {
      total: active.length,
      customer: active.filter((s) => s.audience === "customer").length,
      business: active.filter((s) => s.audience === "business").length,
    };
  }, [data]);

  const copyEmails = () => {
    const emails = filtered.filter((s) => !s.unsubscribed_at).map((s) => s.email).join(", ");
    navigator.clipboard.writeText(emails);
    toast.success(`Copied ${filtered.length} emails`);
  };

  const exportCsv = () => {
    const rows = [
      ["email", "audience", "source", "subscribed_at", "unsubscribed_at"],
      ...filtered.map((s) => [s.email, s.audience, s.source ?? "", s.created_at, s.unsubscribed_at ?? ""]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendx-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <Mail className="w-7 h-7 text-primary" /> Email Subscribers
        </h2>
        <p className="text-muted-foreground">Newsletter and offer signups — export to email your list.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total Active</CardTitle>
            <Mail className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{counts.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Customers</CardTitle>
            <Users className="w-4 h-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{counts.customer}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Business</CardTitle>
            <Briefcase className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{counts.business}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {(["all", "customer", "business"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "All" : f === "customer" ? "Customers" : "Business"}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Search email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full md:w-64"
              />
              <Button size="sm" variant="outline" onClick={copyEmails}>
                <Copy className="w-4 h-4 mr-1" /> Copy
              </Button>
              <Button size="sm" onClick={exportCsv}>
                <Download className="w-4 h-4 mr-1" /> CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No subscribers yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Subscribed</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.email}</TableCell>
                      <TableCell>
                        <Badge variant={s.audience === "business" ? "default" : "secondary"}>
                          {s.audience}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{s.source ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(s.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {s.unsubscribed_at ? (
                          <Badge variant="destructive">Unsubscribed</Badge>
                        ) : (
                          <Badge className="bg-accent/20 text-accent border-accent/40">Active</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailSubscribersManager;
