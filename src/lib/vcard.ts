export interface VCardInput {
  full_name?: string | null;
  job_title?: string | null;
  department?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website_url?: string | null;
  linkedin_url?: string | null;
  bio?: string | null;
  divisions?: { id: string; name: string; slug: string }[] | null;
  card_slug?: string | null;
  id?: string;
}

const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");

export function buildVCard(c: VCardInput, photoUrl?: string): string {
  const company = c.company_name || "VendX Global Corporation";
  const divNames = (c.divisions || []).map((d) => d.name).join(", ");
  const orgParts = [company];
  if (c.department) orgParts.push(c.department);
  else if (divNames) orgParts.push(divNames);

  const name = (c.full_name || "").trim();
  const parts = name.split(/\s+/);
  const last = parts.length > 1 ? parts.pop()! : "";
  const first = parts.join(" ");

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(name)}`,
    c.job_title ? `TITLE:${esc(c.job_title)}` : "",
    `ORG:${orgParts.map(esc).join(";")}`,
    divNames ? `CATEGORIES:${esc(divNames)}` : "",
    c.email ? `EMAIL;TYPE=INTERNET,WORK:${c.email}` : "",
    c.phone ? `TEL;TYPE=WORK,VOICE:${c.phone}` : "",
    c.website_url ? `URL:${c.website_url}` : "",
    c.linkedin_url ? `X-SOCIALPROFILE;TYPE=linkedin:${c.linkedin_url}` : "",
    photoUrl ? `PHOTO;VALUE=URI:${photoUrl}` : "",
    c.bio ? `NOTE:${esc(c.bio)}` : "",
    `REV:${new Date().toISOString()}`,
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export function vcardFileName(c: VCardInput) {
  return `${(c.full_name || "contact").replace(/\s+/g, "_")}.vcf`;
}

/**
 * Public, always-fresh vCard URL served by the backend with `Content-Disposition: inline`.
 * Opening it on a phone shows the native "Add to Contacts" sheet — no file download.
 */
export function hostedVCardUrl(slugOrId: string) {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/business-card-vcard?slug=${encodeURIComponent(slugOrId)}`;
}

const isMobile = () =>
  typeof navigator !== "undefined" && /iphone|ipad|ipod|android/i.test(navigator.userAgent);

/**
 * Saves a contact with the smoothest path available:
 * 1. Mobile → open the hosted vCard URL, which the OS renders as a contact card
 * 2. Native share sheet with the vCard file (Android → "Add to Contacts")
 * 3. Classic download fallback (desktop)
 */
export async function saveContact(
  c: VCardInput,
  photoUrl?: string,
): Promise<"opened" | "shared" | "downloaded"> {
  const slugOrId = c.card_slug || c.id;

  if (slugOrId && isMobile()) {
    window.location.href = hostedVCardUrl(slugOrId);
    return "opened";
  }

  const vcf = buildVCard(c, photoUrl);
  const fileName = vcardFileName(c);
  const file =
    typeof File !== "undefined" ? new File([vcf], fileName, { type: "text/vcard" }) : null;

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (file && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: c.full_name || "Contact" });
      return "shared";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "shared";
    }
  }

  const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "downloaded";
}

/** Web NFC (Android Chrome): write the card link to a blank NFC tag for tap-to-share. */
export function nfcSupported() {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

export async function writeNfcTag(url: string) {
  const Reader = (window as any).NDEFReader;
  if (!Reader) throw new Error("NFC not supported on this device");
  const reader = new Reader();
  await reader.write({ records: [{ recordType: "url", data: url }] });
}

