import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  color: string;
}

/**
 * Email-capture widget that lets readers subscribe to all news, or a
 * specific set of categories. Reuses `vendx_email_subscribers`.
 */
const NewsletterCategorySubscribe = ({ categories }: { categories: Category[] }) => {
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id: string) =>
    setSelected((curr) => (curr.includes(id) ? curr.filter((c) => c !== id) : [...curr, id]));

  const submit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid email");
      return;
    }
    setSubmitting(true);
    try {
      // Upsert subscriber row (audience = "news")
      const { data: existing } = await supabase
        .from("vendx_email_subscribers")
        .select("id")
        .eq("email", trimmed)
        .maybeSingle();

      let subscriberId = existing?.id;
      if (!subscriberId) {
        const { data: inserted, error } = await supabase
          .from("vendx_email_subscribers")
          .insert({ email: trimmed, audience: "news", source: "news_page", consent: true })
          .select("id")
          .single();
        if (error) throw error;
        subscriberId = inserted.id;
      }

      // Wipe prior category prefs and re-insert
      await supabase.from("news_category_subscriptions").delete().eq("subscriber_id", subscriberId);

      const rows =
        selected.length === 0
          ? [{ subscriber_id: subscriberId, category_id: null }]
          : selected.map((cid) => ({ subscriber_id: subscriberId!, category_id: cid }));

      const { error: subErr } = await supabase.from("news_category_subscriptions").insert(rows);
      if (subErr) throw subErr;

      toast.success("Subscribed — you'll hear from us when new stories drop.");
      setEmail("");
      setSelected([]);
    } catch (err) {
      console.error(err);
      toast.error("Could not subscribe — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card/40 to-accent/5">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Get news in your inbox</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Pick the categories you care about, or leave them blank for everything.
        </p>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          disabled={submitting}
        />
        {categories.length > 0 && (
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {categories.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary transition-colors"
              >
                <Checkbox
                  checked={selected.includes(c.id)}
                  onCheckedChange={() => toggle(c.id)}
                  disabled={submitting}
                />
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
              </label>
            ))}
          </div>
        )}
        <Button onClick={submit} disabled={submitting} className="w-full">
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {selected.length === 0 ? "Subscribe to all news" : `Subscribe (${selected.length})`}
        </Button>
      </CardContent>
    </Card>
  );
};

export default NewsletterCategorySubscribe;
