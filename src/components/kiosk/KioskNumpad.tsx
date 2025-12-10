import { Wallet, X, Delete } from "lucide-react";

interface KioskNumpadProps {
  code: string;
  setCode: (code: string) => void;
  onSubmit: (code: string) => void;
  onStart?: () => void;
  isEntering?: boolean;
  onCancel?: () => void;
}

export const KioskNumpad = ({ 
  code, 
  setCode, 
  onSubmit, 
  onStart,
  isEntering = false,
  onCancel 
}: KioskNumpadProps) => {
  const handleDigit = (digit: string) => {
    if (code.length < 6) {
      const newCode = code + digit;
      setCode(newCode);
      if (newCode.length === 6) {
        onSubmit(newCode);
      }
    }
  };

  const handleBackspace = () => {
    setCode(code.slice(0, -1));
  };

  const handleClear = () => {
    setCode("");
    onCancel?.();
  };

  if (!isEntering) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-8">
        <div className="flex items-center gap-3">
          <Wallet className="w-12 h-12 sm:w-16 sm:h-16 text-cyan-400" />
          <span className="text-3xl sm:text-5xl font-bold tracking-wider text-cyan-400">
            VendX Pay
          </span>
        </div>
        
        <button
          onClick={onStart}
          className="w-full max-w-sm py-8 sm:py-12 text-2xl sm:text-4xl font-bold bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black rounded-2xl transition-all touch-manipulation shadow-lg shadow-cyan-500/30"
        >
          TAP TO PAY
        </button>
        
        <p className="text-gray-400 text-lg sm:text-xl text-center">
          Open VendX app for your code
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-8 h-8 text-cyan-400" />
          <span className="text-xl sm:text-2xl font-bold text-cyan-400">VendX Pay</span>
        </div>
        <button
          onClick={handleClear}
          className="p-3 bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-xl touch-manipulation"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Code Display */}
      <div className="flex justify-center gap-2 sm:gap-3 mb-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`w-10 h-14 sm:w-14 sm:h-20 rounded-xl border-2 flex items-center justify-center text-2xl sm:text-4xl font-bold transition-all ${
              i < code.length
                ? "border-cyan-400 bg-cyan-400/20 text-cyan-400"
                : "border-gray-600 bg-gray-900"
            }`}
          >
            {code[i] ? "●" : ""}
          </div>
        ))}
      </div>

      <p className="text-center text-gray-400 mb-4 text-sm sm:text-base">
        Enter 6-digit code from VendX app
      </p>

      {/* Numpad */}
      <div className="flex-1 grid grid-cols-3 gap-2 sm:gap-3 max-w-md mx-auto w-full">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            onClick={() => handleDigit(digit)}
            className="aspect-square text-3xl sm:text-5xl font-bold bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-2xl transition-all touch-manipulation border border-gray-700"
          >
            {digit}
          </button>
        ))}
        <button
          onClick={handleClear}
          className="aspect-square text-lg sm:text-xl font-bold bg-red-900/50 hover:bg-red-800/50 active:bg-red-700/50 rounded-2xl transition-all touch-manipulation border border-red-800 text-red-400"
        >
          CLEAR
        </button>
        <button
          onClick={() => handleDigit("0")}
          className="aspect-square text-3xl sm:text-5xl font-bold bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-2xl transition-all touch-manipulation border border-gray-700"
        >
          0
        </button>
        <button
          onClick={handleBackspace}
          className="aspect-square flex items-center justify-center bg-yellow-900/50 hover:bg-yellow-800/50 active:bg-yellow-700/50 rounded-2xl transition-all touch-manipulation border border-yellow-800"
        >
          <Delete className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400" />
        </button>
      </div>
    </div>
  );
};
