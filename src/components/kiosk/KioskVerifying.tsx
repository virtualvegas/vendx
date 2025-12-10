import { Loader2, Wallet } from "lucide-react";

export const KioskVerifying = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-8">
      <div className="flex items-center gap-3">
        <Wallet className="w-12 h-12 text-cyan-400" />
        <span className="text-3xl sm:text-4xl font-bold text-cyan-400">VendX Pay</span>
      </div>
      
      <div className="flex flex-col items-center gap-6">
        <Loader2 className="w-20 h-20 sm:w-24 sm:h-24 text-cyan-400 animate-spin" />
        <p className="text-2xl sm:text-3xl font-semibold text-gray-300">
          Verifying...
        </p>
      </div>
    </div>
  );
};
