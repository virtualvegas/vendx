import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type ArtworkSurface = "leftSide" | "rightSide" | "front" | "controlPanel" | "marquee" | "screen";
export type ArtworkPreviews = Partial<Record<ArtworkSurface, string>>;
export type ArtworkPaths = Partial<Record<ArtworkSurface, string>>;

const surfaces: { key: ArtworkSurface; label: string; detail: string }[] = [
  { key: "leftSide", label: "Left side", detail: "Full-height side art" },
  { key: "rightSide", label: "Right side", detail: "Full-height side art" },
  { key: "front", label: "Kickplate", detail: "Lower front panel" },
  { key: "controlPanel", label: "Control deck", detail: "Player controls overlay" },
  { key: "marquee", label: "Marquee", detail: "Top illuminated sign" },
  { key: "screen", label: "Screen graphic", detail: "Preview or bezel art" },
];

interface Props {
  previews: ArtworkPreviews;
  paths: ArtworkPaths;
  onChange: (previews: ArtworkPreviews, paths: ArtworkPaths) => void;
}

export default function ArcadeArtworkUploader({ previews, paths, onChange }: Props) {
  const [uploading, setUploading] = useState<ArtworkSurface | null>(null);
  const requestFolder = useRef(crypto.randomUUID());

  const upload = async (surface: ArtworkSurface, file?: File) => {
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) return toast.error("Use a PNG, JPG, or WebP image");
    if (file.size > 8 * 1024 * 1024) return toast.error("Artwork must be 8 MB or smaller");
    setUploading(surface);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `requests/${requestFolder.current}/${surface}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("custom-arcade-artwork").upload(path, file, { contentType: file.type });
    setUploading(null);
    if (error) return toast.error(error.message);
    const old = previews[surface];
    if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
    onChange({ ...previews, [surface]: URL.createObjectURL(file) }, { ...paths, [surface]: path });
    toast.success(`${surfaces.find(item => item.key === surface)?.label} artwork added`);
  };

  const remove = (surface: ArtworkSurface) => {
    const old = previews[surface];
    if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
    const nextPreviews = { ...previews };
    const nextPaths = { ...paths };
    delete nextPreviews[surface];
    delete nextPaths[surface];
    onChange(nextPreviews, nextPaths);
  };

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {surfaces.map(({ key, label, detail }) => (
        <div key={key} className="relative min-h-32 overflow-hidden rounded-lg border border-border bg-muted/30">
          {previews[key] ? (
            <img src={previews[key]} alt={`${label} artwork preview`} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"><ImagePlus className="h-8 w-8 text-muted-foreground/50" /></div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-background/90 p-3 backdrop-blur-sm">
            <div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-muted-foreground">{detail}</p></div>
            <div className="flex gap-1">
              {previews[key] && <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${label}`} onClick={() => remove(key)}><Trash2 className="h-4 w-4" /></Button>}
              <Button type="button" size="sm" variant="outline" disabled={uploading === key} asChild>
                <label className="cursor-pointer">
                  {uploading === key ? <Loader2 className="h-4 w-4 animate-spin" /> : previews[key] ? "Replace" : "Upload"}
                  <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => upload(key, event.target.files?.[0])} />
                </label>
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
