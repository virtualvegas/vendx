import { CheckCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface KioskSuccessProps {
  onDone: () => void;
}

export const KioskSuccess = ({ onDone }: KioskSuccessProps) => {
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

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-8 bg-gradient-to-b from-green-900/30 to-black">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
            <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-500" />
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 animate-bounce" />
        </div>
        <p className="text-3xl sm:text-4xl font-bold text-green-500 text-center">
          Payment Complete!
        </p>
        <p className="text-xl sm:text-2xl text-gray-300 text-center">
          Enjoy your purchase
        </p>
      </div>
      
      <div className="flex flex-col items-center gap-2">
        <p className="text-gray-500">
          Returning in {countdown}s
        </p>
        <button
          onClick={onDone}
          className="px-8 py-4 text-lg font-bold bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-2xl transition-all touch-manipulation border border-gray-700"
        >
          DONE
        </button>
      </div>
    </div>
  );
};
