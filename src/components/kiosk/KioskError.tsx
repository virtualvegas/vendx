import { AlertTriangle, RefreshCw } from "lucide-react";

interface KioskErrorProps {
  message: string;
  onRetry: () => void;
}

export const KioskError = ({ message, onRetry }: KioskErrorProps) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-8">
      <div className="flex flex-col items-center gap-4">
        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500" />
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-red-500 text-center">
          Error
        </p>
        <p className="text-lg sm:text-xl text-gray-400 text-center max-w-sm">
          {message}
        </p>
      </div>
      
      <button
        onClick={onRetry}
        className="flex items-center gap-3 px-8 py-6 text-xl sm:text-2xl font-bold bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black rounded-2xl transition-all touch-manipulation shadow-lg shadow-cyan-500/30"
      >
        <RefreshCw className="w-8 h-8" />
        TRY AGAIN
      </button>
    </div>
  );
};
