import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Minus, Plus, Trash2, ArrowLeft, ArrowRight, Loader2, ShoppingBag } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import PaymentMethodSelector, { PaymentMethod } from "@/components/payment/PaymentMethodSelector";

const CartPage = () => {
  const navigate = useNavigate();
  const { cartItems, loading, updateQuantity, removeFromCart, getCartTotal, refreshCart } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const [walletBalance, setWalletBalance] = useState<number>(0);

  // Check if cart has subscription items (PayPal and VendX Pay don't support subscriptions)
  const hasSubscription = cartItems.some(item => item.product?.is_subscription);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        // Fetch wallet balance
        supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", data.user.id)
          .maybeSingle()
          .then(({ data: wallet }) => {
            if (wallet) setWalletBalance(wallet.balance);
          });
      }
    });
  }, []);

  const handleCheckout = async () => {
    if (!user) {
      toast.error("Please sign in to checkout");
      navigate("/auth?redirect=/store/cart");
      return;
    }

    if (paymentMethod === "paypal" && hasSubscription) {
      toast.error("PayPal is not available for subscription products. Please use Debit/Credit.");
      return;
    }

    if (paymentMethod === "vendx" && hasSubscription) {
      toast.error("VendX Pay is not available for subscription products. Please use Debit/Credit.");
      return;
    }

    const total = getCartTotal() + (getCartTotal() > 50 ? 0 : 5.99);
    if (paymentMethod === "vendx" && walletBalance < total) {
      toast.error(`Insufficient wallet balance. You need $${total.toFixed(2)} but have $${walletBalance.toFixed(2)}.`);
      return;
    }

    setCheckingOut(true);
    
    try {
      if (paymentMethod === "vendx") {
        // Process VendX Pay checkout
        const { data, error } = await supabase.functions.invoke("store-vendx-pay-checkout", {
          body: { cartItems }
        });

        if (error) throw error;
        
        if (data?.success) {
          toast.success("Order placed successfully!");
          refreshCart();
          navigate(`/store/order-success?order=${data.orderNumber}`);
        } else {
          throw new Error(data?.error || "Failed to process payment");
        }
      } else {
        const functionName = paymentMethod === "paypal" ? "store-paypal-checkout" : "store-create-checkout";
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { cartItems }
        });

        if (error) throw error;
        
        if (data?.url) {
          window.location.href = data.url;
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create checkout session");
    }
    
    setCheckingOut(false);
  };

  const subtotal = getCartTotal();
  const shipping = subtotal > 50 ? 0 : 5.99;
  const total = subtotal + shipping;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        <div className="mb-6">
          <Link to="/store" className="text-primary hover:underline flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Continue Shopping
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
          <ShoppingCart className="h-8 w-8 text-primary" />
          Your Cart
        </h1>

        {cartItems.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="h-20 w-20 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">Looks like you haven't added anything yet</p>
            <Link to="/store">
              <Button>
                Start Shopping
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <Card key={item.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img
                          src={item.product?.images?.[0] || "https://via.placeholder.com/100"}
                          alt={item.product?.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-2">
                          <Link to={`/store/${item.product?.slug}`} className="hover:text-primary">
                            <h3 className="font-semibold truncate">{item.product?.name}</h3>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-muted-foreground hover:text-destructive flex-shrink-0"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {item.addons && item.addons.length > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            + {item.addons.map(a => a.name).join(", ")}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2 bg-secondary rounded-lg">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          <div className="text-right">
                            <p className="font-semibold text-primary">
                              ${(item.itemTotal * item.quantity).toFixed(2)}
                            </p>
                            {item.product?.is_subscription && (
                              <p className="text-xs text-muted-foreground">/month</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="bg-card border-border sticky top-24">
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
                    </div>
                    {shipping > 0 && (
                      <p className="text-xs text-accent">
                        Add ${(50 - subtotal).toFixed(2)} more for free shipping!
                      </p>
                    )}
                    <div className="border-t border-border pt-3">
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total</span>
                        <span className="text-primary">${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">Payment Method</p>
                      <PaymentMethodSelector
                        selected={paymentMethod}
                        onSelect={setPaymentMethod}
                        disabled={checkingOut}
                        showVendxPay={!!user}
                        walletBalance={walletBalance}
                      />
                      {hasSubscription && paymentMethod === "paypal" && (
                        <p className="text-xs text-destructive mt-2">
                          PayPal is not available for subscription products
                        </p>
                      )}
                      {hasSubscription && paymentMethod === "vendx" && (
                        <p className="text-xs text-destructive mt-2">
                          VendX Pay is not available for subscription products
                        </p>
                      )}
                      {paymentMethod === "vendx" && walletBalance < (getCartTotal() + (getCartTotal() > 50 ? 0 : 5.99)) && (
                        <p className="text-xs text-destructive mt-2">
                          Insufficient balance. <a href="/wallet" className="underline">Add funds</a>
                        </p>
                      )}
                    </div>

                    <Button 
                      className="w-full h-12" 
                      onClick={handleCheckout}
                      disabled={checkingOut || (hasSubscription && (paymentMethod === "paypal" || paymentMethod === "vendx")) || (paymentMethod === "vendx" && walletBalance < (getCartTotal() + (getCartTotal() > 50 ? 0 : 5.99)))}
                    >
                      {checkingOut ? (
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      ) : (
                        <ArrowRight className="h-5 w-5 mr-2" />
                      )}
                      Proceed to Checkout
                    </Button>

                    {!user && (
                      <p className="text-xs text-muted-foreground text-center">
                        You'll need to sign in to complete your purchase
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default CartPage;
