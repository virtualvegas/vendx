import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Package, ArrowRight, Gift, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";

const OrderSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id");
  const isPayPal = searchParams.get("paypal") === "true";
  const paypalToken = searchParams.get("token");
  const [showConfetti, setShowConfetti] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(!isPayPal);

  // Handle PayPal capture
  useEffect(() => {
    const capturePayPalOrder = async () => {
      if (isPayPal && paypalToken && !orderComplete) {
        setProcessing(true);
        try {
          const { data, error } = await supabase.functions.invoke("paypal-capture", {
            body: { orderId: paypalToken, type: "store_order" }
          });
          
          if (error) throw error;
          
          if (data?.success) {
            setOrderComplete(true);
            toast.success("Payment confirmed!");
          } else {
            throw new Error("Payment capture failed");
          }
        } catch (error: any) {
          console.error("PayPal capture error:", error);
          toast.error(error.message || "Failed to process payment");
          navigate("/store/cart");
        } finally {
          setProcessing(false);
        }
      }
    };
    
    capturePayPalOrder();
  }, [isPayPal, paypalToken, orderComplete, navigate]);

  useEffect(() => {
    if (orderComplete && !showConfetti) {
      setShowConfetti(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2563eb', '#00ff88', '#ffffff']
      });
    }
  }, [orderComplete, showConfetti]);

  if (processing) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="max-w-2xl mx-auto text-center">
            <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-primary" />
            <h1 className="text-2xl font-bold mb-2">Processing Your Payment</h1>
            <p className="text-muted-foreground">Please wait while we confirm your PayPal payment...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8">
            <div className="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-accent" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Order Confirmed!</h1>
            <p className="text-xl text-muted-foreground">
              Thank you for your purchase. Your order is being processed.
            </p>
          </div>

          <Card className="bg-card border-border mb-8">
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="flex items-center justify-center gap-4 text-left">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Order Processing</h3>
                    <p className="text-sm text-muted-foreground">
                      You'll receive an email confirmation shortly with your order details.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4 text-left">
                  <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Gift className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Reward Points Earned</h3>
                    <p className="text-sm text-muted-foreground">
                      You've earned VendX reward points on this purchase! Check your wallet.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/store">
              <Button variant="outline">
                Continue Shopping
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button>
                View Order History
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default OrderSuccessPage;
