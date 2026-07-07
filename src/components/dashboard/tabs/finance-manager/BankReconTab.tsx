import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

// Naive CSV parse: header row + comma-separated. For rich CSV consider papaparse.
const parseCSV = (text: string) => {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map(l => {
    const cols = l.split(",");
    const row: any = {};
    headers.forEach((h, i) => row[h] = (cols[i] || "").trim());
    return row;
  });
};

export const BankReconTab = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [importName, setImportName] = useState("");

  const imports = useQuery({
    queryKey: ["bank-imports"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_bank_statement_imports" as any).select("*").order("created_at", { ascending: false }).limit(20);
      return (data || []) as any[];
    },
  });

  const [selected, setSelected] = useState<string | null>(null);

  const entries = useQuery({
    queryKey: ["bank-entries", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase.from("finance_bank_statement_entries" as any).select("*").eq("import_id", selected).order("transaction_date", { ascending: false });
      return (data || []) as any[];
    },
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const { data: imp, error } = await supabase.from("finance_bank_statement_imports" as any)
        .insert({ name: importName || file.name, source_file: file.name, total_entries: rows.length, status: "processing" })
        .select().single();
      if (error) throw error;
      const importId = (imp as any).id;
      const entriesToInsert = rows.map(r => ({
        import_id: importId,
        transaction_date: r.date || r.transaction_date || format(new Date(), "yyyy-MM-dd"),
        description: r.description || r.memo || "",
        amount: Number(r.amount || 0),
        reference: r.reference || r.check || null,
        raw_data: r,
      })).filter(e => !isNaN(e.amount));
      if (entriesToInsert.length) {
        await supabase.from("finance_bank_statement_entries" as any).insert(entriesToInsert);
      }
      await supabase.from("finance_bank_statement_imports" as any).update({ status: "imported" }).eq("id", importId);
      toast({ title: `Imported ${entriesToInsert.length} entries` });
      setImportName("");
      qc.invalidateQueries({ queryKey: ["bank-imports"] });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const markMatched = async (id: string) => {
    await supabase.from("finance_bank_statement_entries" as any).update({ status: "matched", matched_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["bank-entries"] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Import Bank Statement (CSV)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Expected columns: <code>date, description, amount, reference</code> (positive = deposit, negative = withdrawal).</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1"><Label>Import Name</Label><Input value={importName} onChange={e => setImportName(e.target.value)} placeholder="e.g. Chase Business — Oct 2026" /></div>
            <div><Label>CSV File</Label><Input type="file" accept=".csv" disabled={uploading} onChange={handleFile} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Imports</CardTitle></CardHeader>
        <CardContent>
          {imports.isLoading ? <Loader2 className="animate-spin" /> :
            !imports.data?.length ? <p className="text-sm text-muted-foreground">No imports yet.</p> :
              <div className="space-y-1">
                {imports.data.map((imp: any) => (
                  <button key={imp.id} onClick={() => setSelected(imp.id)} className={`w-full flex items-center justify-between p-2 rounded text-left text-sm hover:bg-muted ${selected === imp.id ? "bg-muted" : ""}`}>
                    <span>{imp.name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {imp.total_entries} rows · {format(new Date(imp.created_at), "PP")}
                      <Badge variant="outline">{imp.status}</Badge>
                    </span>
                  </button>
                ))}
              </div>}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader><CardTitle>Entries</CardTitle></CardHeader>
          <CardContent>
            {entries.isLoading ? <Loader2 className="animate-spin" /> :
              <table className="w-full text-sm">
                <thead className="border-b"><tr><th className="text-left py-1">Date</th><th className="text-left">Description</th><th className="text-right">Amount</th><th className="text-center">Status</th><th></th></tr></thead>
                <tbody>
                  {(entries.data || []).map((e: any) => (
                    <tr key={e.id} className="border-b border-border/30">
                      <td className="py-1">{format(new Date(e.transaction_date), "PP")}</td>
                      <td className="max-w-[280px] truncate">{e.description}</td>
                      <td className={`text-right ${Number(e.amount) < 0 ? "text-red-500" : "text-green-500"}`}>${Number(e.amount).toLocaleString()}</td>
                      <td className="text-center"><Badge variant={e.status === "matched" ? "default" : "secondary"}>{e.status}</Badge></td>
                      <td>{e.status !== "matched" && <Button size="sm" variant="ghost" onClick={() => markMatched(e.id)}><CheckCircle2 className="h-4 w-4" /></Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
