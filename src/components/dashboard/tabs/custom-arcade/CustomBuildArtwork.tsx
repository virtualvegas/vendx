import { useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const labels: Record<string, string> = { leftSide: "Left side", rightSide: "Right side", front: "Kickplate", controlPanel: "Control deck", marquee: "Marquee", screen: "Screen" };

export default function CustomBuildArtwork({ paths }: { paths?: Record<string, string> | null }) {
  const entries = Object.entries(paths || {}).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  const { data: images = [] } = useQuery({
    queryKey: ["custom-build-artwork", ...entries.map(([, path]) => path)],
    enabled: entries.length > 0,
    queryFn: async () => {
      const results = await Promise.all(entries.map(async ([key, path]) => {
        const { data, error } = await supabase.storage.from("custom-arcade-artwork").createSignedUrl(path, 3600);
        if (error) return null;
        return { key, url: data.signedUrl };
      }));
      return results.filter((item): item is { key: string; url: string } => item !== null);
    },
  });
  if (!entries.length) return null;
  return <div className="space-y-2"><div className="text-xs text-muted-foreground">Customer artwork</div><div className="grid grid-cols-2 md:grid-cols-3 gap-2">{images.map(image => <a key={image.key} href={image.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-md border border-border bg-muted/30"><img src={image.url} alt={labels[image.key] || image.key} className="h-28 w-full object-cover" /><span className="block p-2 text-xs font-medium group-hover:text-primary">{labels[image.key] || image.key}</span></a>)}{images.length === 0 && <div className="col-span-full flex items-center gap-2 p-3 text-xs text-muted-foreground"><ImageIcon className="h-4 w-4" /> Loading protected artwork…</div>}</div></div>;
}
