import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Minus, Plus, ArrowLeft, Package, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSEO } from "@/hooks/useSEO";
import { useShopifyProduct } from "@/hooks/useShopifyProducts";
import { useShopifyCartStore, ShopifyProduct } from "@/stores/shopifyCartStore";
import { ShopifyCartDrawer } from "@/components/store/ShopifyCartDrawer";

const ShopifyProductPage = () => {
  const { handle } = useParams();
  const { product, loading, error } = useShopifyProduct(handle);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  
  const addItem = useShopifyCartStore(state => state.addItem);
  const isAddingToCart = useShopifyCartStore(state => state.isLoading);

  const selectedVariant = product?.variants.edges[selectedVariantIndex]?.node;
  const price = selectedVariant ? parseFloat(selectedVariant.price.amount) : 0;
  const compareAtPrice = selectedVariant?.compareAtPrice ? parseFloat(selectedVariant.compareAtPrice.amount) : 0;
  const isOnSale = compareAtPrice > price;
  const currencyCode = selectedVariant?.price.currencyCode || 'USD';

  // Dynamic SEO
  useSEO({
    title: product?.title,
    description: product?.description?.slice(0, 160),
    image: product?.images?.edges?.[0]?.node?.url,
    type: "product",
    price: price,
    currency: currencyCode,
    availability: selectedVariant?.availableForSale ? "in stock" : "out of stock",
    category: product?.productType,
  });

  const handleAddToCart = async () => {
    if (!product || !selectedVariant) return;
    
    // Create a ShopifyProduct wrapper for the store
    const productWrapper: ShopifyProduct = {
      node: product
    };

    await addItem({
      product: productWrapper,
      variantId: selectedVariant.id,
      variantTitle: selectedVariant.title,
      price: selectedVariant.price,
      quantity,
      selectedOptions: selectedVariant.selectedOptions || []
    });
    
    toast.success(`${product.title} added to cart!`);
  };

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

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-24 pb-12 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
          <p className="text-muted-foreground mb-6">{error || "The product you're looking for doesn't exist."}</p>
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

  const images = product.images.edges.map(e => e.node);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        {/* Breadcrumb and Cart */}
        <div className="mb-6 flex justify-between items-center">
          <Link to="/store" className="text-primary hover:underline flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Store
          </Link>
          <ShopifyCartDrawer />
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div className="space-y-4">
            <div className="aspect-square rounded-xl overflow-hidden bg-card border border-border">
              <img
                src={images[selectedImage]?.url || "https://via.placeholder.com/600"}
                alt={images[selectedImage]?.altText || product.title}
                className="w-full h-full object-cover"
              />
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 flex-shrink-0 ${
                      selectedImage === idx ? "border-primary" : "border-border"
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {product.productType && (
                <Badge variant="outline" className="capitalize">{product.productType}</Badge>
              )}
              {isOnSale && (
                <Badge className="bg-destructive">Sale</Badge>
              )}
              {!selectedVariant?.availableForSale && (
                <Badge className="bg-muted text-muted-foreground">Out of Stock</Badge>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4">{product.title}</h1>
            
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl font-bold text-primary">
                {currencyCode} {price.toFixed(2)}
              </span>
              {isOnSale && (
                <span className="text-xl text-muted-foreground line-through">
                  {currencyCode} {compareAtPrice.toFixed(2)}
                </span>
              )}
            </div>

            <p className="text-muted-foreground mb-6 leading-relaxed">
              {product.description}
            </p>

            {/* Variant Selection */}
            {product.options && product.options.length > 0 && product.options[0].values.length > 1 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Options</h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants.edges.map((variant, idx) => (
                    <Button
                      key={variant.node.id}
                      variant={selectedVariantIndex === idx ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedVariantIndex(idx)}
                      disabled={!variant.node.availableForSale}
                    >
                      {variant.node.selectedOptions.map(o => o.value).join(' / ')}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity selector */}
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
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Total and Add to Cart */}
            <div className="border-t border-border pt-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-medium">Total:</span>
                <span className="text-2xl font-bold text-primary">
                  {currencyCode} {(price * quantity).toFixed(2)}
                </span>
              </div>
              
              <Button 
                className="w-full h-12 text-lg" 
                onClick={handleAddToCart}
                disabled={isAddingToCart || !selectedVariant?.availableForSale}
              >
                {isAddingToCart ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <ShoppingCart className="h-5 w-5 mr-2" />
                )}
                Add to Cart
              </Button>

              {/* Features */}
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-accent" />
                  Secure checkout via Shopify
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-accent" />
                  Free shipping on orders over $50
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ShopifyProductPage;