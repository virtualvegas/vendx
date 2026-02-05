import { CheckCircle, Sparkles, Gamepad2, Gift, Ticket, DollarSign, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

export interface PurchaseResult {
  type: "arcade" | "vending";
  amount: number;
  newBalance: number;
  pointsEarned: number;
  // Arcade specific
  playsGranted?: number;
  bundleLabel?: string;
  // Vending specific
  itemName?: string;
}

interface KioskSuccessProps {
  result?: PurchaseResult;
  onDone: () => void;
}

export const KioskSuccess = ({ result, onDone }: KioskSuccessProps) => {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const isArcade = result?.type === "arcade";

  return (
    <div className={`flex-1 flex flex-col items-center justify-center p-4 gap-6 bg-gradient-to-b ${
      isArcade ? "from-purple-900/30 to-black" : "from-green-900/30 to-black"
    }`}>
      {/* Success Icon */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full flex items-center justify-center animate-pulse ${
            isArcade ? "bg-purple-500/20" : "bg-green-500/20"
          }`}>
            <CheckCircle className={`w-10 h-10 sm:w-14 sm:h-14 ${
              isArcade ? "text-purple-500" : "text-green-500"
            }`} />
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-bounce" />
        </div>
        <p className={`text-2xl sm:text-3xl font-bold text-center ${
          isArcade ? "text-purple-400" : "text-green-400"
        }`}>
          {isArcade ? "Ready to Play!" : "Payment Complete!"}
        </p>
      </div>

      {/* Purchase Details */}
      {result && (
        <div className="w-full max-w-xs space-y-3">
          {/* Arcade-specific info */}
          {isArcade && result.playsGranted && (
            <div className="bg-gray-900/80 rounded-xl p-4 border border-purple-500/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-purple-400" />
                  <span className="text-gray-300">Plays Granted</span>
                </div>
                <span className="text-2xl font-bold text-purple-400">
                  {result.playsGranted}
                </span>
              </div>
              {result.bundleLabel && (
                <p className="text-xs text-gray-400">{result.bundleLabel}</p>
              )}
            </div>
          )}

          {/* Vending-specific info */}
          {!isArcade && result.itemName && (
            <div className="bg-gray-900/80 rounded-xl p-4 border border-green-500/30">
              <div className="flex items-center gap-2 mb-1">
                <Gift className="w-5 h-5 text-green-400" />
                <span className="text-gray-300">Item Purchased</span>
              </div>
              <p className="text-xl font-bold text-green-400">{result.itemName}</p>
            </div>
          )}

          {/* Amount & Points */}
          <div className="bg-gray-900/60 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-red-400" />
                <span className="text-sm text-gray-400">Amount Charged</span>
              </div>
              <span className="font-bold text-red-400">-${result.amount.toFixed(2)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">New Balance</span>
              </div>
              <span className="font-bold text-green-400">${result.newBalance.toFixed(2)}</span>
            </div>

            {result.pointsEarned > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-gray-400">Points Earned</span>
                </div>
                <span className="font-bold text-yellow-400">+{result.pointsEarned}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Machine Signal (Arcade only) */}
      {isArcade && (
        <div className="flex items-center gap-2 text-green-400 animate-pulse">
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <span className="text-sm">Machine Activated</span>
        </div>
      )}

      {/* Done Button */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-gray-500 text-sm">
          Returning in {countdown}s
        </p>
        <button
          onClick={onDone}
          className="px-8 py-3 text-lg font-bold bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-2xl transition-all touch-manipulation border border-gray-700"
        >
          DONE
        </button>
      </div>
    </div>
  );
};
