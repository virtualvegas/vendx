import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, UserPlus, Clock, Gamepad2 } from "lucide-react";
import { format } from "date-fns";

interface GuestWalletBannerProps {
  expiresAt: string | null;
  onUpgrade: () => void;
}

export const GuestWalletBanner = ({ expiresAt, onUpgrade }: GuestWalletBannerProps) => {
  const isExpiringSoon = expiresAt && new Date(expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <Card className={`border-2 ${isExpiringSoon ? "border-amber-500/50 bg-amber-500/5" : "border-primary/20 bg-primary/5"}`}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {isExpiringSoon ? (
              <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
            ) : (
              <Gamepad2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">Guest Wallet</h3>
                <Badge variant="secondary">Limited</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isExpiringSoon ? (
                  <>Your guest wallet expires soon! Upgrade to keep your balance.</>
                ) : (
                  <>Guest wallets can be used for arcade play but have limited features.</>
                )}
              </p>
              {expiresAt && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Expires: {format(new Date(expiresAt), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
              )}
              <div className="mt-3 space-y-1 text-xs">
                <p className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Arcade games & machines
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Prize redemption
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-red-500">✗</span> Withdrawals limited
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-red-500">✗</span> No rewards points
                </p>
              </div>
            </div>
          </div>
          <Button onClick={onUpgrade} className="shrink-0">
            <UserPlus className="h-4 w-4 mr-2" />
            Upgrade Account
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default GuestWalletBanner;
