import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mail, Phone, Globe, Linkedin, Download, Share2, QrCode, Building2, X, Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { useSEO } from "@/hooks/useSEO";

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1));

const hasWebNFC = () => typeof window !== "undefined" && "NDEFReader" in window;

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
  roles: string[];
}


function buildVCard(c: CardData): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${c.full_name || ""}`,
    c.job_title ? `TITLE:${c.job_title}` : "",
    `ORG:VendX${c.department ? `;${c.department}` : ""}`,
    c.email ? `EMAIL;TYPE=WORK:${c.email}` : "",
    c.phone ? `TEL;TYPE=WORK,VOICE:${c.phone}` : "",
    c.website_url ? `URL:${c.website_url}` : "",
    c.linkedin_url ? `URL;TYPE=LinkedIn:${c.linkedin_url}` : "",
    c.bio ? `NOTE:${c.bio.replace(/\n/g, " ")}` : "",
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\n");
}

const BusinessCardPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [tapMode, setTapMode] = useState(false);

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

  const downloadVCard = () => {
    if (!card) return;
    const blob = new Blob([buildVCard(card)], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(card.full_name || "contact").replace(/\s+/g, "_")}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
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
      } catch {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    }
  };

  const nfcShare = async () => {
    if (!hasWebNFC()) {
      if (isIOS()) {
        toast.info("iPhone can't write NFC tags from the web. Use the 'NFC Tools' app or an Android device to program a tag with your card URL.");
      } else {
        toast.error("NFC writing isn't supported on this device. Try Chrome on Android.");
      }
      return;
    }
    try {
      // @ts-ignore
      const ndef = new window.NDEFReader();
      await ndef.write({
        records: [{ recordType: "url", data: shareUrl }],
      });
      toast.success("Tap an NFC tag now to write your card");
    } catch (e: any) {
      toast.error(e?.message || "NFC write failed");
    }
  };

  // Universal "tap to share" — uses Web NFC where available,
  // otherwise shows a fullscreen QR that iPhone cameras scan natively.
  const tapToShare = async () => {
    if (hasWebNFC()) {
      try {
        // @ts-ignore
        const ndef = new window.NDEFReader();
        await ndef.scan();
        toast.success("Hold this phone near an NFC tag or another phone…");
        ndef.onreading = (event: any) => {
          for (const record of event.message.records) {
            if (record.recordType === "url" || record.recordType === "absolute-url") {
              const url = new TextDecoder().decode(record.data);
              toast.success("Card detected — opening…");
              window.location.href = url;
              return;
            }
          }
          toast.error("No card URL found on that tag.");
        };
        return;
      } catch {
        // fall through to QR mode
      }
    }
    // iOS / unsupported → fullscreen QR for the other phone's camera
    setTapMode(true);
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

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background"
      style={{
        backgroundImage: `radial-gradient(circle at 20% 0%, ${accent}22, transparent 40%), radial-gradient(circle at 80% 100%, ${accent}33, transparent 50%)`,
      }}
    >
      <div className="w-full max-w-md">
        <Card className="overflow-hidden border-2 backdrop-blur-sm bg-card/80 shadow-2xl">
          <div
            className="h-32 relative"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
            }}
          >
            <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(transparent_98%,rgba(255,255,255,.5)_98%),linear-gradient(90deg,transparent_98%,rgba(255,255,255,.5)_98%)] [background-size:24px_24px]" />
          </div>

          <CardContent className="pt-0 pb-6 px-6 -mt-14 relative">
            <div className="flex justify-center mb-4">
              <Avatar className="h-28 w-28 ring-4 ring-card shadow-xl">
                {card.avatar_url && <AvatarImage src={card.avatar_url} alt={card.full_name || ""} />}
                <AvatarFallback
                  className="text-2xl font-bold text-white"
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
              <div className="flex flex-wrap gap-1.5 justify-center mt-3">
              {card.department && (
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {card.department}
                  </Badge>
                )}
              </div>
            </div>

            {card.bio && (
              <p className="text-sm text-center text-muted-foreground mb-4 px-2">
                {card.bio}
              </p>
            )}

            <div className="space-y-2 mb-4">
              {card.email && (
                <a
                  href={`mailto:${card.email}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted transition-colors"
                >
                  <Mail className="h-4 w-4 shrink-0" style={{ color: accent }} />
                  <span className="text-sm truncate">{card.email}</span>
                </a>
              )}
              {card.phone && (
                <a
                  href={`tel:${card.phone}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted transition-colors"
                >
                  <Phone className="h-4 w-4 shrink-0" style={{ color: accent }} />
                  <span className="text-sm truncate">{card.phone}</span>
                </a>
              )}
              {card.website_url && (
                <a
                  href={card.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted transition-colors"
                >
                  <Globe className="h-4 w-4 shrink-0" style={{ color: accent }} />
                  <span className="text-sm truncate">{card.website_url}</span>
                </a>
              )}
              {card.linkedin_url && (
                <a
                  href={card.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted transition-colors"
                >
                  <Linkedin className="h-4 w-4 shrink-0" style={{ color: accent }} />
                  <span className="text-sm truncate">LinkedIn Profile</span>
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <Button onClick={downloadVCard} className="gap-2" style={{ background: accent }}>
                <Download className="h-4 w-4" />
                Save Contact
              </Button>
              <Button onClick={share} variant="outline" className="gap-2">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <Button onClick={tapToShare} variant="outline" className="gap-2">
                <Smartphone className="h-4 w-4" />
                Tap Phones to Share
              </Button>
              <Button onClick={() => setShowQR((v) => !v)} variant="outline" className="gap-2">
                <QrCode className="h-4 w-4" />
                {showQR ? "Hide QR" : "Show QR"}
              </Button>
            </div>

            {showQR && (
              <div className="mt-4 flex flex-col items-center gap-2 p-4 rounded-lg bg-white">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(shareUrl)}`}
                  alt="QR Code"
                  width={240}
                  height={240}
                />
                <p className="text-xs text-gray-600 break-all text-center">{shareUrl}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Powered by <span className="font-semibold">VendX</span> · Digital Business Cards
        </p>
      </div>

      {tapMode && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black/95 backdrop-blur-sm"
          onClick={() => setTapMode(false)}
        >
          <button
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 text-white"
            onClick={(e) => { e.stopPropagation(); setTapMode(false); }}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <p className="text-white/90 text-center text-lg font-medium mb-2">
            Point the other phone's camera here
          </p>
          <p className="text-white/60 text-center text-sm mb-6 max-w-xs">
            Works on iPhone &amp; Android — no app needed. The camera app will recognize the code and open your card.
          </p>
          <div className="p-5 rounded-2xl bg-white shadow-2xl">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=0&data=${encodeURIComponent(shareUrl)}`}
              alt="Scan to view card"
              width={320}
              height={320}
              className="block"
            />
          </div>
          <p className="text-white/70 text-xs mt-5 break-all text-center max-w-xs">{shareUrl}</p>
          <Button
            variant="secondary"
            className="mt-5 gap-2"
            onClick={(e) => { e.stopPropagation(); share(); }}
          >
            <Share2 className="h-4 w-4" />
            Or send via Share / AirDrop
          </Button>
        </div>
      )}
    </div>
  );
};

export default BusinessCardPage;
