import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, Zap, Gift, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Achievement {
  id: string;
  type: "badge" | "level_up" | "streak" | "milestone";
  title: string;
  description: string;
  icon?: string;
}

interface AchievementToastProps {
  achievement: Achievement | null;
  onDismiss: () => void;
}

const iconMap: Record<string, React.ReactNode> = {
  badge: <Trophy className="w-6 h-6 text-amber-400" />,
  level_up: <Star className="w-6 h-6 text-primary" />,
  streak: <Zap className="w-6 h-6 text-orange-400" />,
  milestone: <Gift className="w-6 h-6 text-purple-400" />,
};

const bgColors: Record<string, string> = {
  badge: "from-amber-500/20 to-orange-500/20 border-amber-500/40",
  level_up: "from-primary/20 to-accent/20 border-primary/40",
  streak: "from-orange-500/20 to-red-500/20 border-orange-500/40",
  milestone: "from-purple-500/20 to-pink-500/20 border-purple-500/40",
};

const AchievementToast = ({ achievement, onDismiss }: AchievementToastProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (achievement) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 300);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [achievement, onDismiss]);

  if (!achievement) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.8 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100]"
        >
          <div
            className={`relative flex items-center gap-4 px-6 py-4 rounded-2xl bg-gradient-to-r ${
              bgColors[achievement.type]
            } border backdrop-blur-xl shadow-2xl min-w-[300px]`}
          >
            {/* Animated glow */}
            <div className="absolute inset-0 rounded-2xl bg-white/10 animate-pulse" />

            {/* Icon */}
            <div className="relative w-12 h-12 rounded-xl bg-background/50 flex items-center justify-center">
              {achievement.icon ? (
                <img src={achievement.icon} alt="" className="w-8 h-8" />
              ) : (
                iconMap[achievement.type]
              )}
            </div>

            {/* Content */}
            <div className="relative flex-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {achievement.type === "badge"
                  ? "New Badge!"
                  : achievement.type === "level_up"
                  ? "Level Up!"
                  : achievement.type === "streak"
                  ? "Streak Bonus!"
                  : "Milestone!"}
              </p>
              <p className="font-bold text-foreground">{achievement.title}</p>
              <p className="text-sm text-muted-foreground">{achievement.description}</p>
            </div>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8"
              onClick={() => {
                setIsVisible(false);
                setTimeout(onDismiss, 300);
              }}
            >
              <X className="w-4 h-4" />
            </Button>

            {/* Sparkle effects */}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-primary rounded-full animate-ping delay-150" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AchievementToast;
