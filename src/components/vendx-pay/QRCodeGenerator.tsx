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

// TOTP generation utilities
function base32ToBytes(base32: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  
  for (const char of base32.toUpperCase()) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
  }
  
  return bytes;
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message.buffer as ArrayBuffer);
  return new Uint8Array(signature);
}

async function generateTOTP(secret: string, timeStep: number = 60): Promise<string> {
  const counter = Math.floor(Date.now() / 1000 / timeStep);
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }
  
  const key = base32ToBytes(secret);
  const hmac = await hmacSha1(key, counterBytes);
  
  const offset = hmac[19] & 0xf;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, '0');
}

function getTimeRemaining(timeStep: number = 60): number {
  return timeStep - (Math.floor(Date.now() / 1000) % timeStep);
}

const QRCodeGenerator = ({ open, onOpenChange }: QRCodeGeneratorProps) => {
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [currentCode, setCurrentCode] = useState<string>("------");
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const TIME_STEP = 60; // 60 seconds like McDonald's

  const generateCode = useCallback(async (secret: string) => {
    try {
      const code = await generateTOTP(secret, TIME_STEP);
      setCurrentCode(code);
    } catch (error) {
      console.error("Error generating TOTP:", error);
    }
  }, []);

  useEffect(() => {
    const fetchSecret = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("totp_secret")
          .eq("id", user.id)
          .single();
        
        if (profile?.totp_secret) {
          setTotpSecret(profile.totp_secret);
          await generateCode(profile.totp_secret);
        }
      }
      setLoading(false);
    };

    if (open) {
      fetchSecret();
    }
  }, [open, generateCode]);

  // Update countdown and regenerate code every second
  useEffect(() => {
    if (!totpSecret || !open) return;

    const interval = setInterval(async () => {
      const remaining = getTimeRemaining(TIME_STEP);
      setTimeRemaining(remaining);
      
      // Regenerate code when timer resets
      if (remaining === TIME_STEP) {
        await generateCode(totpSecret);
      }
    }, 1000);

    // Set initial time
    setTimeRemaining(getTimeRemaining(TIME_STEP));

    return () => clearInterval(interval);
  }, [totpSecret, open, generateCode]);

  const copyCode = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    toast({
      title: "Code Copied",
      description: "Payment code copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate a simple QR code representation using CSS
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
    if (timeRemaining <= 10) return "text-red-500";
    if (timeRemaining <= 20) return "text-yellow-500";
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
                {/* Code Display */}
                <div className="relative">
                  <div className="p-8 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-3">Your Payment Code</p>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-5xl font-mono font-bold tracking-[0.3em] text-foreground">
                        {currentCode}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={copyCode}
                        className="ml-2"
                      >
                        {copied ? (
                          <Check className="w-5 h-5 text-green-500" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Timer */}
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Clock className={`w-4 h-4 ${getProgressColor()}`} />
                    <span className={`text-sm font-medium ${getProgressColor()}`}>
                      New code in {formatTime(timeRemaining)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-1000 ease-linear"
                      style={{ width: `${(timeRemaining / TIME_STEP) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Instructions */}
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
              {totpSecret && (
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