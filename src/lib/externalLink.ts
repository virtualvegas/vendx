/**
 * Helper to reliably open external links from within the Lovable preview iframe
 * (and any other sandboxed iframe). Some browsers block `<a target="_blank">`
 * inside sandboxed iframes unless the click handler explicitly calls window.open.
 *
 * Usage on an <a>:
 *   <a href={url} {...externalLinkProps(url)}>...</a>
 */
export function openExternal(url: string) {
  if (!url) return;
  try {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    // Fallback: if popup was blocked, navigate the top frame instead of the
    // sandboxed iframe so the user still reaches the destination.
    if (!w) {
      if (window.top && window.top !== window.self) {
        (window.top as Window).location.href = url;
      } else {
        window.location.href = url;
      }
    }
  } catch {
    window.location.href = url;
  }
}

export function externalLinkProps(url: string) {
  return {
    target: "_blank" as const,
    rel: "noopener noreferrer",
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Let modified clicks (cmd/ctrl/middle) behave natively.
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e as any).button === 1) return;
      e.preventDefault();
      openExternal(url);
    },
  };
}
