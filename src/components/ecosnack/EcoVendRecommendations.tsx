import { Lock } from "lucide-react";

interface LockerItem {
  locker_number: string;
  item_name: string;
  price: number;
  available: boolean;
}

interface EcoVendRecommendationsProps {
  allItems: LockerItem[];
  selectedLocker: LockerItem | null;
  onSelect: (item: LockerItem) => void;
}

const EcoVendRecommendations = ({ allItems, selectedLocker, onSelect }: EcoVendRecommendationsProps) => {
  // Show other available items excluding the selected one
  const recommendations = allItems.filter(
    (item) => item.available && item.locker_number !== selectedLocker?.locker_number
  ).slice(0, 4);

  if (!selectedLocker || recommendations.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        You might also like
      </p>
      <div className="grid grid-cols-2 gap-2">
        {recommendations.map((item) => (
          <button
            key={item.locker_number}
            onClick={() => onSelect(item)}
            className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card hover:border-accent/50 transition-all text-left active:scale-95"
          >
            <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
              <Lock className="h-3.5 w-3.5 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{item.item_name}</p>
              <p className="text-xs text-accent font-bold">${item.price.toFixed(2)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default EcoVendRecommendations;
