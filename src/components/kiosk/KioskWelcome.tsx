import { Wallet, X, DollarSign, User } from "lucide-react";

interface KioskWelcomeProps {
  userName: string;
  balance: number;
  onPurchase: (amount: number, itemName: string) => void;
  onCancel: () => void;
}

// Demo items - in production, these would come from the machine's inventory
const DEMO_ITEMS = [
  { name: "Snack", price: 1.50 },
  { name: "Drink", price: 2.00 },
  { name: "Candy", price: 1.00 },
  { name: "Chips", price: 1.75 },
];

export const KioskWelcome = ({ userName, balance, onPurchase, onCancel }: KioskWelcomeProps) => {
  return (
    <div className="flex-1 flex flex-col p-3 sm:p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-8 h-8 text-cyan-400" />
          <span className="text-xl sm:text-2xl font-bold text-cyan-400">VendX Pay</span>
        </div>
        <button
          onClick={onCancel}
          className="p-3 bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-xl touch-manipulation"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* User Info */}
      <div className="bg-gray-900 rounded-2xl p-4 mb-4 border border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <User className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Welcome back</p>
            <p className="text-xl sm:text-2xl font-bold">{userName}</p>
          </div>
        </div>
        <div className="flex items-center justify-between bg-black/50 rounded-xl p-3">
          <span className="text-gray-400">Balance</span>
          <span className="text-2xl sm:text-3xl font-bold text-green-400">
            ${balance.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Quick Purchase Buttons */}
      <p className="text-gray-400 text-center mb-3 text-sm sm:text-base">
        Select item or use machine keypad
      </p>
      
      <div className="flex-1 grid grid-cols-2 gap-3 sm:gap-4">
        {DEMO_ITEMS.map((item) => (
          <button
            key={item.name}
            onClick={() => onPurchase(item.price, item.name)}
            disabled={balance < item.price}
            className={`flex flex-col items-center justify-center rounded-2xl p-4 transition-all touch-manipulation border ${
              balance >= item.price
                ? "bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border-gray-700"
                : "bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed"
            }`}
          >
            <DollarSign className="w-8 h-8 sm:w-10 sm:h-10 text-green-400 mb-2" />
            <span className="text-lg sm:text-xl font-bold">{item.name}</span>
            <span className="text-xl sm:text-2xl font-bold text-green-400">
              ${item.price.toFixed(2)}
            </span>
          </button>
        ))}
      </div>

      {/* Cancel Button */}
      <button
        onClick={onCancel}
        className="mt-4 w-full py-4 text-xl font-bold bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-2xl transition-all touch-manipulation border border-gray-700"
      >
        CANCEL
      </button>
    </div>
  );
};
