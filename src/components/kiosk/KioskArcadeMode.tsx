import { useState } from "react";
import { Gamepad2, Wallet, X, Zap, Gift, Ticket, Star } from "lucide-react";
import type { KioskSessionData, ArcadePricing, PriceBundle } from "@/hooks/useKiosk";

interface KioskArcadeModeProps {
  session: KioskSessionData;
  machineName: string;
  pricing: ArcadePricing | undefined;
  onPurchase: (plays: number, amount: number, bundleLabel?: string) => Promise<boolean>;
  onCancel: () => void;
  isProcessing: boolean;
}

export const KioskArcadeMode = ({
  session,
  machineName,
  pricing,
  onPurchase,
  onCancel,
  isProcessing
}: KioskArcadeModeProps) => {
  const [selectedBundle, setSelectedBundle] = useState<PriceBundle | null>(null);

  const pricePerPlay = pricing?.price_per_play || 1.00;
  const bundles = pricing?.bundles || [];

  const handleSinglePlay = async () => {
    if (session.walletBalance < pricePerPlay) return;
    await onPurchase(1, pricePerPlay);
  };

  const handleBundlePurchase = async (bundle: PriceBundle) => {
    if (session.walletBalance < bundle.price) return;
    setSelectedBundle(bundle);
    await onPurchase(bundle.plays, bundle.price, bundle.label);
    setSelectedBundle(null);
  };

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-4 bg-gradient-to-b from-purple-900/20 to-black">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-8 h-8 text-purple-400" />
          <div>
            <span className="text-lg sm:text-xl font-bold text-purple-400">Arcade Play</span>
            <p className="text-xs text-gray-400 truncate max-w-[150px]">{machineName}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="p-3 bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-xl touch-manipulation disabled:opacity-50"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Balance Card */}
      <div className="bg-gray-900 rounded-2xl p-4 mb-4 border border-purple-500/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-green-400" />
            <span className="text-gray-300">Wallet Balance</span>
          </div>
          <span className="text-2xl font-bold text-green-400">
            ${session.walletBalance.toFixed(2)}
          </span>
        </div>
        {session.ticketBalance !== undefined && session.ticketBalance > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-yellow-400" />
              <span className="text-gray-400 text-sm">Tickets</span>
            </div>
            <span className="text-lg font-bold text-yellow-400">
              {session.ticketBalance.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Single Play Button */}
      <button
        onClick={handleSinglePlay}
        disabled={isProcessing || session.walletBalance < pricePerPlay}
        className={`w-full py-5 rounded-2xl mb-4 transition-all touch-manipulation flex items-center justify-center gap-3 ${
          session.walletBalance >= pricePerPlay && !isProcessing
            ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 active:from-purple-700 active:to-pink-700 shadow-lg shadow-purple-500/30"
            : "bg-gray-800 opacity-50 cursor-not-allowed"
        }`}
      >
        <Zap className="w-8 h-8" />
        <div className="text-left">
          <p className="text-xl sm:text-2xl font-bold">PLAY NOW</p>
          <p className="text-sm opacity-80">${pricePerPlay.toFixed(2)} per play</p>
        </div>
      </button>

      {/* Bundle Options */}
      {bundles.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-5 h-5 text-yellow-400" />
            <span className="text-gray-300 font-medium">Play Bundles</span>
            <span className="text-xs text-yellow-400 ml-auto">Save more!</span>
          </div>
          
          <div className="flex-1 grid grid-cols-2 gap-3">
            {bundles.map((bundle, idx) => (
              <button
                key={idx}
                onClick={() => handleBundlePurchase(bundle)}
                disabled={isProcessing || session.walletBalance < bundle.price}
                className={`flex flex-col items-center justify-center rounded-2xl p-4 transition-all touch-manipulation border relative overflow-hidden ${
                  session.walletBalance >= bundle.price && !isProcessing
                    ? "bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border-purple-500/50"
                    : "bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed"
                } ${selectedBundle?.plays === bundle.plays ? "ring-2 ring-purple-400" : ""}`}
              >
                {bundle.savingsPercent && bundle.savingsPercent > 0 && (
                  <div className="absolute top-0 right-0 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-bl-lg">
                    {bundle.savingsPercent}% OFF
                  </div>
                )}
                <Star className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400 mb-1" />
                <span className="text-lg sm:text-xl font-bold">{bundle.plays} Plays</span>
                <span className="text-xl sm:text-2xl font-bold text-green-400">
                  ${bundle.price.toFixed(2)}
                </span>
                {bundle.savings && bundle.savings > 0 && (
                  <span className="text-xs text-yellow-400">
                    Save ${bundle.savings.toFixed(2)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Cancel Button */}
      <button
        onClick={onCancel}
        disabled={isProcessing}
        className="mt-4 w-full py-4 text-xl font-bold bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-2xl transition-all touch-manipulation border border-gray-700 disabled:opacity-50"
      >
        {isProcessing ? "PROCESSING..." : "CANCEL"}
      </button>
    </div>
  );
};
