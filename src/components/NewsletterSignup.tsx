import { useState } from "react";
import { z } from "zod";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  audience: z.enum(["customer", "business"]),
});

interface Props {
  source?: string;
  compact?: boolean;
}

const NewsletterSignup = ({ source = "footer", compact = false }: Props) => {
  const [email, setEmail] = useState("");
  const [audience, setAudience] = useState<"customer" | "business">("customer");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, audience });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("vendx_email_subscribers").insert({
      email: parsed.data.email.toLowerCase(),
      audience: parsed.data.audience,
      source,
    });
    setLoading(false);
    if (error) {
      if (error.code === "23505") {
        toast.success("You're already on the list — thanks!");
        setEmail("");
        return;
      }
      toast.error("Couldn't subscribe. Try again.");
      return;
    }
    toast.success("Subscribed! Watch your inbox for updates & offers.");
    setEmail("");
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-3 ${compact ? "" : "max-w-md"}`}>
      {!compact && (
        <div className="flex items-center gap-2 text-accent">
          <Mail className="w-5 h-5" />
          <h4 className="font-semibold text-lg text-foreground">Stay in the loop</h4>
        </div>
      )}
      {!compact && (
        <p className="text-sm text-muted-foreground">
          News, drops, exclusive offers & business updates — straight to your inbox.
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          required
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-background/60 border-primary/30"
          maxLength={255}
        />
        <Select value={audience} onValueChange={(v) => setAudience(v as "customer" | "business")}>
          <SelectTrigger className="w-full sm:w-36 bg-background/60 border-primary/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="business">Business</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="submit"
          disabled={loading}
          className="bg-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(26,124,255,0.4)]"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Subscribe"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground/70">
        By subscribing you agree to receive emails from VendX. Unsubscribe anytime.
      </p>
    </form>
  );
};

export default NewsletterSignup;
