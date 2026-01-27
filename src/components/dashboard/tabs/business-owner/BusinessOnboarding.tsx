import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, Wallet, CheckCircle2, ArrowRight, ArrowLeft, 
  Phone, Mail, Sparkles 
} from "lucide-react";

interface BusinessOnboardingProps {
  onComplete: () => void;
  assignments: any[];
  machines: any[];
}

const VENDX_PHONE = "(781) 214-1806";
const VENDX_EMAIL = "partners@vendx.space";

const BusinessOnboarding = ({ onComplete, assignments, machines }: BusinessOnboardingProps) => {
  const [step, setStep] = useState(1);
  const [payoutData, setPayoutData] = useState({
    payment_method: "bank_transfer",
    payout_frequency: "monthly",
    minimum_payout_amount: 50,
    bank_name: "",
    bank_account_last4: "",
    bank_routing_last4: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  const savePayout = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("payout_settings")
        .upsert({
          user_id: user.id,
          payment_method: payoutData.payment_method,
          payout_frequency: payoutData.payout_frequency,
          minimum_payout_amount: payoutData.minimum_payout_amount,
          bank_name: payoutData.bank_name || null,
          bank_account_last4: payoutData.bank_account_last4 || null,
          bank_routing_last4: payoutData.bank_routing_last4 || null,
        }, { onConflict: "user_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-owner-payout-settings"] });
      toast({ title: "Success", description: "Payout settings saved!" });
      onComplete();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to save settings",
        variant: "destructive"
      });
    },
  });

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      savePayout.mutate();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to VendX Partner Program!</CardTitle>
          <CardDescription>Let's get you set up in just a few steps</CardDescription>
          <Progress value={progress} className="mt-4 h-2" />
          <p className="text-xs text-muted-foreground mt-2">Step {step} of {totalSteps}</p>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Step 1: Welcome & Overview */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Your Partnership Overview</h3>
                <p className="text-muted-foreground">Here's what's been set up for you</p>
              </div>

              <div className="grid gap-4">
                <Card className="bg-muted/50">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{assignments?.length || 0} Location(s) Assigned</p>
                      <p className="text-sm text-muted-foreground">
                        {assignments?.map(a => a.location?.name || a.location?.city).filter(Boolean).join(", ") || "View in Locations tab"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/50">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">{machines?.length || 0} Machine(s) Active</p>
                      <p className="text-sm text-muted-foreground">Ready to generate revenue</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
                <p className="text-sm">
                  <span className="font-medium">Questions?</span> Call us at{" "}
                  <a href="tel:+17812141806" className="text-primary font-medium">{VENDX_PHONE}</a>
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Payout Preferences */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <Wallet className="w-10 h-10 mx-auto text-primary" />
                <h3 className="text-lg font-semibold">Set Up Your Payouts</h3>
                <p className="text-muted-foreground">Configure how you'd like to receive earnings</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select 
                    value={payoutData.payment_method} 
                    onValueChange={(v) => setPayoutData({...payoutData, payment_method: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer (ACH)</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Payout Frequency</Label>
                  <Select 
                    value={payoutData.payout_frequency} 
                    onValueChange={(v) => setPayoutData({...payoutData, payout_frequency: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi_weekly">Bi-Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Minimum Payout Amount ($)</Label>
                  <Input
                    type="number"
                    min={25}
                    value={payoutData.minimum_payout_amount}
                    onChange={(e) => setPayoutData({...payoutData, minimum_payout_amount: Number(e.target.value)})}
                  />
                  <p className="text-xs text-muted-foreground">Earnings will accumulate until this threshold is met</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Bank Details (if bank transfer) */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 mx-auto text-green-500" />
                <h3 className="text-lg font-semibold">Almost Done!</h3>
                <p className="text-muted-foreground">
                  {payoutData.payment_method === "bank_transfer" 
                    ? "Add your bank details for direct deposits" 
                    : "Review your settings and complete setup"}
                </p>
              </div>

              {payoutData.payment_method === "bank_transfer" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input
                      placeholder="e.g., Chase, Bank of America"
                      value={payoutData.bank_name}
                      onChange={(e) => setPayoutData({...payoutData, bank_name: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Account # (last 4)</Label>
                      <Input
                        placeholder="1234"
                        maxLength={4}
                        value={payoutData.bank_account_last4}
                        onChange={(e) => setPayoutData({...payoutData, bank_account_last4: e.target.value.replace(/\D/g, '')})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Routing # (last 4)</Label>
                      <Input
                        placeholder="5678"
                        maxLength={4}
                        value={payoutData.bank_routing_last4}
                        onChange={(e) => setPayoutData({...payoutData, bank_routing_last4: e.target.value.replace(/\D/g, '')})}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    For full bank verification, our team will contact you to securely collect complete details.
                  </p>
                </div>
              )}

              {payoutData.payment_method === "check" && (
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Checks will be mailed to your registered business address. 
                    Contact us to update your mailing address if needed.
                  </p>
                </div>
              )}

              <Card className="bg-green-500/5 border-green-500/20">
                <CardContent className="p-4 space-y-2">
                  <p className="font-medium text-green-600">Summary</p>
                  <div className="text-sm space-y-1">
                    <p>• Payment: {payoutData.payment_method === "bank_transfer" ? "Bank Transfer" : "Check"}</p>
                    <p>• Frequency: {payoutData.payout_frequency === "bi_weekly" ? "Bi-Weekly" : payoutData.payout_frequency.charAt(0).toUpperCase() + payoutData.payout_frequency.slice(1)}</p>
                    <p>• Min Amount: ${payoutData.minimum_payout_amount}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4">
            {step > 1 ? (
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={handleSkip}>
                Skip for now
              </Button>
            )}
            
            <Button onClick={handleNext} disabled={savePayout.isPending}>
              {step === totalSteps ? (
                savePayout.isPending ? "Saving..." : "Complete Setup"
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessOnboarding;
