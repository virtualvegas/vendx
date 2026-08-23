import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import {
  Mail, Phone, Globe, Linkedin, UserPlus, Share2, Building2,
  MessageSquare, Copy, Check, QrCode, Nfc,
} from "lucide-react";
import { toast } from "sonner";
import { useSEO } from "@/hooks/useSEO";
import { saveContact, hostedVCardUrl, nfcSupported, writeNfcTag } from "@/lib/vcard";

interface CardData {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  bio: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  card_slug: string | null;
  card_accent_color: string | null;
  card_banner_url?: string | null;
  roles: string[];
  company_name?: string | null;
  divisions?: { id: string; name: string; slug: string }[] | null;
}

const BusinessCardPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrMode, setQrMode] = useState<"card" | "contact">("card");
  const [nfcWriting, setNfcWriting] = useState(false);
  const [saving, setSaving] = useState(false);
  const autoSaved = useRef(false);

  useSEO({
    title: card?.full_name
      ? `${card.full_name} — VendX Business Card`
      : "Business Card — VendX",
    description: card?.job_title
      ? `${card.full_name}, ${card.job_title} at VendX. Tap to save contact.`
      : "VendX digital business card.",
  });

  useEffect(() => {
    (async () => {
      if (!slug) return;
      const { data, error } = await supabase.rpc("get_business_card", { _slug: slug });
      if (error) console.error(error);
      setCard((data as unknown as CardData) || null);
      setLoading(false);
    })();
  }, [slug]);

  const shareUrl = `https://vendxglobal.net/card/${card?.card_slug || card?.id || slug}`;
  const contactUrl = hostedVCardUrl(card?.card_slug || card?.id || slug || "");
  const qrValue = qrMode === "card" ? shareUrl : contactUrl;

  const copy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1800);
  };

  const writeTag = async () => {
    setNfcWriting(true);
    try {
      await writeNfcTag(qrValue);
      toast.success("NFC tag written — tap a phone to share");
    } catch {
      toast.error("Could not write the NFC tag");
    } finally {
      setNfcWriting(false);
    }
  };



  const handleSaveContact = async () => {
    if (!card) return;
    setSaving(true);
    try {
      const result = await saveContact(card, card.avatar_url || undefined);
      if (result === "shared") toast.success("Contact ready to add");
      else toast.success("Contact card opened — add it to your contacts");
    } catch {
      toast.error("Couldn't save contact");
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    if (!card) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${card.full_name} — VendX`,
          text: `${card.full_name}${card.job_title ? `, ${card.job_title}` : ""}`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading card…</div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Card not found</h1>
          <p className="text-muted-foreground">
            This business card is private or does not exist.
          </p>
        </div>
      </div>
    );
  }

  const accent = card.card_accent_color || "#3B82F6";
  const initials = (card.full_name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const quickActions = [
    card.phone && { key: "call", icon: Phone, label: "Call", href: `tel:${card.phone}` },
    card.phone && { key: "text", icon: MessageSquare, label: "Text", href: `sms:${card.phone}` },
    card.email && { key: "email", icon: Mail, label: "Email", href: `mailto:${card.email}` },
    card.website_url && { key: "web", icon: Globe, label: "Website", href: card.website_url },
  ].filter(Boolean) as { key: string; icon: typeof Phone; label: string; href: string }[];

  const contactRows = [
    card.email && { key: "email", icon: Mail, text: card.email, href: `mailto:${card.email}`, copyValue: card.email },
    card.phone && { key: "phone", icon: Phone, text: card.phone, href: `tel:${card.phone}`, copyValue: card.phone },
    card.website_url && { key: "web", icon: Globe, text: card.website_url, href: card.website_url, copyValue: card.website_url },
    card.linkedin_url && { key: "li", icon: Linkedin, text: "LinkedIn Profile", href: card.linkedin_url, copyValue: card.linkedin_url },
  ].filter(Boolean) as { key: string; icon: typeof Mail; text: string; href: string; copyValue: string }[];

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background"
      style={{
        backgroundImage: `radial-gradient(circle at 20% 0%, ${accent}22, transparent 40%), radial-gradient(circle at 80% 100%, ${accent}33, transparent 50%)`,
      }}
    >
      <div className="w-full max-w-md animate-fade-in">
        <Card className="overflow-hidden border-2 backdrop-blur-sm bg-card/80 shadow-2xl">
          <div
            className="h-32 relative overflow-hidden"
            style={
              card.card_banner_url
                ? undefined
                : { background: `linear-gradient(135deg, ${accent}, ${accent}88)` }
            }
          >
            {card.card_banner_url ? (
              <img
                src={card.card_banner_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(transparent_98%,rgba(255,255,255,.5)_98%),linear-gradient(90deg,transparent_98%,rgba(255,255,255,.5)_98%)] [background-size:24px_24px]" />
            )}
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute top-3 right-3 h-9 w-9 rounded-full bg-card/80 backdrop-blur"
              onClick={() => setQrOpen(true)}
              aria-label="Show QR code"
            >
              <QrCode className="h-4 w-4" />
            </Button>
          </div>

          <CardContent className="pt-0 pb-6 px-6 -mt-14 relative">
            <div className="flex justify-center mb-4">
              <Avatar className="h-28 w-28 ring-4 ring-card shadow-xl">
                {card.avatar_url && <AvatarImage src={card.avatar_url} alt={card.full_name || ""} />}
                <AvatarFallback
                  className="text-2xl font-bold text-primary-foreground"
                  style={{ background: accent }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="text-center mb-4">
              <h1 className="text-2xl font-bold text-foreground">{card.full_name || "VendX Team"}</h1>
              {card.job_title && (
                <p className="text-muted-foreground mt-1">{card.job_title}</p>
              )}
              <p className="text-sm font-semibold mt-1" style={{ color: accent }}>
                {card.company_name || "VendX Global Corporation"}
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                {card.department && (
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {card.department}
                  </Badge>
                )}
                {(card.divisions || []).map((d) => (
                  <Badge key={d.id} variant="secondary" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {d.name}
                  </Badge>
                ))}
              </div>
            </div>

            {card.bio && (
              <p className="text-sm text-center text-muted-foreground mb-4 px-2">
                {card.bio}
              </p>
            )}

            {quickActions.length > 0 && (
              <div
                className="grid gap-2 mb-4"
                style={{ gridTemplateColumns: `repeat(${quickActions.length}, minmax(0, 1fr))` }}
              >
                {quickActions.map(({ key, icon: Icon, label, href }) => (
                  <a
                    key={key}
                    href={href}
                    target={key === "web" ? "_blank" : undefined}
                    rel={key === "web" ? "noreferrer" : undefined}
                    className="flex flex-col items-center gap-1 py-3 rounded-xl bg-muted/40 hover:bg-muted active:scale-95 transition-all"
                  >
                    <Icon className="h-5 w-5" style={{ color: accent }} />
                    <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                  </a>
                ))}
              </div>
            )}

            <div className="space-y-2 mb-4">
              {contactRows.map(({ key, icon: Icon, text, href, copyValue }) => (
                <div
                  key={key}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted transition-colors"
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: accent }} />
                  <a
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noreferrer" : undefined}
                    className="text-sm truncate flex-1"
                  >
                    {text}
                  </a>
                  <button
                    type="button"
                    onClick={() => copy(key, copyValue)}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Copy ${text}`}
                  >
                    {copiedKey === key ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleSaveContact}
                disabled={saving}
                className="gap-2 text-primary-foreground"
                style={{ background: accent }}
              >
                <UserPlus className="h-4 w-4" />
                {saving ? "Saving…" : "Add Contact"}
              </Button>
              <Button onClick={share} variant="outline" className="gap-2">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Powered by <span className="font-semibold">VendX</span> · Digital Business Cards
        </p>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center text-base">
              {qrMode === "card" ? "Scan to open this card" : "Scan to save contact"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 pb-2">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted w-full">
              {(["card", "contact"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setQrMode(m)}
                  className={`text-xs py-1.5 rounded-md transition-colors ${
                    qrMode === m ? "bg-card shadow font-medium" : "text-muted-foreground"
                  }`}
                >
                  {m === "card" ? "Card link" : "Contact"}
                </button>
              ))}
            </div>
            <div className="p-4 rounded-xl bg-white">
              <QRCodeSVG value={qrValue} size={196} level="M" />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => copy("share", qrValue)}>
                {copiedKey === "share" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy link
              </Button>
              {nfcSupported() && (
                <Button variant="outline" size="sm" className="gap-2" onClick={writeTag} disabled={nfcWriting}>
                  <Nfc className="h-4 w-4" />
                  {nfcWriting ? "Tap a tag…" : "Write NFC tag"}
                </Button>
              )}
            </div>
            <p className="text-[11px] text-center text-muted-foreground">
              {qrMode === "card"
                ? "Opens the full card in any phone camera."
                : "Scanning adds the contact straight to the phone — no file to download."}
            </p>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default BusinessCardPage;
