import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Keyboard, Gamepad2 } from "lucide-react";

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

  const handleSubmit = () => {
    if (machineCode.trim()) {
      onMachineSelected(machineCode.trim().toUpperCase());
      setMachineCode("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              {/* QR Scanner Placeholder */}
              <div className="aspect-square bg-muted rounded-lg flex flex-col items-center justify-center gap-4 border-2 border-dashed border-border">
                <QrCode className="w-16 h-16 text-muted-foreground" />
                <p className="text-muted-foreground text-center px-4">
                  Point your camera at the QR code on the arcade machine
                </p>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Camera access is required for QR scanning.
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
