import { useState } from "react";
import { Wallet, X, User, Loader2, ShoppingBag, Package, Hash, Check, ArrowLeft } from "lucide-react";
import type { KioskSessionData, KioskCategory } from "@/hooks/useKiosk";

interface KioskVendingModeProps {
  session: KioskSessionData;
  machineName: string;
  categories: KioskCategory[] | null | undefined;
  onPurchase: (amount: number, itemName: string) => Promise<boolean>;
  onCancel: () => void;
  isProcessing: boolean;
}

// Fallback demo items when no categories are configured
const DEMO_ITEMS = [
  { id: "1", name: "Snacks", price: 1.50, slots: ["A1", "A2", "A3", "A4"] },
  { id: "2", name: "Drinks", price: 2.00, slots: ["B1", "B2", "B3", "B4"] },
  { id: "3", name: "Candy", price: 1.00, slots: ["C1", "C2", "C3"] },
  { id: "4", name: "Chips", price: 1.75, slots: ["D1", "D2", "D3", "D4"] },
];

type ViewState = "categories" | "slots" | "confirm";

interface SelectedItem {
  categoryName: string;
  price: number;
  slot?: string;
}

export const KioskVendingMode = ({
  session,
  machineName,
  categories,
  onPurchase,
  onCancel,
  isProcessing
}: KioskVendingModeProps) => {
  const [viewState, setViewState] = useState<ViewState>("categories");
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [enteredSlot, setEnteredSlot] = useState("");

  // Use DB categories if available, otherwise fall back to demo items
  const displayItems = categories && categories.length > 0
    ? categories.map(cat => ({ 
        id: cat.id, 
        name: cat.category_name, 
        price: cat.base_price,
        slots: [] // Real machines use keypad entry
      }))
    : DEMO_ITEMS;

  const handleCategorySelect = (item: typeof displayItems[0]) => {
    if (session.walletBalance < item.price) return;
    setSelectedItem({ categoryName: item.name, price: item.price });
    
    // If demo mode with predefined slots, show slot selection
    if (item.slots && item.slots.length > 0) {
      setViewState("slots");
    } else {
      // For real machines, go to keypad slot entry
      setViewState("slots");
    }
  };

  const handleSlotSelect = (slot: string) => {
    if (!selectedItem) return;
    setSelectedItem({ ...selectedItem, slot });
    setViewState("confirm");
  };

  const handleSlotEntry = (digit: string) => {
    if (enteredSlot.length < 3) {
      setEnteredSlot(prev => prev + digit);
    }
  };

  const handleSlotConfirm = () => {
    if (!selectedItem || !enteredSlot) return;
    setSelectedItem({ ...selectedItem, slot: enteredSlot });
    setViewState("confirm");
  };

  const handleBack = () => {
    if (viewState === "confirm") {
      setViewState("slots");
      setEnteredSlot("");
    } else if (viewState === "slots") {
      setViewState("categories");
      setSelectedItem(null);
      setEnteredSlot("");
    }
  };

  const handleConfirmPurchase = async () => {
    if (!selectedItem || !selectedItem.slot) return;
    const itemDesc = `${selectedItem.categoryName} (Slot ${selectedItem.slot})`;
    await onPurchase(selectedItem.price, itemDesc);
  };

  const hasPresetSlots = displayItems[0]?.slots && displayItems[0].slots.length > 0;

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-4 bg-gradient-to-b from-cyan-900/20 to-black">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {viewState !== "categories" && (
            <button
              onClick={handleBack}
              disabled={isProcessing}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg mr-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <ShoppingBag className="w-7 h-7 text-cyan-400" />
          <div>
            <span className="text-lg font-bold text-cyan-400">VendX Pay</span>
            <p className="text-xs text-muted-foreground truncate max-w-[140px]">{machineName}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="p-3 bg-destructive hover:bg-destructive/80 rounded-xl touch-manipulation disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* User & Balance Card */}
      <div className="bg-card rounded-xl p-3 mb-4 border border-border">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-muted-foreground text-xs">Welcome back</p>
            <p className="text-lg font-bold truncate">{session.userName}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-green-400">
              <Wallet className="w-4 h-4" />
              <span className="text-xl font-bold">${session.walletBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Selection View */}
      {viewState === "categories" && !isProcessing && (
        <>
          <p className="text-muted-foreground text-center mb-3 text-sm">
            Select a product category
          </p>
          <div className="flex-1 grid grid-cols-2 gap-3">
            {displayItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleCategorySelect(item)}
                disabled={session.walletBalance < item.price || isProcessing}
                className={`flex flex-col items-center justify-center rounded-xl p-4 transition-all touch-manipulation border ${
                  session.walletBalance >= item.price && !isProcessing
                    ? "bg-card hover:bg-accent border-border"
                    : "bg-muted border-border opacity-50 cursor-not-allowed"
                }`}
              >
                <Package className="w-8 h-8 text-cyan-400 mb-2" />
                <span className="text-base font-bold">{item.name}</span>
                <span className="text-lg font-bold text-green-400">
                  ${item.price.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Slot Selection View */}
      {viewState === "slots" && selectedItem && !isProcessing && (
        <>
          <div className="bg-cyan-900/30 rounded-xl p-3 mb-3 border border-cyan-500/30">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Selected:</span>
              <span className="font-bold">{selectedItem.categoryName}</span>
              <span className="font-bold text-green-400">${selectedItem.price.toFixed(2)}</span>
            </div>
          </div>
          
          {hasPresetSlots ? (
            // Demo mode: Show preset slot buttons
            <>
              <p className="text-muted-foreground text-center mb-3 text-sm">
                Select item slot
              </p>
              <div className="flex-1 grid grid-cols-4 gap-2">
                {displayItems.find(i => i.name === selectedItem.categoryName)?.slots?.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => handleSlotSelect(slot)}
                    className="flex items-center justify-center rounded-lg p-3 bg-card hover:bg-accent border border-border font-bold text-lg"
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </>
          ) : (
            // Real machine: Keypad slot entry
            <>
              <p className="text-muted-foreground text-center mb-2 text-sm">
                Enter item slot code
              </p>
              <div className="bg-card rounded-xl p-4 mb-3 border border-border">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Hash className="w-5 h-5 text-cyan-400" />
                  <span className="text-3xl font-mono font-bold tracking-widest min-w-[100px] text-center">
                    {enteredSlot || "---"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "0", "B"].map((key) => (
                  <button
                    key={key}
                    onClick={() => handleSlotEntry(key)}
                    className="p-4 text-xl font-bold rounded-xl bg-card hover:bg-accent border border-border"
                  >
                    {key}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEnteredSlot("")}
                  className="flex-1 py-3 text-base font-bold bg-muted hover:bg-muted/80 rounded-xl"
                >
                  CLEAR
                </button>
                <button
                  onClick={handleSlotConfirm}
                  disabled={!enteredSlot}
                  className="flex-1 py-3 text-base font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl"
                >
                  SELECT
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Confirm View */}
      {viewState === "confirm" && selectedItem?.slot && !isProcessing && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <Package className="w-10 h-10 text-cyan-400" />
            </div>
            <div className="text-center">
              <p className="text-muted-foreground mb-1">Confirm Purchase</p>
              <p className="text-2xl font-bold">{selectedItem.categoryName}</p>
              <p className="text-lg text-muted-foreground">Slot: {selectedItem.slot}</p>
              <p className="text-3xl font-bold text-green-400 mt-2">
                ${selectedItem.price.toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={handleConfirmPurchase}
            className="w-full py-4 text-xl font-bold bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 rounded-xl flex items-center justify-center gap-2 shadow-lg"
          >
            <Check className="w-6 h-6" />
            CONFIRM PURCHASE
          </button>
        </div>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
          <p className="text-lg text-muted-foreground">Processing payment...</p>
        </div>
      )}

      {/* Cancel Button */}
      {viewState === "categories" && !isProcessing && (
        <button
          onClick={onCancel}
          className="mt-4 w-full py-3 text-base font-bold bg-muted hover:bg-muted/80 rounded-xl transition-all touch-manipulation border border-border"
        >
          CANCEL
        </button>
      )}
    </div>
  );
};
