import { useState, useRef, useCallback } from "react";
import { Play, Pause, Maximize, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
}

const getEmbedUrl = (url: string): string | null => {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  return null;
};

const formatDuration = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const VideoPlayer = ({ items, className }: VideoPlayerProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const current = items[activeIndex];

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }, []);

  const selectItem = (i: number) => {
    setActiveIndex(i);
    setPlaying(false);
  };

  if (!current) return null;

  const isEmbed = current.embed_url && getEmbedUrl(current.embed_url);
  const isDirectVideo = current.video_url;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Player */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        {isEmbed ? (
          <iframe
            src={getEmbedUrl(current.embed_url!)!}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={current.title}
          />
        ) : isDirectVideo ? (
          <>
            <video
              ref={videoRef}
              src={current.video_url!}
              className="w-full h-full object-contain"
              controls
              poster={current.cover_image_url || undefined}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          </>
        ) : current.cover_image_url ? (
          <div className="relative w-full h-full">
            <img src={current.cover_image_url} alt={current.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <p className="text-foreground/70 text-sm">No video available</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-16 h-16 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Now Playing Info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{current.title}</h3>
          {current.artist_name && <p className="text-xs text-muted-foreground">{current.artist_name}</p>}
        </div>
        {current.embed_url && (
          <a href={current.embed_url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
              <ExternalLink className="w-3.5 h-3.5" /> Watch on source
            </Button>
          </a>
        )}
      </div>

      {/* Playlist */}
      {items.length > 1 && (
        <div className="space-y-1">
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => selectItem(i)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:bg-muted/50",
                i === activeIndex && "bg-primary/10 border border-primary/20"
              )}
            >
              {item.cover_image_url ? (
                <img src={item.cover_image_url} alt="" className="w-16 h-10 rounded object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  <Play className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm truncate", i === activeIndex ? "text-primary font-medium" : "text-foreground")}>
                  {item.title}
                </p>
                {item.duration_seconds && (
                  <p className="text-xs text-muted-foreground">{formatDuration(item.duration_seconds)}</p>
                )}
              </div>
              {(item.video_url || item.embed_url) && (
                <Badge variant="outline" className="text-[10px] flex-shrink-0">
                  {item.embed_url ? "Stream" : "Video"}
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
