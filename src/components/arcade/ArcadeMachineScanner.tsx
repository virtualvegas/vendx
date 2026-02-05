import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Keyboard, Gamepad2, Camera, CameraOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ArcadeMachineScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMachineSelected: (machineCode: string) => void;
}

export const ArcadeMachineScanner = ({
  open,
  onOpenChange,
  onMachineSelected,
}: ArcadeMachineScannerProps) => {
  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [machineCode, setMachineCode] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const { toast } = useToast();

  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const processQRCode = useCallback((data: string) => {
    // Parse VendX QR code format: vendx:machine:CODE or just the code
    let code = data;
    if (data.startsWith("vendx:machine:")) {
      code = data.replace("vendx:machine:", "");
    } else if (data.startsWith("vendx://arcade/")) {
      code = data.replace("vendx://arcade/", "");
    }
    
    if (code) {
      stopCamera();
      onMachineSelected(code.toUpperCase());
      onOpenChange(false);
      toast({
        title: "Machine Found",
        description: `Machine code: ${code.toUpperCase()}`,
      });
    }
  }, [onMachineSelected, onOpenChange, stopCamera, toast]);

  const scanQRCode = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanQRCode);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Use BarcodeDetector if available (Chrome, Edge)
    if ("BarcodeDetector" in window) {
      const barcodeDetector = new (window as unknown as { BarcodeDetector: new (options: { formats: string[] }) => { detect: (source: HTMLCanvasElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({
        formats: ["qr_code"],
      });
      
      barcodeDetector.detect(canvas)
        .then((barcodes: Array<{ rawValue: string }>) => {
          if (barcodes.length > 0) {
            processQRCode(barcodes[0].rawValue);
            return;
          }
          animationRef.current = requestAnimationFrame(scanQRCode);
        })
        .catch(() => {
          animationRef.current = requestAnimationFrame(scanQRCode);
        });
    } else {
      // Fallback: just continue scanning loop, user can manually enter
      animationRef.current = requestAnimationFrame(scanQRCode);
    }
  }, [processQRCode]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          animationRef.current = requestAnimationFrame(scanQRCode);
        };
      }
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Camera access denied or unavailable. Please use manual entry.");
      setScanning(false);
    }
  }, [scanQRCode]);

  // Start/stop camera based on mode and dialog open state
  useEffect(() => {
    if (open && mode === "scan") {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [open, mode, startCamera, stopCamera]);

  const handleSubmit = () => {
    if (machineCode.trim()) {
      onMachineSelected(machineCode.trim().toUpperCase());
      setMachineCode("");
      onOpenChange(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      stopCamera();
      setMachineCode("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-purple-500" />
            Select Arcade Machine
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === "scan" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setMode("scan")}
            >
              <QrCode className="w-4 h-4 mr-2" />
              Scan QR
            </Button>
            <Button
              variant={mode === "manual" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setMode("manual")}
            >
              <Keyboard className="w-4 h-4 mr-2" />
              Enter Code
            </Button>
          </div>

          {mode === "scan" ? (
            <div className="space-y-4">
              {/* QR Scanner */}
              <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                {cameraError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 text-center bg-muted">
                    <CameraOff className="w-12 h-12 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{cameraError}</p>
                    <Button variant="outline" onClick={startCamera}>
                      <Camera className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                ) : scanning ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Scanning overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute inset-8 border-2 border-white/50 rounded-lg">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                      </div>
                      <div className="absolute bottom-4 left-0 right-0 text-center">
                        <span className="bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                          Point at QR code
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Starting camera...</p>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
              
              <p className="text-xs text-center text-muted-foreground">
                Position the QR code on the arcade machine within the frame.
                <br />
                Or switch to manual entry to type the machine code.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Machine Code</Label>
                <Input
                  placeholder="e.g., VX-ARC-001"
                  value={machineCode}
                  onChange={(e) => setMachineCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  className="text-center text-lg font-mono tracking-wider"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Enter the code displayed on the arcade machine
                </p>
              </div>

              <Button className="w-full" onClick={handleSubmit} disabled={!machineCode.trim()}>
                <Gamepad2 className="w-4 h-4 mr-2" />
                Continue
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
