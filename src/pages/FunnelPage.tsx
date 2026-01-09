import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useCart } from "@/hooks/useCart";
import { ShoppingCart, Check, ArrowRight, ArrowLeft, Package, Sparkles } from "lucide-react";

interface FunnelStep {
  id: string;
  step_order: number;
  step_type: string;
  title: string;
  description: string | null;
  is_required: boolean;
}

interface FunnelProduct {
  id: string;
  product_id: string;
  custom_price: number | null;
  custom_name: string | null;
  discount_percentage: number;
  is_featured: boolean;
  quantity_limit: number | null;
  product: {
    id: string;
    name: string;
    price: number;
    images: string[];
    description: string | null;
  };
}

interface FunnelAddon {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
}

interface Funnel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  funnel_type: string;
}

export default function FunnelPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepProducts, setStepProducts] = useState<FunnelProduct[]>([]);
  const [stepAddons, setStepAddons] = useState<FunnelAddon[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection state
  const [selectedProducts, setSelectedProducts] = useState<Map<string, { product: FunnelProduct; quantity: number }>>(new Map());
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (slug) {
      fetchFunnel();
    }
  }, [slug]);

  useEffect(() => {
    if (steps[currentStepIndex]) {
      fetchStepContent(steps[currentStepIndex].id);
    }
  }, [currentStepIndex, steps]);

  const fetchFunnel = async () => {
    const { data: funnelData, error } = await supabase
      .from('store_funnels')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !funnelData) {
      navigate('/store');
      return;
    }

    setFunnel(funnelData);

    // Fetch steps
    const { data: stepsData } = await supabase
      .from('store_funnel_steps')
      .select('*')
      .eq('funnel_id', funnelData.id)
      .order('step_order');

    setSteps(stepsData || []);
    setLoading(false);

    // Track funnel analytics
    const sessionId = localStorage.getItem('funnel_session') || crypto.randomUUID();
    localStorage.setItem('funnel_session', sessionId);
    
    await supabase.from('store_funnel_analytics').insert([{
      funnel_id: funnelData.id,
      session_id: sessionId,
      step_reached: 1,
    }]);
  };

  const fetchStepContent = async (stepId: string) => {
    const [productsRes, addonsRes] = await Promise.all([
      supabase
        .from('store_funnel_products')
        .select(`
          *,
          product:store_products(id, name, price, images, description)
        `)
        .eq('funnel_step_id', stepId)
        .order('display_order'),
      supabase
        .from('store_funnel_addons')
        .select('*')
        .eq('funnel_step_id', stepId)
        .eq('is_active', true)
        .order('display_order'),
    ]);

    setStepProducts(productsRes.data || []);
    setStepAddons(addonsRes.data || []);
  };

  const currentStep = steps[currentStepIndex];
  const progress = steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;

  const getPrice = (fp: FunnelProduct) => {
    const basePrice = fp.custom_price ?? fp.product.price;
    if (fp.discount_percentage > 0) {
      return basePrice * (1 - fp.discount_percentage / 100);
    }
    return basePrice;
  };

  const toggleProduct = (fp: FunnelProduct) => {
    const newSelected = new Map(selectedProducts);
    if (newSelected.has(fp.product_id)) {
      newSelected.delete(fp.product_id);
    } else {
      newSelected.set(fp.product_id, { product: fp, quantity: 1 });
    }
    setSelectedProducts(newSelected);
  };

  const updateQuantity = (productId: string, delta: number) => {
    const newSelected = new Map(selectedProducts);
    const item = newSelected.get(productId);
    if (item) {
      const newQty = item.quantity + delta;
      const limit = item.product.quantity_limit;
      if (newQty <= 0) {
        newSelected.delete(productId);
      } else if (!limit || newQty <= limit) {
        item.quantity = newQty;
      }
    }
    setSelectedProducts(newSelected);
  };

  const toggleAddon = (addonId: string) => {
    const newSelected = new Set(selectedAddons);
    if (newSelected.has(addonId)) {
      newSelected.delete(addonId);
    } else {
      newSelected.add(addonId);
    }
    setSelectedAddons(newSelected);
  };

  const canProceed = () => {
    if (!currentStep?.is_required) return true;
    if (currentStep.step_type === 'product' || currentStep.step_type === 'upsell' || currentStep.step_type === 'cross-sell') {
      return selectedProducts.size > 0;
    }
    return true;
  };

  const handleNext = async () => {
    if (!canProceed()) {
      toast.error('Please make a selection to continue');
      return;
    }

    // Track progress
    if (funnel) {
      const sessionId = localStorage.getItem('funnel_session');
      await supabase.from('store_funnel_analytics').insert([{
        funnel_id: funnel.id,
        session_id: sessionId,
        step_reached: currentStepIndex + 2,
      }]);
    }

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // Complete funnel - add to cart
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleComplete = async () => {
    // Add all selected products to cart
    for (const [_, item] of selectedProducts) {
      const fp = item.product;
      for (let i = 0; i < item.quantity; i++) {
        await addToCart(fp.product.id, 1, []);
      }
    }

    // Track completion
    if (funnel) {
      const sessionId = localStorage.getItem('funnel_session');
      const totalValue = Array.from(selectedProducts.values()).reduce(
        (sum, item) => sum + getPrice(item.product) * item.quantity, 0
      ) + Array.from(selectedAddons).reduce((sum, addonId) => {
        const addon = stepAddons.find(a => a.id === addonId);
        return sum + (addon?.price || 0);
      }, 0);

      await supabase.from('store_funnel_analytics').insert([{
        funnel_id: funnel.id,
        session_id: sessionId,
        step_reached: steps.length,
        completed: true,
        total_value: totalValue,
      }]);
    }

    toast.success('Added to cart!');
    navigate('/store/cart');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-full max-w-md mb-8" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!funnel || steps.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-24 pb-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Funnel not found</h1>
          <Button onClick={() => navigate('/store')}>Go to Store</Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">{funnel.name}</h1>
            {funnel.description && (
              <p className="text-muted-foreground">{funnel.description}</p>
            )}
          </div>

          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
              <span className="text-sm font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between mt-2">
              {steps.map((step, i) => (
                <div
                  key={step.id}
                  className={`text-xs ${i <= currentStepIndex ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                >
                  {step.title}
                </div>
              ))}
            </div>
          </div>

          {/* Current Step */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                  {currentStepIndex + 1}
                </div>
                <div>
                  <CardTitle>{currentStep.title}</CardTitle>
                  {currentStep.description && (
                    <CardDescription>{currentStep.description}</CardDescription>
                  )}
                </div>
                {currentStep.is_required && (
                  <Badge variant="secondary" className="ml-auto">Required</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Products */}
              {stepProducts.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
                  {stepProducts.map((fp) => {
                    const isSelected = selectedProducts.has(fp.product_id);
                    const originalPrice = fp.product.price;
                    const finalPrice = getPrice(fp);
                    const hasDiscount = fp.discount_percentage > 0 || (fp.custom_price && fp.custom_price < originalPrice);

                    return (
                      <Card
                        key={fp.id}
                        className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover:shadow-lg'}`}
                        onClick={() => toggleProduct(fp)}
                      >
                        {fp.product.images?.[0] && (
                          <div className="aspect-square overflow-hidden relative">
                            <img
                              src={fp.product.images[0]}
                              alt={fp.custom_name || fp.product.name}
                              className="w-full h-full object-cover"
                            />
                            {fp.is_featured && (
                              <Badge className="absolute top-2 left-2 bg-yellow-500">
                                <Sparkles className="h-3 w-3 mr-1" /> Featured
                              </Badge>
                            )}
                            {hasDiscount && (
                              <Badge className="absolute top-2 right-2 bg-red-500">
                                {fp.discount_percentage > 0 ? `-${fp.discount_percentage}%` : 'Sale'}
                              </Badge>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                                  <Check className="h-6 w-6 text-primary-foreground" />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        <CardContent className="p-4">
                          <h3 className="font-bold mb-1">{fp.custom_name || fp.product.name}</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-primary">${finalPrice.toFixed(2)}</span>
                            {hasDiscount && (
                              <span className="text-sm text-muted-foreground line-through">${originalPrice.toFixed(2)}</span>
                            )}
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="outline" onClick={() => updateQuantity(fp.product_id, -1)}>-</Button>
                              <span className="w-8 text-center">{selectedProducts.get(fp.product_id)?.quantity}</span>
                              <Button size="sm" variant="outline" onClick={() => updateQuantity(fp.product_id, 1)}>+</Button>
                              {fp.quantity_limit && (
                                <span className="text-xs text-muted-foreground">Max: {fp.quantity_limit}</span>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Add-ons */}
              {stepAddons.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Optional Add-ons</h4>
                  <div className="space-y-2">
                    {stepAddons.map((addon) => (
                      <div
                        key={addon.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedAddons.has(addon.id) ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'}`}
                        onClick={() => toggleAddon(addon.id)}
                      >
                        <Checkbox checked={selectedAddons.has(addon.id)} />
                        <div className="flex-1">
                          <p className="font-medium">{addon.name}</p>
                          {addon.description && (
                            <p className="text-sm text-muted-foreground">{addon.description}</p>
                          )}
                        </div>
                        <span className="font-bold">+${addon.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStepIndex === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {selectedProducts.size} item(s) selected
              </p>
              <p className="font-bold">
                Total: ${Array.from(selectedProducts.values()).reduce(
                  (sum, item) => sum + getPrice(item.product) * item.quantity, 0
                ).toFixed(2)}
              </p>
            </div>

            <Button onClick={handleNext} disabled={!canProceed()}>
              {currentStepIndex === steps.length - 1 ? (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" /> Add to Cart
                </>
              ) : (
                <>
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
