import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, KeyRound, RefreshCw, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QRCodeGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QRCodeGenerator = ({ open, onOpenChange }: QRCodeGeneratorProps) => {
  const [pin, setPin] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkPin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("pin_code")
          .eq("id", user.id)
          .single();
        
        setHasPin(!!profile?.pin_code);
        if (profile?.pin_code) {
          setPin(profile.pin_code);
        }
      }
    };

    if (open) {
      checkPin();
    }
  }, [open]);

  const handleSetPin = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast({
        title: "Invalid PIN",
        description: "PIN must be exactly 4 digits.",
        variant: "destructive",
      });
      return;
    }

    if (newPin !== confirmPin) {
      toast({
        title: "PINs Don't Match",
        description: "Please make sure both PINs match.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { error } = await supabase
        .from("profiles")
        .update({ pin_code: newPin })
        .eq("id", user.id);

      if (error) throw error;

      setPin(newPin);
      setHasPin(true);
      setNewPin("");
      setConfirmPin("");

      toast({
        title: "PIN Set",
        description: "Your VendX PIN has been saved.",
      });
    } catch (error) {
      console.error("Error setting PIN:", error);
      toast({
        title: "Error",
        description: "Failed to save PIN. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Generate a simple QR code representation using CSS
  const QRCodeDisplay = ({ data }: { data: string }) => {
    // Simple visual representation - in production, use a proper QR library
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="w-48 h-48 bg-white p-4 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <QrCode className="w-32 h-32 text-foreground" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Open VendX app on your phone to scan this code at any machine
        </p>
        <p className="text-xs font-mono bg-muted px-3 py-1 rounded">
          {data}
        </p>
      </div>
    );
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
            Use QR code or PIN to authenticate at VendX machines
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="qr" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qr">
              <QrCode className="w-4 h-4 mr-2" />
              QR Code
            </TabsTrigger>
            <TabsTrigger value="pin">
              <KeyRound className="w-4 h-4 mr-2" />
              PIN
            </TabsTrigger>
          </TabsList>

          <TabsContent value="qr" className="space-y-4 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Scan this QR code on the machine screen to link your wallet
              </p>
              <QRCodeDisplay data="vendxpay:user-session" />
              <Button variant="outline" className="mt-4">
                <RefreshCw className="w-4 h-4 mr-2" />
                Generate New Code
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="pin" className="space-y-4 py-4">
            {hasPin ? (
              <div className="text-center space-y-4">
                <div className="p-6 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Your VendX PIN</p>
                  <p className="text-4xl font-mono font-bold tracking-widest">{pin}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enter this PIN on any VendX machine to pay with your wallet
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setHasPin(false)}
                  className="w-full"
                >
                  Change PIN
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Set a 4-digit PIN to quickly authenticate at machines
                </p>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-pin">New PIN</Label>
                    <Input
                      id="new-pin"
                      type="password"
                      maxLength={4}
                      placeholder="••••"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="text-center text-2xl tracking-widest"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-pin">Confirm PIN</Label>
                    <Input
                      id="confirm-pin"
                      type="password"
                      maxLength={4}
                      placeholder="••••"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="text-center text-2xl tracking-widest"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleSetPin}
                  disabled={saving || newPin.length !== 4 || confirmPin.length !== 4}
                  className="w-full"
                >
                  {saving ? "Saving..." : "Set PIN"}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default QRCodeGenerator;
