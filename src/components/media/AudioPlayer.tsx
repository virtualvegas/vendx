import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Shuffle, ListMusic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Track {
  id: string;
  title: string;
  artist_name?: string;
  audio_url: string;
  cover_image_url?: string | null;
  duration_seconds?: number | null;
  external_url?: string | null;
}

interface AudioPlayerProps {
  tracks: Track[];
  initialTrackIndex?: number;
  className?: string;
  compact?: boolean;
}

const formatTime = (s: number) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const AudioPlayer = ({ tracks, initialTrackIndex = 0, className, compact = false }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentIndex, setCurrentIndex] = useState(initialTrackIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(!compact);
  const [loadError, setLoadError] = useState(false);

  const current = tracks[currentIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (repeat) {
        audio.currentTime = 0;
        audio.play();
      } else if (shuffle) {
        const next = Math.floor(Math.random() * tracks.length);
        setCurrentIndex(next);
        setIsPlaying(true);
      } else if (currentIndex < tracks.length - 1) {
        setCurrentIndex((i) => i + 1);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    };
    const onError = () => {
      setLoadError(true);
      // If audio fails, try opening external link
      const track = tracks[currentIndex];
      if (track?.external_url) {
        window.open(track.external_url, '_blank', 'noopener,noreferrer');
      }
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [currentIndex, tracks.length, repeat, shuffle]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    setLoadError(false);
    audio.src = current.audio_url;
    audio.volume = volume;
    audio.muted = muted;
    if (isPlaying) audio.play().catch(() => setIsPlaying(false));
  }, [currentIndex, current?.audio_url]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // If already errored out, open external link
    if (loadError && current?.external_url) {
      window.open(current.external_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying, loadError, current]);

  const seek = (val: number[]) => {
    if (audioRef.current) audioRef.current.currentTime = val[0];
  };

  const playTrack = (index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  if (!tracks.length || !current) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <audio ref={audioRef} preload="metadata" />

      {/* Now Playing Bar */}
      <div className="relative overflow-hidden rounded-xl bg-card border border-border/60 shadow-lg">
        {/* Background blur from cover */}
        {current.cover_image_url && (
          <div className="absolute inset-0 overflow-hidden">
            <img src={current.cover_image_url} alt="" className="w-full h-full object-cover opacity-10 blur-2xl scale-125" />
          </div>
        )}

        <div className="relative p-4 flex items-center gap-4">
          {/* Cover Art */}
          <motion.div
            key={current.id}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex-shrink-0"
          >
            {current.cover_image_url ? (
              <img
                src={current.cover_image_url}
                alt={current.title}
                className={cn(
                  "rounded-lg object-cover shadow-md",
                  compact ? "w-12 h-12" : "w-16 h-16"
                )}
              />
            ) : (
              <div className={cn(
                "rounded-lg bg-muted flex items-center justify-center",
                compact ? "w-12 h-12" : "w-16 h-16"
              )}>
                <ListMusic className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </motion.div>

          {/* Info + Seek */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div>
              <p className="font-semibold text-foreground truncate text-sm">{current.title}</p>
              {current.artist_name && (
                <p className="text-xs text-muted-foreground truncate">{current.artist_name}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-8 text-right font-mono">{formatTime(currentTime)}</span>
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.5}
                onValueChange={seek}
                className="flex-1"
              />
              <span className="text-[10px] text-muted-foreground w-8 font-mono">{formatTime(duration)}</span>
            </div>
            {loadError && (
              <p className="text-[10px] text-destructive">
                {current?.external_url ? (
                  <a href={current.external_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary transition-colors">
                    Open in external player →
                  </a>
                ) : "Unable to load audio"}
              </p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setShuffle(!shuffle)}
            >
              <Shuffle className={cn("w-3.5 h-3.5", shuffle ? "text-primary" : "text-muted-foreground")} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => currentIndex > 0 && playTrack(currentIndex - 1)} disabled={currentIndex === 0}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button variant="default" size="icon" className="h-10 w-10 rounded-full shadow-md" onClick={togglePlay}>
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => currentIndex < tracks.length - 1 && playTrack(currentIndex + 1)} disabled={currentIndex === tracks.length - 1}>
              <SkipForward className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setRepeat(!repeat)}
            >
              <Repeat className={cn("w-3.5 h-3.5", repeat ? "text-primary" : "text-muted-foreground")} />
            </Button>
          </div>

          {/* Volume */}
          <div className="hidden md:flex items-center gap-1.5 w-28">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMuted(!muted)}>
              {muted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </Button>
            <Slider value={[muted ? 0 : volume * 100]} max={100} step={1} onValueChange={(v) => { setVolume(v[0] / 100); setMuted(false); }} className="flex-1" />
          </div>

          {/* Playlist toggle */}
          {tracks.length > 1 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPlaylist(!showPlaylist)}>
              <ListMusic className={cn("w-4 h-4", showPlaylist ? "text-primary" : "text-muted-foreground")} />
            </Button>
          )}
        </div>
      </div>

      {/* Track List */}
      <AnimatePresence>
        {showPlaylist && tracks.length > 1 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm"
          >
            <div className="max-h-72 overflow-y-auto divide-y divide-border/30">
              {tracks.map((track, i) => (
                <button
                  key={track.id}
                  onClick={() => playTrack(i)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-muted/50",
                    i === currentIndex && "bg-primary/10"
                  )}
                >
                  <span className="w-6 text-right text-xs text-muted-foreground">
                    {i === currentIndex && isPlaying ? (
                      <span className="inline-flex gap-[2px] items-end h-3">
                        <span className="w-[3px] bg-primary rounded-full animate-pulse" style={{ height: "60%", animationDelay: "0ms" }} />
                        <span className="w-[3px] bg-primary rounded-full animate-pulse" style={{ height: "100%", animationDelay: "150ms" }} />
                        <span className="w-[3px] bg-primary rounded-full animate-pulse" style={{ height: "40%", animationDelay: "300ms" }} />
                      </span>
                    ) : (
                      i + 1
                    )}
                  </span>
                  {track.cover_image_url && (
                    <img src={track.cover_image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={cn("text-sm truncate block", i === currentIndex ? "text-primary font-medium" : "text-foreground")}>
                      {track.title}
                    </span>
                    {track.artist_name && (
                      <span className="text-[11px] text-muted-foreground truncate block">{track.artist_name}</span>
                    )}
                  </div>
                  {track.duration_seconds && (
                    <span className="text-xs text-muted-foreground font-mono">{formatTime(track.duration_seconds)}</span>
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

export default AudioPlayer;
