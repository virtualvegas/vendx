import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, KeyRound, RefreshCw, Smartphone, Clock, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QRCodeGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getTimeRemaining(timeStep: number = 60): number {
  return timeStep - (Math.floor(Date.now() / 1000) % timeStep);
}

const QRCodeGenerator = ({ open, onOpenChange }: QRCodeGeneratorProps) => {
  const [currentCode, setCurrentCode] = useState<string>("------");
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasTotp, setHasTotp] = useState(false);
  const { toast } = useToast();

  const TIME_STEP = 60;

  const fetchCode = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("totp-generate-code");
      if (error) throw error;
      if (data?.code) {
        setCurrentCode(data.code);
        setTimeRemaining(data.time_remaining || TIME_STEP);
        setHasTotp(true);
      }
    } catch (error) {
      console.error("Error fetching TOTP code:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchCode();
    }
  }, [open, fetchCode]);

  useEffect(() => {
    if (!hasTotp || !open) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          fetchCode();
          return TIME_STEP;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [hasTotp, open, fetchCode]);

  const copyCode = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    toast({
      title: "Code Copied",
      description: "Payment code copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const QRCodeDisplay = ({ data }: { data: string }) => {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="w-48 h-48 bg-white p-4 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <QrCode className="w-32 h-32 text-foreground" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Scan this at any VendX machine to pay
        </p>
        <p className="text-xs font-mono bg-muted px-3 py-1 rounded">
          {data}
        </p>
      </div>
    );
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  const getProgressColor = () => {
    if (timeRemaining <= 10) return "text-destructive";
    if (timeRemaining <= 20) return "text-amber-500";
    return "text-primary";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            Pay at Machine
          </DialogTitle>
          <DialogDescription>
            Use your rotating code or QR to authenticate at VendX machines
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="code" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="code">
              <KeyRound className="w-4 h-4 mr-2" />
              Payment Code
            </TabsTrigger>
            <TabsTrigger value="qr">
              <QrCode className="w-4 h-4 mr-2" />
              QR Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="space-y-4 py-4">
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Loading...</p>
              </div>
            ) : (
              <div className="text-center space-y-6">
                <div className="relative">
                  <div className="p-8 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-3">Your Payment Code</p>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-5xl font-mono font-bold tracking-[0.3em] text-foreground">
                        {currentCode}
                      </p>
                      <Button variant="ghost" size="icon" onClick={copyCode} className="ml-2">
                        {copied ? (
                          <Check className="w-5 h-5 text-primary" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Clock className={`w-4 h-4 ${getProgressColor()}`} />
                    <span className={`text-sm font-medium ${getProgressColor()}`}>
                      New code in {formatTime(timeRemaining)}
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-1000 ease-linear"
                      style={{ width: `${(timeRemaining / TIME_STEP) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="text-sm text-muted-foreground space-y-2 pt-4 border-t border-border">
                  <p className="font-medium text-foreground">How to use:</p>
                  <ol className="text-left space-y-1 pl-4">
                    <li>1. Enter this code on the VendX machine keypad</li>
                    <li>2. Your wallet will be linked automatically</li>
                    <li>3. Make your purchase - funds deduct from wallet</li>
                  </ol>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="qr" className="space-y-4 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Scan this QR code on the machine screen to link your wallet
              </p>
              {hasTotp && (
                <QRCodeDisplay data={`vendxpay:${currentCode}`} />
              )}
              <p className="text-xs text-muted-foreground mt-4">
                QR code updates with each new payment code
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default QRCodeGenerator;
