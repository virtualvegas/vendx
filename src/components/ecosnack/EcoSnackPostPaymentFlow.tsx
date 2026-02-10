import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, Copy, Lock, Leaf, ArrowRight,
  ThumbsUp, ThumbsDown, Star, AlertTriangle, Loader2, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

interface EcoSnackPostPaymentFlowProps {
  lockerCode: string;
  lockerNumber: string;
  itemName: string;
  machineCode: string;
  purchaseId?: string;
}

type Step = "code" | "walkthrough" | "received" | "review" | "ticket" | "done";

const EcoSnackPostPaymentFlow = ({
  lockerCode,
  lockerNumber,
  itemName,
  machineCode,
  purchaseId,
}: EcoSnackPostPaymentFlowProps) => {
  const [step, setStep] = useState<Step>("code");
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [ticketNotes, setTicketNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(lockerCode);
    toast.success("Code copied!");
  };

  const handleSubmitReview = async () => {
    setSubmitting(true);
    try {
      // Log review as a point transaction or similar feedback
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("point_transactions").insert({
          user_id: user.id,
          points: 5,
          transaction_type: "ecosnack_review",
          description: `EcoSnack review: ${itemName} (${rating}★) - ${reviewText || "No comment"}`,
          reference_id: purchaseId || null,
        });
      }
      toast.success("Thanks for your review! +5 bonus points 🎉");
      setStep("done");
    } catch {
      toast.error("Could not submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitTicket = async () => {
    setSubmitting(true);
    try {
      const ticketNumber = `ES-${Date.now().toString(36).toUpperCase()}`;
      await supabase.from("support_tickets").insert({
        ticket_number: ticketNumber,
        machine_id: machineCode,
        location: `EcoSnack Machine: ${machineCode}`,
        issue_type: "item_not_received",
        description: `Customer did not receive item "${itemName}" from locker #${lockerNumber}. Purchase ID: ${purchaseId || "N/A"}. ${ticketNotes ? `\nNotes: ${ticketNotes}` : ""}`,
        priority: "high",
        status: "open",
      });
      toast.success(`Support ticket ${ticketNumber} created. We'll resolve this ASAP!`);
      setStep("done");
    } catch {
      toast.error("Could not create support ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-md w-full border-accent/30 bg-card">
      <CardContent className="pt-8 pb-8 text-center space-y-6">
        {/* Step 1: Show Code */}
        {step === "code" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-accent/20 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-accent" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-1">Payment Successful!</h2>
              <p className="text-muted-foreground">Your locker is ready to open</p>
            </div>
            <div className="bg-muted rounded-xl p-6 space-y-3">
              <p className="text-sm text-muted-foreground uppercase tracking-wider">Your Locker Code</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-5xl font-mono font-bold tracking-[0.3em] text-accent">
                  {lockerCode}
                </span>
                <Button variant="ghost" size="icon" onClick={copyCode}>
                  <Copy className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>Locker #{lockerNumber.padStart(2, "0")}</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              {itemName && <p><strong className="text-foreground">{itemName}</strong></p>}
              <p>Enter the 3-digit code on the locker dial to unlock your item.</p>
              <p className="text-xs">Code expires in 24 hours.</p>
            </div>
            <Button onClick={() => setStep("walkthrough")} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              Continue <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <EcoSnackBadge />
          </>
        )}

        {/* Step 2: Walkthrough */}
        {step === "walkthrough" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-accent/20 flex items-center justify-center">
              <Lock className="h-8 w-8 text-accent" />
            </div>
            <h2 className="text-xl font-bold text-foreground">How to Open Your Locker</h2>
            <div className="text-left space-y-4">
              <StepItem number={1} text="Find your locker on the machine" detail={`Look for Locker #${lockerNumber.padStart(2, "0")}`} />
              <StepItem number={2} text="Enter the 3-digit code on the dial" detail={`Turn the dial to: ${lockerCode.split("").join(" → ")}`} />
              <StepItem number={3} text="Pull the handle to open" detail="Your item should be inside!" />
            </div>
            <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Your code for quick reference:</p>
              <span className="text-2xl font-mono font-bold tracking-[0.2em] text-accent">{lockerCode}</span>
            </div>
            <Button onClick={() => setStep("received")} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              I've Opened My Locker <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        )}

        {/* Step 3: Did you receive your item? */}
        {step === "received" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Did you receive your item?</h2>
            <p className="text-muted-foreground text-sm">
              Let us know if everything went well with your <strong className="text-foreground">{itemName}</strong> from Locker #{lockerNumber.padStart(2, "0")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => setStep("review")}
                variant="outline"
                className="h-20 flex-col gap-2 border-green-500/30 hover:bg-green-500/10 hover:border-green-500/50"
              >
                <ThumbsUp className="h-6 w-6 text-green-500" />
                <span className="text-sm font-medium">Yes, got it!</span>
              </Button>
              <Button
                onClick={() => setStep("ticket")}
                variant="outline"
                className="h-20 flex-col gap-2 border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50"
              >
                <ThumbsDown className="h-6 w-6 text-destructive" />
                <span className="text-sm font-medium">No, issue</span>
              </Button>
            </div>
          </>
        )}

        {/* Step 4a: Quick Review */}
        {step === "review" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Star className="h-8 w-8 text-yellow-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Quick Review</h2>
            <p className="text-sm text-muted-foreground">How was your EcoSnack experience?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${star <= rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Any comments? (optional)"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="resize-none"
              rows={3}
            />
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep("done")} className="flex-1">
                Skip
              </Button>
              <Button
                onClick={handleSubmitReview}
                disabled={rating === 0 || submitting}
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Earn <strong className="text-accent">+5 bonus points</strong> for reviewing!</p>
          </>
        )}

        {/* Step 4b: Support Ticket */}
        {step === "ticket" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground">We're Sorry!</h2>
            <p className="text-sm text-muted-foreground">
              We'll create a support ticket for you right away. Our team will investigate and resolve this.
            </p>
            <div className="bg-muted rounded-lg p-3 text-left text-sm space-y-1">
              <p><span className="text-muted-foreground">Item:</span> <strong className="text-foreground">{itemName}</strong></p>
              <p><span className="text-muted-foreground">Locker:</span> <strong className="text-foreground">#{lockerNumber.padStart(2, "0")}</strong></p>
              <p><span className="text-muted-foreground">Machine:</span> <strong className="text-foreground">{machineCode}</strong></p>
            </div>
            <Textarea
              placeholder="Describe what happened (optional)"
              value={ticketNotes}
              onChange={(e) => setTicketNotes(e.target.value)}
              className="resize-none"
              rows={3}
            />
            <Button
              onClick={handleSubmitTicket}
              disabled={submitting}
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
              Submit Support Ticket
            </Button>
          </>
        )}

        {/* Step 5: Done */}
        {step === "done" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-accent/20 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-accent" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Thank You!</h2>
            <p className="text-muted-foreground">Enjoy your snack and the great outdoors 🌿</p>
            <Button
              onClick={() => window.location.href = "/"}
              variant="outline"
              className="w-full"
            >
              Back to Home
            </Button>
            <EcoSnackBadge />
          </>
        )}
      </CardContent>
    </Card>
  );
};

const StepItem = ({ number, text, detail }: { number: number; text: string; detail: string }) => (
  <div className="flex gap-3">
    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
      <span className="text-sm font-bold text-accent">{number}</span>
    </div>
    <div>
      <p className="font-medium text-foreground text-sm">{text}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  </div>
);

const EcoSnackBadge = () => (
  <div className="flex items-center justify-center gap-1 text-xs text-accent/60 pt-2">
    <Leaf className="h-3 w-3" />
    <span>EcoSnack by VendX</span>
  </div>
);

export default EcoSnackPostPaymentFlow;
