import { useMemo, useRef, useState } from "react";
import { Image, Maximize2, Monitor, Palette, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ArtworkPreviews } from "./ArcadeArtworkUploader";

export interface CabinetCustomization {
  bodyColor: string; trimColor: string; buttonColor: string; joystickColor: string;
  finish: string; monitorOrientation: string; screenTreatment: string; marqueeType: string;
  speakerLayout: string; feet: string; coinDoor: boolean; accessibleControls: boolean;
  joystickStyle: string; buttonLayout: string; steeringWheel: boolean; pedals: boolean;
  flightStick: boolean; dancePads: boolean; pinballButtons: boolean; usbPorts: boolean;
  computerTier: string; storage: string; connectivity: string; bluetooth: boolean;
  lighting: string; cooling: string; audio: string;
}

interface Props {
  style: string; size: string; monitor: string; controls: string;
  trackball: boolean; spinner: boolean; lightGun: boolean; theme?: string;
  customization?: Partial<CabinetCustomization>; artwork?: ArtworkPreviews;
  compact?: boolean;
}

type View = "front" | "leftSide" | "rightSide";

const STYLE_LABELS: Record<string, string> = {
  upright: "Upright", deluxe_upright: "Deluxe Upright", bartop: "Bartop",
  cocktail: "Cocktail", pedestal: "Pedestal", wall_mount: "Wall Mount",
  four_player: "4-Player", racing: "Racing Cockpit", sit_down: "Japanese Sit-Down",
  virtual_pinball: "Virtual Pinball",
};

const SIZE_SCALE: Record<string, number> = { full: 1, mid: 0.92, mini: 0.84 };

function UploadedArt({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  if (!src) return null;
  return <img src={src} alt={alt} className={cn("h-full w-full object-cover", className)} />;
}

function DefaultScreen({ accent, theme }: { accent: string; theme?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-background px-2 text-center">
      <div className="mb-2 h-px w-3/4 opacity-70" style={{ backgroundColor: accent }} />
      <span className="text-[10px] font-bold uppercase text-foreground sm:text-xs">VendX Arcade</span>
      <span className="mt-1 max-w-full truncate text-[7px] uppercase text-muted-foreground sm:text-[9px]">{theme || "System ready"}</span>
      <div className="mt-2 h-px w-1/2 opacity-40" style={{ backgroundColor: accent }} />
    </div>
  );
}

function Controls({ props, width = "78%" }: { props: Props; width?: string }) {
  const players = props.controls === "4p" ? 4 : props.controls === "1p" ? 1 : 2;
  const buttonCount = props.customization?.buttonLayout === "four" ? 4 : props.customization?.buttonLayout === "eight" ? 8 : 6;
  const buttonColor = props.customization?.buttonColor || "#39e58c";
  const joystickColor = props.customization?.joystickColor || buttonColor;

  return (
    <div className="absolute left-1/2 top-[62%] flex h-[10%] -translate-x-1/2 items-center justify-around rounded-sm border border-border/60 bg-background/80 px-1 shadow-md" style={{ width }}>
      {Array.from({ length: players }).map((_, player) => (
        <div key={player} className="flex min-w-0 items-center gap-1">
          <div className="relative h-5 w-3 shrink-0">
            <div className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full border border-border bg-muted" />
            <div className="absolute bottom-1.5 left-1/2 h-3 w-px -translate-x-1/2 bg-muted-foreground" />
            <div className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full" style={{ backgroundColor: joystickColor }} />
          </div>
          <div className="grid grid-cols-3 gap-0.5">
            {Array.from({ length: Math.min(buttonCount, 6) }).map((__, index) => (
              <span key={index} className="h-1.5 w-1.5 rounded-full border border-background/30" style={{ backgroundColor: buttonColor }} />
            ))}
          </div>
        </div>
      ))}
      {props.trackball && <span className="h-3 w-3 rounded-full border border-border bg-muted-foreground" title="Trackball" />}
      {props.spinner && <span className="h-3 w-2 rounded-sm border border-border bg-muted" title="Spinner" />}
    </div>
  );
}

function FrontCabinet({ props }: { props: Props }) {
  const custom = props.customization || {};
  const body = custom.bodyColor || "#172033";
  const trim = custom.trimColor || "#12bde8";
  const wide = props.style === "four_player" || props.controls === "4p";
  const short = props.style === "bartop" || props.style === "wall_mount";
  const isPinball = props.style === "virtual_pinball";
  const isRacing = props.style === "racing";
  const screenPortrait = custom.monitorOrientation === "portrait";
  const scale = SIZE_SCALE[props.size] || 1;
  const shape = props.style === "bartop"
    ? "polygon(10% 0,90% 0,96% 28%,87% 100%,13% 100%,4% 28%)"
    : props.style === "pedestal"
      ? "polygon(12% 0,88% 0,96% 22%,73% 34%,68% 100%,32% 100%,27% 34%,4% 22%)"
      : props.style === "wall_mount"
        ? "polygon(8% 0,92% 0,98% 24%,88% 100%,12% 100%,2% 24%)"
        : "polygon(8% 0,92% 0,98% 14%,90% 100%,10% 100%,2% 14%)";

  if (isPinball) {
    return (
      <div className="relative h-[86%] w-[72%]" style={{ transform: `scale(${scale})`, transformOrigin: "bottom center" }}>
        <div className="absolute left-[19%] top-0 h-[30%] w-[62%] rounded-sm border-4 shadow-xl" style={{ backgroundColor: body, borderColor: trim }}>
          <div className="absolute inset-[9%] overflow-hidden rounded-sm border border-border bg-background"><UploadedArt src={props.artwork?.marquee} alt="Backbox artwork" /><span className={cn("absolute inset-0 flex items-center justify-center text-xs font-bold uppercase", props.artwork?.marquee && "hidden")}>VendX Pinball</span></div>
        </div>
        <div className="absolute left-[9%] top-[31%] h-[39%] w-[82%] origin-top -skew-y-6 rounded-sm border-4 shadow-xl" style={{ backgroundColor: body, borderColor: trim }}>
          <div className="absolute inset-[6%] overflow-hidden rounded-sm border border-border bg-background"><UploadedArt src={props.artwork?.screen} alt="Playfield artwork" /><DefaultScreen accent={trim} theme={props.theme} /></div>
        </div>
        {[18, 78].map(left => <div key={left} className="absolute top-[66%] h-[31%] w-[4%] bg-muted-foreground" style={{ left: `${left}%` }} />)}
      </div>
    );
  }

  if (isRacing) {
    return (
      <div className="relative h-[88%] w-[80%]" style={{ transform: `scale(${scale})`, transformOrigin: "bottom center" }}>
        <div className="absolute left-[18%] top-0 h-[58%] w-[64%] rounded-t-md border-4 shadow-xl" style={{ backgroundColor: body, borderColor: trim }}>
          <div className="absolute left-[9%] top-[9%] h-[43%] w-[82%] overflow-hidden rounded-sm border-4 border-background bg-background"><UploadedArt src={props.artwork?.screen} alt="Screen graphic" /><DefaultScreen accent={trim} theme={props.theme} /></div>
          <div className="absolute left-1/2 top-[61%] h-16 w-16 -translate-x-1/2 rounded-full border-[7px] border-background"><div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ backgroundColor: trim }} /></div>
        </div>
        <div className="absolute bottom-[7%] left-[12%] h-[27%] w-[76%] rounded-md border-4 shadow-xl" style={{ backgroundColor: body, borderColor: trim }} />
        <div className="absolute bottom-[22%] left-[25%] h-[15%] w-[50%] rounded-t-full border border-border bg-muted" />
        {custom.pedals && <div className="absolute bottom-0 left-[37%] h-[8%] w-[26%] rounded-sm border border-border bg-muted-foreground" />}
      </div>
    );
  }

  return (
    <div className={cn("relative transition-transform duration-300", wide ? "h-[88%] w-[82%]" : short ? "h-[75%] w-[62%]" : "h-[88%] w-[62%]")} style={{ transform: `scale(${scale})`, transformOrigin: "bottom center" }}>
      <div className="absolute inset-0 overflow-hidden shadow-2xl transition-colors duration-300" style={{ backgroundColor: body, clipPath: shape }}>
        <div className="absolute inset-x-[7%] top-[2%] h-[12%] overflow-hidden rounded-sm border-[3px] transition-colors" style={{ borderColor: trim, boxShadow: custom.marqueeType !== "unlit" ? `0 0 16px ${trim}` : undefined }}>
          <UploadedArt src={props.artwork?.marquee} alt="Marquee artwork" />
          {!props.artwork?.marquee && <div className="flex h-full items-center justify-center bg-background/90 text-xs font-black uppercase text-foreground">{props.theme || "VendX Arcade"}</div>}
        </div>
        <div className={cn("absolute left-1/2 top-[18%] -translate-x-1/2 overflow-hidden rounded-sm border-[5px] border-background bg-background", screenPortrait ? "h-[34%] w-[40%]" : "h-[29%] w-[72%]")}>
          {props.artwork?.screen ? <UploadedArt src={props.artwork.screen} alt="Screen artwork" /> : <DefaultScreen accent={trim} theme={props.theme} />}
          {custom.screenTreatment === "gloss" && <div className="pointer-events-none absolute inset-y-0 left-[12%] w-[18%] -skew-x-12 bg-foreground/5" />}
        </div>
        <div className="absolute inset-x-[10%] top-[51%] h-[5%] rounded-sm bg-background/80">
          <div className="flex h-full items-center justify-around">{Array.from({ length: custom.speakerLayout === "mono" ? 1 : 2 }).map((_, i) => <span key={i} className="h-3 w-8 rounded-full border border-border bg-muted" />)}</div>
        </div>
        <div className="absolute inset-x-[6%] top-[58%] h-[17%] -skew-y-3 overflow-hidden rounded-sm border-[3px] transition-colors" style={{ backgroundColor: body, borderColor: trim }}>
          <UploadedArt src={props.artwork?.controlPanel} alt="Control deck artwork" />
        </div>
        <Controls props={props} width={wide ? "88%" : "76%"} />
        {props.artwork?.front && <div className="absolute bottom-[7%] left-[13%] h-[18%] w-[74%] overflow-hidden rounded-sm"><UploadedArt src={props.artwork.front} alt="Kickplate artwork" /></div>}
        {custom.coinDoor !== false && props.style !== "bartop" && props.style !== "wall_mount" && (
          <div className="absolute bottom-[8%] left-1/2 h-[15%] w-[27%] -translate-x-1/2 rounded-sm border border-muted-foreground bg-background/90 p-1">
            <div className="flex h-full justify-around">{[0, 1].map(i => <span key={i} className="mt-1 h-5 w-2 rounded-sm border border-muted-foreground bg-muted" />)}</div>
          </div>
        )}
        {custom.usbPorts && <div className="absolute bottom-[27%] right-[14%] flex gap-1"><span className="h-1.5 w-3 bg-muted-foreground" /><span className="h-1.5 w-3 bg-muted-foreground" /></div>}
      </div>
      <div className="absolute inset-y-0 left-0 w-[3px] transition-colors" style={{ backgroundColor: trim, boxShadow: custom.lighting === "full_rgb" ? `0 0 14px ${trim}` : undefined }} />
      <div className="absolute inset-y-0 right-0 w-[3px] transition-colors" style={{ backgroundColor: trim, boxShadow: custom.lighting === "full_rgb" ? `0 0 14px ${trim}` : undefined }} />
      {props.lightGun && <div className="absolute right-[-4%] top-[61%] h-4 w-12 -rotate-12 rounded-sm" style={{ backgroundColor: custom.buttonColor || trim }} />}
    </div>
  );
}

function SideCabinet({ props, side }: { props: Props; side: "leftSide" | "rightSide" }) {
  const custom = props.customization || {};
  const body = custom.bodyColor || "#172033";
  const trim = custom.trimColor || "#12bde8";
  const art = props.artwork?.[side];
  const shape = props.style === "bartop"
    ? "polygon(8% 0,88% 0,100% 29%,77% 100%,12% 100%,0 28%)"
    : props.style === "wall_mount"
      ? "polygon(10% 0,86% 0,100% 18%,78% 100%,8% 100%,0 18%)"
      : "polygon(5% 0,82% 0,100% 13%,71% 30%,76% 100%,10% 100%,16% 40%,0 22%)";
  return (
    <div className="relative h-[88%] w-[54%] drop-shadow-2xl" style={{ transform: `scale(${SIZE_SCALE[props.size] || 1})`, transformOrigin: "bottom center" }}>
      <div className="absolute inset-0 overflow-hidden border-[4px] transition-colors duration-300" style={{ backgroundColor: body, borderColor: trim, clipPath: shape }}>
        {art ? <UploadedArt src={art} alt={`${side === "leftSide" ? "Left" : "Right"} side artwork`} /> : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <Image className="mb-3 h-9 w-9 text-muted-foreground" />
            <span className="text-xs font-bold uppercase text-foreground">{side === "leftSide" ? "Left" : "Right"} side</span>
            <span className="mt-1 text-[10px] text-muted-foreground">Upload artwork to fill this panel</span>
          </div>
        )}
        <div className="absolute right-[8%] top-[17%] h-[18%] w-[8%] rounded-sm bg-background/70" />
      </div>
    </div>
  );
}

export default function CabinetPreview(props: Props) {
  const [view, setView] = useState<View>("front");
  const wrap = useRef<HTMLDivElement>(null);
  const uploadedCount = useMemo(() => Object.values(props.artwork || {}).filter(Boolean).length, [props.artwork]);
  const custom = props.customization || {};
  const details = [
    `${props.monitor}\" ${custom.monitorOrientation || "landscape"}`,
    props.controls === "4p" ? "4 players" : props.controls === "1p" ? "1 player" : "2 players",
    custom.finish || "satin",
  ];

  return (
    <div ref={wrap} className={cn("relative overflow-hidden rounded-md border border-border bg-background", props.compact ? "h-72" : "h-[520px]")}> 
      <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.25)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.25)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-muted/60 to-transparent" />

      <div className="absolute inset-x-0 bottom-14 top-16 flex items-end justify-center p-5">
        {view === "front" ? <FrontCabinet props={props} /> : <SideCabinet props={props} side={view} />}
      </div>

      <div className="absolute left-3 top-3 flex gap-1 rounded-md border border-border bg-background/90 p-1 shadow-lg backdrop-blur-md">
        {(["front", "leftSide", "rightSide"] as View[]).map(item => (
          <Button key={item} type="button" size="sm" variant={view === item ? "default" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setView(item)}>
            {item === "front" ? "Front" : item === "leftSide" ? "Left" : "Right"}
          </Button>
        ))}
      </div>
      <Button type="button" size="icon" variant="secondary" className="absolute right-3 top-3 h-8 w-8 shadow-lg" aria-label="Open fullscreen preview" title="Open fullscreen preview" onClick={() => wrap.current?.requestFullscreen?.()}><Maximize2 className="h-4 w-4" /></Button>

      <div className="absolute bottom-0 inset-x-0 grid grid-cols-3 border-t border-border bg-background/90 backdrop-blur-md">
        <div className="flex items-center gap-2 border-r border-border px-3 py-2"><Palette className="h-3.5 w-3.5 text-primary" /><div><div className="text-[9px] uppercase text-muted-foreground">Colors</div><div className="flex gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: custom.bodyColor }} /><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: custom.trimColor }} /></div></div></div>
        <div className="flex items-center gap-2 border-r border-border px-3 py-2"><Image className="h-3.5 w-3.5 text-primary" /><div><div className="text-[9px] uppercase text-muted-foreground">Artwork</div><div className="text-[10px] font-semibold">{uploadedCount}/6 added</div></div></div>
        <div className="flex items-center gap-2 px-3 py-2"><SlidersHorizontal className="h-3.5 w-3.5 text-primary" /><div className="min-w-0"><div className="text-[9px] uppercase text-muted-foreground">Build</div><div className="truncate text-[10px] font-semibold capitalize">{STYLE_LABELS[props.style] || props.style}</div></div></div>
      </div>
      <div className="absolute right-3 top-14 hidden items-center gap-1 rounded-sm border border-border bg-background/80 px-2 py-1 text-[9px] text-muted-foreground sm:flex"><Monitor className="h-3 w-3" />{details.join(" · ")}</div>
    </div>
  );
}