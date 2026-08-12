interface CabinetPreviewProps {
  style: string;
  size: string;
  monitor: string;
  controls: string;
  trackball: boolean;
  spinner: boolean;
  lightGun: boolean;
  theme?: string;
}

const sizeScale: Record<string, number> = { full: 1, mid: 0.85, mini: 0.68 };

const CabinetPreview = ({
  style, size, monitor, controls, trackball, spinner, lightGun, theme,
}: CabinetPreviewProps) => {
  const s = sizeScale[size] ?? 1;
  const screenW = 60 + (Number(monitor) - 19) * 1.6;
  const players = controls === "4p" ? 4 : controls === "2p" ? 2 : 1;

  return (
    <div className="relative w-full aspect-[3/4] flex items-center justify-center overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-b from-secondary/60 to-background">
      {/* floor glow */}
      <div className="absolute bottom-8 h-24 w-3/4 rounded-[100%] bg-primary/20 blur-2xl" />

      <svg
        viewBox="0 0 200 260"
        className="relative z-10 h-[86%] drop-shadow-[0_0_25px_hsl(var(--primary)/0.35)] transition-all duration-500"
        style={{ transform: `scale(${s})` }}
      >
        <defs>
          <linearGradient id="cab" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--secondary))" />
            <stop offset="100%" stopColor="hsl(var(--card))" />
          </linearGradient>
          <linearGradient id="scr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.9)" />
            <stop offset="100%" stopColor="hsl(var(--accent) / 0.7)" />
          </linearGradient>
        </defs>

        {style === "cocktail" ? (
          <g>
            <rect x="30" y="90" width="140" height="80" rx="8" fill="url(#cab)" stroke="hsl(var(--primary) / 0.6)" strokeWidth="2" />
            <rect x={100 - screenW / 2} y="105" width={screenW} height="50" rx="4" fill="url(#scr)" opacity="0.85" />
            <rect x="34" y="170" width="14" height="60" fill="hsl(var(--secondary))" />
            <rect x="152" y="170" width="14" height="60" fill="hsl(var(--secondary))" />
          </g>
        ) : style === "bartop" ? (
          <g>
            <rect x="40" y="80" width="120" height="120" rx="10" fill="url(#cab)" stroke="hsl(var(--primary) / 0.6)" strokeWidth="2" />
            <rect x={100 - screenW / 2} y="95" width={screenW} height={60} rx="4" fill="url(#scr)" opacity="0.9" />
            <rect x="46" y="165" width="108" height="28" rx="6" fill="hsl(var(--muted))" />
          </g>
        ) : (
          <g>
            {/* marquee */}
            <rect x="46" y="18" width="108" height="24" rx="4" fill="hsl(var(--accent) / 0.25)" stroke="hsl(var(--accent) / 0.7)" strokeWidth="1.5" />
            {/* body */}
            <path
              d={style === "pedestal"
                ? "M62 42 H138 V150 H150 V240 H50 V150 H62 Z"
                : style === "sit_down"
                ? "M46 42 H154 V150 H180 V240 H46 Z"
                : "M46 42 H154 V240 H46 Z"}
              fill="url(#cab)"
              stroke="hsl(var(--primary) / 0.6)"
              strokeWidth="2"
            />
            {/* screen */}
            <rect x={100 - screenW / 2} y="56" width={screenW} height={screenW * 0.72} rx="4" fill="url(#scr)" opacity="0.9" />
            {/* control deck */}
            <rect x="46" y="150" width="108" height="26" rx="4" fill="hsl(var(--muted))" />
          </g>
        )}

        {/* controls */}
        <g>
          {Array.from({ length: players }).map((_, i) => {
            const cx = 100 + (i - (players - 1) / 2) * (players > 2 ? 24 : 34);
            const cy = style === "cocktail" ? 178 : style === "bartop" ? 179 : 163;
            return (
              <g key={i}>
                <circle cx={cx - 8} cy={cy} r="4" fill="hsl(var(--accent))" />
                <circle cx={cx + 5} cy={cy - 3} r="2.5" fill="hsl(var(--primary))" />
                <circle cx={cx + 12} cy={cy} r="2.5" fill="hsl(var(--destructive))" />
              </g>
            );
          })}
          {trackball && <circle cx="100" cy={style === "upright" ? 145 : 195} r="6" fill="hsl(var(--foreground) / 0.5)" />}
          {spinner && <circle cx="128" cy={style === "upright" ? 145 : 195} r="5" fill="none" stroke="hsl(var(--accent))" strokeWidth="2" />}
          {lightGun && <rect x="60" y={style === "upright" ? 140 : 190} width="16" height="6" rx="2" fill="hsl(var(--warning))" />}
        </g>
      </svg>

      <div className="absolute bottom-3 left-0 right-0 px-3 text-center">
        <p className="truncate text-xs text-muted-foreground">
          {theme?.trim() ? theme : "Custom artwork"} · {monitor}" · {controls.toUpperCase()}
        </p>
      </div>
    </div>
  );
};

export default CabinetPreview;
