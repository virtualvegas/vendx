import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  addon_ids: string[];
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    images: string[];
    is_subscription: boolean;
    subscription_price: number | null;
  } | null;
  addons: { id: string; name: string; price: number }[];
  itemTotal: number;
}

interface CartContextType {
  cartItems: CartItem[];
  cartCount: number;
  loading: boolean;
  addToCart: (productId: string, quantity: number, addonIds?: string[]) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  getCartTotal: () => number;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const getSessionId = () => {
  let sessionId = localStorage.getItem("vendx_cart_session");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("vendx_cart_session", sessionId);
  }
  return sessionId;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartId, setCartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshCart = useCallback(async () => {
    setLoading(true);
    
    try {
      const sessionId = getSessionId();
      
      // Find or create cart
      let query = supabase.from("store_carts").select("id");
      
      if (user) {
        query = query.eq("user_id", user.id);
      } else {
        query = query.eq("session_id", sessionId).is("user_id", null);
      }
      
      let { data: carts } = await query.limit(1);
      
      let currentCartId = carts?.[0]?.id;
      
      if (!currentCartId && user) {
        // Create cart for logged in user
        const { data: newCart } = await supabase
          .from("store_carts")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        currentCartId = newCart?.id;
      } else if (!currentCartId) {
        // Create anonymous cart
        const { data: newCart } = await supabase
          .from("store_carts")
          .insert({ session_id: sessionId })
          .select("id")
          .single();
        currentCartId = newCart?.id;
      }
      
      setCartId(currentCartId);
      
      if (currentCartId) {
        // Fetch cart items with product details
        const { data: items } = await supabase
          .from("store_cart_items")
          .select(`
            id,
            product_id,
            quantity,
            addon_ids,
            product:store_products (
              id, name, slug, price, images, is_subscription, subscription_price
            )
          `)
          .eq("cart_id", currentCartId);
        
        if (items) {
          // Fetch addon details for each item
          const itemsWithAddons = await Promise.all(items.map(async (item: any) => {
            let addons: { id: string; name: string; price: number }[] = [];
            if (item.addon_ids && item.addon_ids.length > 0) {
              const { data: addonData } = await supabase
                .from("store_product_addons")
                .select("id, name, price")
                .in("id", item.addon_ids);
              addons = addonData || [];
            }
            
            const basePrice = item.product?.is_subscription 
              ? (item.product?.subscription_price || item.product?.price)
              : item.product?.price || 0;
            const addonsTotal = addons.reduce((sum, a) => sum + a.price, 0);
            
            return {
              ...item,
              addons,
              itemTotal: basePrice + addonsTotal
            };
          }));
          
          setCartItems(itemsWithAddons);
        }
      }
    } catch (error) {
      console.error("Error fetching cart:", error);
    }
    
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = async (productId: string, quantity: number, addonIds: string[] = []) => {
    if (!cartId) {
      await refreshCart();
    }
    
    const currentCartId = cartId;
    if (!currentCartId) return;
    
    // Check if product already in cart
    const existingItem = cartItems.find(item => 
      item.product_id === productId && 
      JSON.stringify(item.addon_ids.sort()) === JSON.stringify(addonIds.sort())
    );
    
    if (existingItem) {
      await updateQuantity(existingItem.id, existingItem.quantity + quantity);
    } else {
      await supabase.from("store_cart_items").insert({
        cart_id: currentCartId,
        product_id: productId,
        quantity,
        addon_ids: addonIds
      });
      await refreshCart();
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) {
      await removeFromCart(itemId);
      return;
    }
    
    await supabase
      .from("store_cart_items")
      .update({ quantity })
      .eq("id", itemId);
    
    await refreshCart();
  };

  const removeFromCart = async (itemId: string) => {
    await supabase.from("store_cart_items").delete().eq("id", itemId);
    await refreshCart();
  };

  const clearCart = async () => {
    if (!cartId) return;
    await supabase.from("store_cart_items").delete().eq("cart_id", cartId);
    await refreshCart();
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + (item.itemTotal * item.quantity), 0);
  };

  const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      cartItems,
      cartCount,
      loading,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      getCartTotal,
      refreshCart
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
