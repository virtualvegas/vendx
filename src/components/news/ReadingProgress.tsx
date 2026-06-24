import { useEffect, useState } from "react";

/**
 * Slim progress bar pinned to the top of the viewport that fills as the
 * reader scrolls through the article container referenced by `targetRef`.
 */
const ReadingProgress = ({
  targetRef,
}: {
  targetRef: React.RefObject<HTMLElement>;
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = () => {
      const el = targetRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const start = window.scrollY + rect.top - 100;
      const end = start + rect.height - window.innerHeight;
      const current = window.scrollY;
      const pct = ((current - start) / Math.max(1, end - start)) * 100;
      setProgress(Math.min(100, Math.max(0, pct)));
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [targetRef]);

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-transparent">
      <div
        className="h-full bg-gradient-to-r from-primary via-accent to-primary transition-[width] duration-100 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default ReadingProgress;
