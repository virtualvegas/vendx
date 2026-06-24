import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image as ImageIcon, Bold, Italic, List, ListOrdered, Link as LinkIcon, Heading2, Heading3, Quote, Code, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ArticleMarkdown from "@/components/news/ArticleMarkdown";
import { estimateReadMinutes, wordCount } from "@/lib/newsHelpers";

interface Props {
  value: string;
  onChange: (next: string) => void;
  minHeight?: number;
}

/**
 * Split-pane Markdown editor with toolbar shortcuts, inline image upload to the
 * `product-images` bucket (prefix `news/`), and live preview using the same
 * renderer the reader sees.
 */
const MarkdownEditor = ({ value, onChange, minHeight = 460 }: Props) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [uploading, setUploading] = useState(false);

  const wrap = (before: string, after = before, placeholder = "") => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  };

  const linePrefix = (prefix: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const before = value.slice(0, start);
    const lineStart = before.lastIndexOf("\n") + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + prefix.length;
    });
  };

  const insertAtCursor = (text: string) => {
    const el = ref.current;
    if (!el) {
      onChange(value + text);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    onChange(value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  };

  const uploadAndInsert = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only images are supported");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `news/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      setUploading(false);
      toast.error("Upload failed");
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    insertAtCursor(`\n\n![${file.name.replace(/\.[^.]+$/, "")}](${data.publicUrl})\n\n`);
    setUploading(false);
    toast.success("Image inserted");
  };

  // Drag-and-drop image into the textarea
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDrop = (e: DragEvent) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      e.preventDefault();
      uploadAndInsert(file);
    };
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      e.preventDefault();
      uploadAndInsert(file);
    };
    el.addEventListener("drop", onDrop);
    el.addEventListener("paste", onPaste);
    el.addEventListener("dragover", (e) => e.preventDefault());
    return () => {
      el.removeEventListener("drop", onDrop);
      el.removeEventListener("paste", onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const words = wordCount(value);
  const minutes = estimateReadMinutes(value);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1">
        <Button type="button" size="sm" variant="ghost" onClick={() => linePrefix("## ")} title="Heading 2">
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => linePrefix("### ")} title="Heading 3">
          <Heading3 className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => wrap("**", "**", "bold")} title="Bold">
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => wrap("_", "_", "italic")} title="Italic">
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => linePrefix("- ")} title="Bullet list">
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => linePrefix("1. ")} title="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => linePrefix("> ")} title="Quote">
          <Quote className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => wrap("`", "`", "code")} title="Inline code">
          <Code className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => wrap("[", "](https://)", "link text")}
          title="Link"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <label className="ml-auto inline-flex items-center gap-1 cursor-pointer text-xs text-muted-foreground hover:text-foreground px-2">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          <span>{uploading ? "Uploading…" : "Upload image"}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAndInsert(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="split">Split</TabsTrigger>
        </TabsList>

        <TabsContent value="write">
          <Textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ minHeight }}
            className="font-mono text-sm leading-relaxed"
            placeholder="Write your article in Markdown… Drag images here or paste from clipboard."
          />
        </TabsContent>

        <TabsContent value="preview">
          <div
            className="rounded-md border bg-card/40 p-6 overflow-y-auto"
            style={{ minHeight, maxHeight: "70vh" }}
          >
            {value.trim() ? (
              <ArticleMarkdown content={value} />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="split">
          <div className="grid md:grid-cols-2 gap-3">
            <Textarea
              ref={ref}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              style={{ minHeight }}
              className="font-mono text-sm leading-relaxed"
              placeholder="Markdown…"
            />
            <div
              className="rounded-md border bg-card/40 p-4 overflow-y-auto"
              style={{ minHeight, maxHeight: "70vh" }}
            >
              {value.trim() ? (
                <ArticleMarkdown content={value} />
              ) : (
                <p className="text-sm text-muted-foreground">Preview appears here.</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {words} words · ~{minutes} min read
        </span>
        <span>Tip: drag, drop, or paste images directly into the editor.</span>
      </div>
    </div>
  );
};

export default MarkdownEditor;
