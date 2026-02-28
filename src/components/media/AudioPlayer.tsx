import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface Track {
  id: string;
  title: string;
  artist_name?: string;
  audio_url: string;
  cover_image_url?: string | null;
  duration_seconds?: number | null;
}

interface AudioPlayerProps {
  tracks: Track[];
  initialTrackIndex?: number;
  className?: string;
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const AudioPlayer = ({ tracks, initialTrackIndex = 0, className }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentIndex, setCurrentIndex] = useState(initialTrackIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);

  const current = tracks[currentIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (currentIndex < tracks.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentIndex, tracks.length]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
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
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying]);

  const seek = (val: number[]) => {
    if (audioRef.current) audioRef.current.currentTime = val[0];
  };

  const playTrack = (index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  if (!tracks.length || !current) return null;

  return (
    <div className={cn("space-y-4", className)}>
      <audio ref={audioRef} preload="metadata" />

      {/* Now Playing Bar */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-card/80 border border-border/50 backdrop-blur-sm">
        {current.cover_image_url && (
          <img src={current.cover_image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{current.title}</p>
          {current.artist_name && (
            <p className="text-xs text-muted-foreground truncate">{current.artist_name}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-muted-foreground w-9 text-right">{formatTime(currentTime)}</span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.5}
              onValueChange={seek}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-9">{formatTime(duration)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => currentIndex > 0 && playTrack(currentIndex - 1)} disabled={currentIndex === 0}>
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button variant="default" size="icon" className="h-10 w-10 rounded-full" onClick={togglePlay}>
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => currentIndex < tracks.length - 1 && playTrack(currentIndex + 1)} disabled={currentIndex === tracks.length - 1}>
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 w-28">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMuted(!muted)}>
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </Button>
          <Slider value={[muted ? 0 : volume * 100]} max={100} step={1} onValueChange={(v) => { setVolume(v[0] / 100); setMuted(false); }} className="flex-1" />
        </div>
      </div>

      {/* Track List */}
      {tracks.length > 1 && (
        <div className="space-y-0.5">
          {tracks.map((track, i) => (
            <button
              key={track.id}
              onClick={() => playTrack(i)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all hover:bg-muted/50",
                i === currentIndex && "bg-primary/10 border border-primary/20"
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
                <img src={track.cover_image_url} alt="" className="w-8 h-8 rounded object-cover" />
              )}
              <span className={cn("flex-1 text-sm truncate", i === currentIndex ? "text-primary font-medium" : "text-foreground")}>
                {track.title}
              </span>
              {track.duration_seconds && (
                <span className="text-xs text-muted-foreground">{formatTime(track.duration_seconds)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
