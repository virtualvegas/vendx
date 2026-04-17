import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReceiptUploadProps {
  value?: string | null;
  filename?: string | null;
  onChange: (url: string | null, filename: string | null) => void;
  folder?: string;
}

export const ReceiptUpload = ({ value, filename, onChange, folder = "expenses" }: ReceiptUploadProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("finance-receipts").upload(path, file);
      if (error) throw error;
      onChange(path, file.name);
      toast({ title: "Receipt uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const viewReceipt = async () => {
    if (!value) return;
    const { data, error } = await supabase.storage
      .from("finance-receipts")
      .createSignedUrl(value, 60 * 10);
    if (error) {
      toast({ title: "Cannot open receipt", description: error.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-2">
      <Label>Receipt</Label>
      {value ? (
        <div className="flex items-center gap-2 p-2 border rounded-md">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <button type="button" onClick={viewReceipt} className="text-sm text-primary hover:underline truncate flex-1 text-left">
            {filename || "View receipt"}
          </button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null, null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span className="text-sm text-muted-foreground">
            {uploading ? "Uploading..." : "Upload receipt (image or PDF, max 10MB)"}
          </span>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      )}
    </div>
  );
};
