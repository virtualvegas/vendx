/**
 * Helpers shared by the news/articles reader and admin surface.
 */

export interface Heading {
  id: string;
  text: string;
  level: number;
}

/**
 * Extract `##`/`###` headings from Markdown to build a table of contents.
 * Slug ids are generated to match `rehype`-style auto-ids on the rendered DOM.
 */
export function extractHeadings(markdown: string): Heading[] {
  if (!markdown) return [];
  const lines = markdown.split("\n");
  const out: Heading[] = [];
  const seen = new Map<string, number>();
  let inFence = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].replace(/`/g, "").replace(/\[(.+?)\]\(.+?\)/g, "$1");
    const base = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count}`;
    out.push({ id, text, level });
  }
  return out;
}

/**
 * Generate a slug for an arbitrary string. Used for headings and article slugs.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function wordCount(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function estimateReadMinutes(text: string): number {
  return Math.max(1, Math.ceil(wordCount(text) / 200));
}

/**
 * Anonymous device hash used to dedupe likes from non-signed-in visitors.
 * Stored locally; not a security control — only a sane UX fingerprint.
 */
export function getAnonHash(): string {
  const key = "vendx_anon_id";
  let value = typeof window !== "undefined" ? localStorage.getItem(key) : null;
  if (!value) {
    value = `anon_${crypto.randomUUID().replace(/-/g, "")}`;
    if (typeof window !== "undefined") localStorage.setItem(key, value);
  }
  return value;
}
