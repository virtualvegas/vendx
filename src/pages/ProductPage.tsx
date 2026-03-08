import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Minus, Plus, ArrowLeft, Package, Check, Loader2, ExternalLink } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useShopifyProduct } from "@/hooks/useShopifyProducts";
import { useShopifyCartStore } from "@/stores/shopifyCartStore";
import { toast } from "sonner";
import { useSEO } from "@/hooks/useSEO";
import RetailLinks from "@/components/store/RetailLinks";
import type { Json } from "@/integrations/supabase/types";

interface RetailLink {
  store: string;
  url: string;
  link_type?: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  price: number;
  compare_at_price: number | null;
  category: string;
  images: string[];
  stock: number;
  is_subscription: boolean;
  subscription_interval: string | null;
  subscription_price: number | null;
  retail_links: Json | null;
  retail_status: string | null;
  shopify_handle: string | null;
  shopify_variant_id: string | null;
}

const getRetailStatusBadge = (status: string | null) => {
  switch (status) {
    case "in_store_and_online":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          In Store & Online
        </Badge>
      );
    case "in_store_only":
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30">
          In Store Only
        </Badge>
      );
    case "online_only":
    default:
      return (
        <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">
          Online Only
        </Badge>
      );
  }
};

interface Addon {
  id: string;
  name: string;
  description: string;
  price: number;
}

const ProductPage = () => {
  const { slug } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const { addToCart, cartCount } = useCart();
  const shopifyCartStore = useShopifyCartStore();

  // Fetch linked Shopify product data when product has shopify_handle
  const { product: shopifyProduct } = useShopifyProduct(product?.shopify_handle || undefined);

  // Dynamic SEO for product sharing
  useSEO({
    title: product?.name,
    description: product?.short_description || product?.description?.slice(0, 160),
    image: product?.images?.[0],
    type: "product",
    price: product?.is_subscription ? product?.subscription_price || product?.price : product?.price,
    currency: "USD",
    availability: product?.stock === null || product?.stock > 0 ? "in stock" : "out of stock",
    category: product?.category,
  });

  useEffect(() => {
    if (slug) {
      fetchProduct();
    }
  }, [slug]);

  const fetchProduct = async () => {
    setLoading(true);
    const { data: productData, error } = await supabase
      .from("store_products")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (!error && productData) {
      setProduct(productData);
      
      // Fetch addons if subscription product
      if (productData.is_subscription) {
        const { data: addonData } = await supabase
          .from("store_product_addons")
          .select("*")
          .eq("product_id", productData.id)
          .eq("is_active", true);
        
        if (addonData) {
          setAddons(addonData);
        }
      }
    }
    setLoading(false);
  };

  const handleAddonToggle = (addonId: string) => {
    setSelectedAddons(prev => 
      prev.includes(addonId) 
        ? prev.filter(id => id !== addonId)
        : [...prev, addonId]
    );
  };

  const calculateTotal = () => {
    if (!product) return 0;
    const basePrice = product.is_subscription ? (product.subscription_price || product.price) : product.price;
    const addonsTotal = addons
      .filter(a => selectedAddons.includes(a.id))
      .reduce((sum, a) => sum + a.price, 0);
    return (basePrice + addonsTotal) * quantity;
  };

  const isShopifyLinked = !!product?.shopify_handle && !!shopifyProduct;

  const handleAddToCart = async () => {
    if (!product) return;
    setAdding(true);
    
    try {
      if (isShopifyLinked && shopifyProduct) {
        // Use Shopify cart for linked products
        const firstVariant = shopifyProduct.variants.edges[0]?.node;
        if (!firstVariant) {
          toast.error("No Shopify variant available");
          setAdding(false);
          return;
        }
        await shopifyCartStore.addItem({
          product: { node: shopifyProduct },
          variantId: product.shopify_variant_id || firstVariant.id,
          variantTitle: firstVariant.title,
          price: firstVariant.price,
          quantity,
          selectedOptions: firstVariant.selectedOptions || [],
        });
        toast.success(`${product.name} added to Shopify cart!`);
      } else {
        await addToCart(product.id, quantity, selectedAddons);
        toast.success(`${product.name} added to cart!`);
      }
    } catch (error) {
      toast.error("Failed to add to cart");
    }
    
    setAdding(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="animate-pulse grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-muted rounded-xl" />
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-12 bg-muted rounded w-1/3 mt-8" />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-24 pb-12 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
          <p className="text-muted-foreground mb-6">The product you're looking for doesn't exist.</p>
          <Link to="/store">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Store
            </Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link to="/store" className="text-primary hover:underline flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Store
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          {(() => {
            const displayImages = isShopifyLinked && shopifyProduct?.images?.edges?.length
              ? shopifyProduct.images.edges.map(e => e.node.url)
              : product.images;
            return (
            <div className="space-y-4">
            <div className="aspect-square rounded-xl overflow-hidden bg-card border border-border">
              <img
                src={displayImages[selectedImage] || "https://via.placeholder.com/600"}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            {displayImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {displayImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 flex-shrink-0 ${
                      selectedImage === idx ? "border-primary" : "border-border"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="outline" className="capitalize">{product.category}</Badge>
              {product.is_subscription && (
                <Badge className="bg-accent text-accent-foreground">Subscription</Badge>
              )}
              {isShopifyLinked && (
                <Badge className="bg-primary/20 text-primary border border-primary/30">
                  <ShoppingCart className="h-3 w-3 mr-1" />
                  Shopify
                </Badge>
              )}
              {product.compare_at_price && product.compare_at_price > product.price && (
                <Badge className="bg-destructive">Sale</Badge>
              )}
              {getRetailStatusBadge(product.retail_status)}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4">{product.name}</h1>
            
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl font-bold text-primary">
                ${product.is_subscription ? product.subscription_price?.toFixed(2) : product.price.toFixed(2)}
              </span>
              {product.is_subscription && (
                <span className="text-muted-foreground">/month</span>
              )}
              {product.compare_at_price && product.compare_at_price > product.price && (
                <span className="text-xl text-muted-foreground line-through">
                  ${product.compare_at_price.toFixed(2)}
                </span>
              )}
            </div>

            <p className="text-muted-foreground mb-6 leading-relaxed">
              {product.description}
            </p>

            {/* Add-ons for subscription products */}
            {product.is_subscription && addons.length > 0 && (
              <Card className="bg-card/50 border-border mb-6">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Customize Your Box</h3>
                  <div className="space-y-3">
                    {addons.map((addon) => (
                      <div 
                        key={addon.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedAddons.includes(addon.id) 
                            ? "border-primary bg-primary/10" 
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => handleAddonToggle(addon.id)}
                      >
                        <Checkbox 
                          checked={selectedAddons.includes(addon.id)}
                          onCheckedChange={() => handleAddonToggle(addon.id)}
                        />
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <Label className="font-medium cursor-pointer">{addon.name}</Label>
                            <span className="text-primary font-semibold">+${addon.price.toFixed(2)}/mo</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{addon.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quantity selector (not for subscriptions) */}
            {!product.is_subscription && (
              <div className="flex items-center gap-4 mb-6">
                <span className="text-sm font-medium">Quantity:</span>
                <div className="flex items-center gap-2 bg-card border border-border rounded-lg">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-semibold">{quantity}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setQuantity(quantity + 1)}
                    disabled={product.stock !== null && quantity >= product.stock}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {product.stock !== null && product.stock < 10 && (
                  <span className="text-sm text-orange-500">Only {product.stock} left!</span>
                )}
              </div>
            )}

            {/* Total and Add to Cart */}
            <div className="border-t border-border pt-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-medium">Total:</span>
                <span className="text-2xl font-bold text-primary">
                  ${calculateTotal().toFixed(2)}
                  {product.is_subscription && <span className="text-sm font-normal text-muted-foreground">/month</span>}
                </span>
              </div>
              
              <Button 
                className="w-full h-12 text-lg" 
                onClick={handleAddToCart}
                disabled={adding || (product.stock !== null && product.stock < 1)}
              >
                {adding ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : isShopifyLinked ? (
                  <ExternalLink className="h-5 w-5 mr-2" />
                ) : (
                  <ShoppingCart className="h-5 w-5 mr-2" />
                )}
                {product.is_subscription ? "Subscribe Now" : isShopifyLinked ? "Add to Cart (Shopify)" : "Add to Cart"}
              </Button>

              {/* Features */}
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-accent" />
                  Free shipping on orders over $50
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-accent" />
                  Earn VendX reward points on every purchase
                </div>
                {product.is_subscription && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-accent" />
                    Cancel or pause anytime
                  </div>
                )}
              </div>

              {/* Retail Store Links */}
              {product.retail_links && Array.isArray(product.retail_links) && product.retail_links.length > 0 && (
                <div className="mt-6">
                  <RetailLinks links={product.retail_links as unknown as RetailLink[]} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cart FAB */}
      <Link 
        to="/store/cart"
        className="fixed bottom-6 right-6 z-50"
      >
        <Button size="lg" className="rounded-full h-14 w-14 shadow-lg relative">
          <ShoppingCart className="h-6 w-6" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </Button>
      </Link>

      <Footer />
    </div>
  );
};

export default ProductPage;
