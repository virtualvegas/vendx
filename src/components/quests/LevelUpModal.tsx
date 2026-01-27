import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";
import { Star, Zap, Trophy, Gift, ChevronRight } from "lucide-react";

interface LevelUpModalProps {
  open: boolean;
  onClose: () => void;
  newLevel: number;
  xpEarned: number;
  creditsEarned?: number;
  pointsEarned?: number;
  badgesEarned?: string[];
}

const LevelUpModal = ({
  open,
  onClose,
  newLevel,
  xpEarned,
  creditsEarned = 0,
  pointsEarned = 0,
  badgesEarned = [],
}: LevelUpModalProps) => {
  useEffect(() => {
    if (open) {
      // Fire confetti
      const duration = 3000;
      const end = Date.now() + duration;

      const colors = ["#00d4ff", "#a855f7", "#f59e0b", "#22c55e"];

      (function frame() {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors,
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-card via-card to-primary/10 border-primary/30 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-accent/20 rounded-full blur-3xl animate-pulse delay-500" />
        </div>

        <div className="relative z-10 text-center py-4">
          {/* Level Badge */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute inset-0 w-32 h-32 rounded-full bg-gradient-to-br from-primary to-accent opacity-30 animate-ping" />
            <div className="absolute inset-0 w-32 h-32 rounded-full bg-gradient-to-br from-primary to-accent opacity-50 animate-pulse" />
            <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl">
              <div className="text-center">
                <span className="text-4xl font-black text-primary-foreground">{newLevel}</span>
                <p className="text-xs font-semibold text-primary-foreground/80">LEVEL</p>
              </div>
            </div>
            <Star className="absolute -top-2 -right-2 w-10 h-10 text-yellow-400 animate-bounce" />
          </div>

          <h2 className="text-3xl font-black text-foreground mb-2 tracking-tight">
            LEVEL UP! 🎉
          </h2>
          <p className="text-muted-foreground mb-6">
            You've reached Level {newLevel}! Keep exploring!
          </p>

          {/* Rewards Summary */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm text-muted-foreground">XP Earned</p>
                <p className="text-lg font-bold text-foreground">+{xpEarned} XP</p>
              </div>
            </div>

            {creditsEarned > 0 && (
              <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">Bonus Credits</p>
                  <p className="text-lg font-bold text-primary">+${creditsEarned.toFixed(2)}</p>
                </div>
              </div>
            )}

            {pointsEarned > 0 && (
              <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-accent/10 border border-accent/20">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <Star className="w-5 h-5 text-accent" />
                </div>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">Points Earned</p>
                  <p className="text-lg font-bold text-accent">+{pointsEarned}</p>
                </div>
              </div>
            )}

            {badgesEarned.length > 0 && (
              <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-amber-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">New Badge!</p>
                  <p className="text-lg font-bold text-amber-500">{badgesEarned[0]}</p>
                </div>
              </div>
            )}
          </div>

          <Button onClick={onClose} className="w-full gap-2 font-bold" size="lg">
            Continue Adventure
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LevelUpModal;
