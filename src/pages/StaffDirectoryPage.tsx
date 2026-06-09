import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { Search, IdCard } from "lucide-react";

interface StaffCard {
  id: string;
  full_name: string | null;
  job_title: string | null;
  department: string | null;
  avatar_url: string | null;
  card_slug: string | null;
  card_accent_color: string | null;
  roles: string[] | null;
}

const formatRole = (r: string) =>
  r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const StaffDirectoryPage = () => {
  const [cards, setCards] = useState<StaffCard[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useSEO({
    title: "VendX Team Directory — Digital Business Cards",
    description: "Meet the VendX team. Tap any card to view, save, or share contact info.",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("list_business_cards");
      setCards((data as StaffCard[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = cards.filter((c) => {
    const t = q.toLowerCase();
    return (
      !t ||
      (c.full_name || "").toLowerCase().includes(t) ||
      (c.job_title || "").toLowerCase().includes(t) ||
      (c.department || "").toLowerCase().includes(t) ||
      (c.roles || []).some((r) => r.toLowerCase().includes(t))
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-medium mb-4">
            <IdCard className="w-4 h-4" />
            Team Directory
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Meet the VendX Team
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Tap any card to view contact info, save to your phone, or share via NFC and QR.
          </p>
        </div>

        <div className="max-w-md mx-auto mb-8 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, role, or department…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Loading team…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground">No team members found.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {filtered.map((c) => {
              const accent = c.card_accent_color || "#3B82F6";
              const initials = (c.full_name || "?")
                .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
              return (
                <Link key={c.id} to={`/card/${c.card_slug || c.id}`}>
                  <Card className="overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-border/50 hover:border-primary/50 h-full">
                    <div
                      className="h-20"
                      style={{ background: `linear-gradient(135deg, ${accent}, ${accent}88)` }}
                    />
                    <CardContent className="pt-0 -mt-10">
                      <Avatar className="h-20 w-20 ring-4 ring-card mb-3">
                        {c.avatar_url && <AvatarImage src={c.avatar_url} />}
                        <AvatarFallback className="text-lg font-bold text-white" style={{ background: accent }}>
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="font-semibold text-foreground">{c.full_name || "Team Member"}</h3>
                      {c.job_title && <p className="text-sm text-muted-foreground">{c.job_title}</p>}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(c.roles || []).filter((r) => r !== "customer").slice(0, 2).map((r) => (
                          <Badge key={r} variant="outline" className="text-xs">{formatRole(r)}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default StaffDirectoryPage;
