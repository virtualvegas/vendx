import { useState, useRef } from "react";
import { Play, Film, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface VideoItem {
  id: string;
  title: string;
  video_url?: string | null;
  embed_url?: string | null;
  cover_image_url?: string | null;
  duration_seconds?: number | null;
  artist_name?: string;
}

interface VideoPlayerProps {
  items: VideoItem[];
  className?: string;
  compact?: boolean;
}

const getEmbedUrl = (url: string): string | null => {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  // SoundCloud visual player
  if (url.includes("soundcloud.com")) return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true&visual=true`;
  return null;
};

const formatDuration = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const VideoPlayer = ({ items, className, compact = false }: VideoPlayerProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(!compact && items.length > 1);
  const videoRef = useRef<HTMLVideoElement>(null);

  const current = items[activeIndex];

  const selectItem = (i: number) => {
    setActiveIndex(i);
    setPlaying(false);
    setStarted(false);
  };

  const startPlaying = () => {
    setStarted(true);
    setPlaying(true);
  };

  if (!current) return null;

  const embedSrc = current.embed_url ? getEmbedUrl(current.embed_url) : null;
  const isDirectVideo = !!current.video_url;
  const hasPlayableContent = embedSrc || isDirectVideo;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Main Player */}
      <div className="relative rounded-xl overflow-hidden bg-black border border-border/30 shadow-lg">
        <div className={cn("relative", compact ? "aspect-video max-h-64" : "aspect-video")}>
          {started && embedSrc ? (
            <iframe
              src={embedSrc}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={current.title}
            />
          ) : started && isDirectVideo ? (
            <video
              ref={videoRef}
              src={current.video_url!}
              className="w-full h-full object-contain bg-black"
              controls
              autoPlay
              poster={current.cover_image_url || undefined}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          ) : (
            /* Poster / Click to play */
            <div className="relative w-full h-full cursor-pointer group" onClick={hasPlayableContent ? startPlaying : undefined}>
              {current.cover_image_url ? (
                <img src={current.cover_image_url} alt={current.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-muted to-background flex items-center justify-center">
                  <Film className="w-20 h-20 text-muted-foreground/20" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                {hasPlayableContent ? (
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-xl"
                  >
                    <Play className="w-7 h-7 text-primary-foreground ml-1" />
                  </motion.div>
                ) : (
                  <p className="text-muted-foreground text-sm bg-background/60 px-3 py-1.5 rounded-lg">No video available</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Now Playing Info */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground truncate text-sm">{current.title}</h3>
          {current.artist_name && <p className="text-xs text-muted-foreground truncate">{current.artist_name}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {current.embed_url && (
            <a href={current.embed_url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7">
                <ExternalLink className="w-3 h-3" /> Source
              </Button>
            </a>
          )}
          {items.length > 1 && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => setShowPlaylist(!showPlaylist)}>
              {showPlaylist ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {items.length} videos
            </Button>
          )}
        </div>
      </div>

      {/* Playlist */}
      <AnimatePresence>
        {showPlaylist && items.length > 1 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm"
          >
            <div className="max-h-64 overflow-y-auto divide-y divide-border/30">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => selectItem(i)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-muted/50",
                    i === activeIndex && "bg-primary/10"
                  )}
                >
                  <div className="relative w-20 h-12 rounded overflow-hidden flex-shrink-0 bg-muted">
                    {item.cover_image_url ? (
                      <img src={item.cover_image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    {i === activeIndex && started && (
                      <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                        <Play className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm truncate", i === activeIndex ? "text-primary font-medium" : "text-foreground")}>
                      {item.title}
                    </p>
                    {item.duration_seconds && (
                      <p className="text-[11px] text-muted-foreground">{formatDuration(item.duration_seconds)}</p>
                    )}
                  </div>
                  {(item.video_url || item.embed_url) && (
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">
                      {item.embed_url ? "Stream" : "File"}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VideoPlayer;
