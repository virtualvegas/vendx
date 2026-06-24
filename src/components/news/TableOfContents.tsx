import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ListTree } from "lucide-react";
import type { Heading } from "@/lib/newsHelpers";

/**
 * Sticky in-article navigation built from `##`/`###` headings.
 * Tracks the active section via IntersectionObserver and scrolls smoothly on click.
 */
const TableOfContents = ({ headings }: { headings: Heading[] }) => {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!headings.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-110px 0px -65% 0px", threshold: 0 }
    );
    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (!headings.length) return null;

  return (
    <nav className="sticky top-24 hidden lg:block max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        <ListTree className="h-3.5 w-3.5" /> On this page
      </div>
      <ul className="space-y-1 border-l border-border">
        {headings.map((h) => {
          const isActive = active === h.id;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(h.id);
                  if (el) {
                    window.scrollTo({
                      top: el.getBoundingClientRect().top + window.scrollY - 96,
                      behavior: "smooth",
                    });
                    history.replaceState(null, "", `#${h.id}`);
                  }
                }}
                className={cn(
                  "block py-1 -ml-px border-l-2 text-sm transition-colors",
                  h.level === 3 ? "pl-6" : "pl-4",
                  isActive
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default TableOfContents;
