import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  QrCode, 
  Camera, 
  X, 
  CheckCircle2, 
  Loader2,
  Keyboard
} from "lucide-react";

interface QuestQRScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questId: string;
  nodeId: string;
  completionId: string;
  onVerified: () => void;
}

const QuestQRScanner = ({
  open,
  onOpenChange,
  questId,
  nodeId,
  completionId,
  onVerified,
}: QuestQRScannerProps) => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualCode, setManualCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize camera when in camera mode
  useEffect(() => {
    if (!open || mode !== "camera") {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [open, mode]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
        
        // Start scanning for QR codes
        scanForQRCode();
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraError(err.message || "Could not access camera");
      setMode("manual");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  // Simple QR code detection using canvas analysis
  // In production, you'd use a library like jsQR or zxing
  const scanForQRCode = () => {
    if (!videoRef.current || !isScanning) return;

    // For demo purposes, we'll simulate scanning
    // In production, integrate a proper QR scanning library
    const checkFrame = () => {
      if (!isScanning || !open) return;
      
      // Continue checking every 500ms
      setTimeout(checkFrame, 500);
    };
    
    checkFrame();
  };

  const verifyCode = async (code: string) => {
    if (!code.trim()) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid QR code",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);

    try {
      // Verify the QR code matches the node
      const { data: node, error: nodeError } = await supabase
        .from("quest_nodes")
        .select("id, name")
        .eq("id", nodeId)
        .single();

      if (nodeError || !node) {
        throw new Error("Node not found");
      }

      // Check if code matches (use node ID prefix as expected code)
      const expectedCode = node.id.slice(0, 8).toUpperCase();
      const isValid = code.toUpperCase() === expectedCode.toUpperCase() || 
                      code === node.id;

      if (!isValid) {
        toast({
          title: "Invalid QR Code",
          description: "This code doesn't match the expected node",
          variant: "destructive",
        });
        setIsVerifying(false);
        return;
      }

      // Update completion with QR verification
      const { error: updateError } = await supabase
        .from("quest_completions")
        .update({
          verified_via: "qr_code",
        })
        .eq("id", completionId);

      if (updateError) throw updateError;

      toast({
        title: "✓ QR Code Verified!",
        description: `Successfully verified at ${node.name}`,
      });

      onVerified();
      onOpenChange(false);
    } catch (err: any) {
      console.error("QR verification error:", err);
      toast({
        title: "Verification Failed",
        description: err.message || "Could not verify QR code",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualSubmit = () => {
    verifyCode(manualCode);
  };

  // Demo: Simulate successful scan
  const handleDemoScan = () => {
    verifyCode(nodeId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            Scan QR Code
          </DialogTitle>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={mode === "camera" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("camera")}
            className="flex-1 gap-2"
          >
            <Camera className="w-4 h-4" />
            Camera
          </Button>
          <Button
            variant={mode === "manual" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("manual")}
            className="flex-1 gap-2"
          >
            <Keyboard className="w-4 h-4" />
            Enter Code
          </Button>
        </div>

        {mode === "camera" ? (
          <div className="space-y-4">
            {/* Camera View */}
            <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                  <Camera className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-2">
                    {cameraError}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setMode("manual")}>
                    Enter Code Manually
                  </Button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  
                  {/* Scanning overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-primary rounded-xl relative">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary rounded-br-lg" />
                      
                      {/* Scanning line animation */}
                      <div className="absolute inset-x-2 h-0.5 bg-primary/50 animate-pulse top-1/2" />
                    </div>
                  </div>

                  {isScanning && (
                    <Badge className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/80 backdrop-blur-sm">
                      Point camera at QR code
                    </Badge>
                  )}
                </>
              )}
            </div>

            {/* Demo button for testing */}
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleDemoScan}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Demo: Simulate Successful Scan
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the code shown on the QR sticker at this location
            </p>
            
            <Input
              placeholder="Enter QR code..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              className="text-center text-2xl tracking-widest font-mono uppercase"
              maxLength={16}
            />

            <Button
              className="w-full"
              onClick={handleManualSubmit}
              disabled={!manualCode.trim() || isVerifying}
            >
              {isVerifying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Verify Code
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QuestQRScanner;
