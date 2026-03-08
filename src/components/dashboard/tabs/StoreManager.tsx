import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Package, Plus, Edit, Trash2, ShoppingCart, DollarSign, 
  Users, TrendingUp, Eye, Loader2, RefreshCw, Search, Link as LinkIcon, X 
} from "lucide-react";
import { formatDisplayDate } from "@/lib/dateUtils";
import { AVAILABLE_STORES } from "@/components/store/RetailLinks";
import { useShopifyProducts, ShopifyProduct } from "@/hooks/useShopifyProducts";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  category: string;
  stock: number;
  is_active: boolean;
  is_featured: boolean;
  is_subscription: boolean;
  created_at: string;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  subtotal: number;
  shipping_cost: number;
  wallet_credit_applied: number;
  created_at: string;
  user_id: string;
  tracking_number: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  estimated_delivery: string | null;
  admin_notes: string | null;
  customer_email: string | null;
  customer_name: string | null;
  shopify_order_id: string | null;
  shopify_order_number: string | null;
  profiles?: { email: string; full_name: string } | null;
  store_order_items?: Array<{ id: string; product_name: string; product_price: number; quantity: number; total: number; addon_details: any }>;
}

interface Subscription {
  id: string;
  status: string;
  created_at: string;
  user_id: string;
  product_id: string;
  store_products?: { name: string } | null;
  profiles?: { email: string; full_name: string } | null;
}

const categories = ["subscriptions", "apparel", "accessories", "snacks", "tech"];

const StoreManager = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingForm, setTrackingForm] = useState({ tracking_number: "", tracking_url: "", estimated_delivery: "", admin_notes: "" });
  const [stats, setStats] = useState({ totalProducts: 0, totalOrders: 0, revenue: 0, subscribers: 0 });
  
  const [productForm, setProductForm] = useState({
    name: "",
    slug: "",
    description: "",
    short_description: "",
    price: 0,
    category: "apparel",
    stock: 0,
    is_active: true,
    is_featured: false,
    is_subscription: false,
    subscription_price: 0,
    images: [""],
    retail_status: "online_only" as string,
    retail_links: [] as Array<{ store: string; url: string; link_type: string }>,
    shopify_handle: "" as string,
    shopify_variant_id: "" as string,
  });

  const { products: shopifyProducts, loading: shopifyLoading } = useShopifyProducts();
  const [shopifySearch, setShopifySearch] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch products
    const { data: productsData } = await supabase
      .from("store_products")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (productsData) setProducts(productsData);

    // Fetch orders with items and profiles
    const { data: ordersData } = await supabase
      .from("store_orders")
      .select(`*, store_order_items(id, product_name, product_price, quantity, total, addon_details), profiles:user_id(email, full_name)`)
      .order("created_at", { ascending: false })
      .limit(100);
    
    if (ordersData) setOrders(ordersData as any);

    // Fetch subscriptions
    const { data: subsData } = await supabase
      .from("store_subscriptions")
      .select("*, store_products(name)")
      .order("created_at", { ascending: false });
    
    if (subsData) setSubscriptions(subsData as any);

    // Calculate stats
    const totalRevenue = ordersData?.reduce((sum, o) => sum + Number(o.total), 0) || 0;
    const activeSubscribers = subsData?.filter(s => s.status === "active").length || 0;
    
    setStats({
      totalProducts: productsData?.length || 0,
      totalOrders: ordersData?.length || 0,
      revenue: totalRevenue,
      subscribers: activeSubscribers
    });

    setLoading(false);
  };

  const resetProductForm = () => {
    setProductForm({
      name: "",
      slug: "",
      description: "",
      short_description: "",
      price: 0,
      category: "apparel",
      stock: 0,
      is_active: true,
      is_featured: false,
      is_subscription: false,
      subscription_price: 0,
      images: [""],
      retail_status: "online_only",
      retail_links: [],
      shopify_handle: "",
      shopify_variant_id: "",
    });
    setEditingProduct(null);
  };

  const handleEditProduct = async (product: Product) => {
    setEditingProduct(product);
    // Fetch full product data including retail fields
    const { data: fullProduct } = await supabase
      .from("store_products")
      .select("*")
      .eq("id", product.id)
      .single();
    
    const retailLinks = Array.isArray(fullProduct?.retail_links) 
      ? (fullProduct.retail_links as any[]).map((l: any) => ({ store: l.store || "", url: l.url || "", link_type: l.link_type || "product_url" }))
      : [];
    
    setProductForm({
      name: product.name,
      slug: product.slug,
      description: fullProduct?.description || "",
      short_description: fullProduct?.short_description || "",
      price: product.price,
      category: product.category,
      stock: product.stock,
      is_active: product.is_active,
      is_featured: product.is_featured,
      is_subscription: product.is_subscription,
      subscription_price: fullProduct?.subscription_price || 0,
      images: fullProduct?.images?.length ? fullProduct.images : [""],
      retail_status: fullProduct?.retail_status || "online_only",
      retail_links: retailLinks,
      shopify_handle: (fullProduct as any)?.shopify_handle || "",
      shopify_variant_id: (fullProduct as any)?.shopify_variant_id || "",
    });
    setProductDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    const slug = productForm.slug || productForm.name.toLowerCase().replace(/\s+/g, "-");
    
    const productData = {
      name: productForm.name,
      slug,
      description: productForm.description,
      short_description: productForm.short_description,
      price: productForm.price,
      category: productForm.category,
      stock: productForm.stock,
      is_active: productForm.is_active,
      is_featured: productForm.is_featured,
      is_subscription: productForm.is_subscription,
      subscription_price: productForm.is_subscription ? productForm.subscription_price : null,
      images: productForm.images.filter(img => img.trim() !== ""),
      retail_status: productForm.retail_status,
      retail_links: productForm.retail_links.filter(l => l.store && l.url),
      shopify_handle: productForm.shopify_handle || null,
      shopify_variant_id: productForm.shopify_variant_id || null,
    };

    if (editingProduct) {
      const { error } = await supabase
        .from("store_products")
        .update(productData)
        .eq("id", editingProduct.id);
      
      if (error) {
        toast.error("Failed to update product");
        return;
      }
      toast.success("Product updated");
    } else {
      const { error } = await supabase
        .from("store_products")
        .insert(productData);
      
      if (error) {
        toast.error("Failed to create product");
        return;
      }
      toast.success("Product created");
    }

    setProductDialogOpen(false);
    resetProductForm();
    fetchData();
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    
    const { error } = await supabase.from("store_products").delete().eq("id", id);
    
    if (error) {
      toast.error("Failed to delete product");
      return;
    }
    
    toast.success("Product deleted");
    fetchData();
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase
      .from("store_orders")
      .update({ status })
      .eq("id", orderId);
    
    if (error) {
      toast.error("Failed to update order status");
      return;
    }
    
    toast.success("Order status updated");
    fetchData();
  };

  const handleUpdateTracking = async (orderId: string) => {
    const updates: any = {};
    if (trackingForm.tracking_number) updates.tracking_number = trackingForm.tracking_number;
    if (trackingForm.tracking_url) updates.tracking_url = trackingForm.tracking_url;
    if (trackingForm.estimated_delivery) updates.estimated_delivery = trackingForm.estimated_delivery;
    if (trackingForm.admin_notes) updates.admin_notes = trackingForm.admin_notes;

    const { error } = await supabase
      .from("store_orders")
      .update(updates)
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to update tracking info");
      return;
    }

    toast.success("Tracking info updated");
    setSelectedOrder(null);
    setTrackingForm({ tracking_number: "", tracking_url: "", estimated_delivery: "", admin_notes: "" });
    fetchData();
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setTrackingForm({
      tracking_number: order.tracking_number || "",
      tracking_url: order.tracking_url || "",
      estimated_delivery: order.estimated_delivery || "",
      admin_notes: order.admin_notes || "",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-green-500/20 text-green-400";
      case "shipped": return "bg-blue-500/20 text-blue-400";
      case "delivered": return "bg-accent/20 text-accent";
      case "cancelled": return "bg-destructive/20 text-destructive";
      default: return "bg-yellow-500/20 text-yellow-400";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Store Manager</h2>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Products</p>
                <p className="text-2xl font-bold">{stats.totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Orders</p>
                <p className="text-2xl font-bold">{stats.totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold">${stats.revenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Subscribers</p>
                <p className="text-2xl font-bold">{stats.subscribers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Products</CardTitle>
              <Dialog open={productDialogOpen} onOpenChange={(open) => {
                setProductDialogOpen(open);
                if (!open) resetProductForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Name</Label>
                        <Input 
                          value={productForm.name}
                          onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label>Slug (auto-generated if empty)</Label>
                        <Input 
                          value={productForm.slug}
                          onChange={(e) => setProductForm({...productForm, slug: e.target.value})}
                          placeholder="product-slug"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Short Description</Label>
                      <Input 
                        value={productForm.short_description}
                        onChange={(e) => setProductForm({...productForm, short_description: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Full Description</Label>
                      <Textarea 
                        value={productForm.description}
                        onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Price ($)</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          value={productForm.price}
                          onChange={(e) => setProductForm({...productForm, price: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div>
                        <Label>Category</Label>
                        <Select 
                          value={productForm.category}
                          onValueChange={(v) => setProductForm({...productForm, category: v})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Stock</Label>
                        <Input 
                          type="number"
                          value={productForm.stock}
                          onChange={(e) => setProductForm({...productForm, stock: parseInt(e.target.value) || 0})}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Image URL</Label>
                      <Input 
                        value={productForm.images[0]}
                        onChange={(e) => setProductForm({...productForm, images: [e.target.value]})}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={productForm.is_active}
                          onCheckedChange={(v) => setProductForm({...productForm, is_active: v})}
                        />
                        <Label>Active</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={productForm.is_featured}
                          onCheckedChange={(v) => setProductForm({...productForm, is_featured: v})}
                        />
                        <Label>Featured</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={productForm.is_subscription}
                          onCheckedChange={(v) => setProductForm({...productForm, is_subscription: v})}
                        />
                        <Label>Subscription</Label>
                      </div>
                    </div>
                    {productForm.is_subscription && (
                      <div>
                        <Label>Monthly Price ($)</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          value={productForm.subscription_price}
                          onChange={(e) => setProductForm({...productForm, subscription_price: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                    )}

                    {/* Retail Status */}
                    <div className="border-t border-border pt-4 mt-2">
                      <Label className="text-base font-semibold">Retail Availability</Label>
                      <p className="text-sm text-muted-foreground mb-3">Where can customers buy this product?</p>
                      <Select 
                        value={productForm.retail_status}
                        onValueChange={(v) => setProductForm({...productForm, retail_status: v})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="online_only">Online Only</SelectItem>
                          <SelectItem value="in_store_only">In Store Only</SelectItem>
                          <SelectItem value="in_store_and_online">In Store & Online</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Retail Links */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-base font-semibold">Retail Store Links</Label>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => setProductForm({
                            ...productForm, 
                            retail_links: [...productForm.retail_links, { store: "", url: "", link_type: "product_url" }]
                          })}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add Store
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Link to the product on other retailers or their store locator
                      </p>
                      {productForm.retail_links.map((link, idx) => (
                        <div key={idx} className="flex gap-2 mb-2 items-start">
                          <Select 
                            value={link.store}
                            onValueChange={(v) => {
                              const updated = [...productForm.retail_links];
                              updated[idx] = { ...updated[idx], store: v };
                              setProductForm({...productForm, retail_links: updated});
                            }}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="Store" />
                            </SelectTrigger>
                            <SelectContent>
                              {AVAILABLE_STORES.map(s => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={link.link_type}
                            onValueChange={(v) => {
                              const updated = [...productForm.retail_links];
                              updated[idx] = { ...updated[idx], link_type: v };
                              setProductForm({...productForm, retail_links: updated});
                            }}
                          >
                            <SelectTrigger className="w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="product_url">Product Link</SelectItem>
                              <SelectItem value="store_locator">Store Locator</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input 
                            className="flex-1"
                            value={link.url}
                            onChange={(e) => {
                              const updated = [...productForm.retail_links];
                              updated[idx] = { ...updated[idx], url: e.target.value };
                              setProductForm({...productForm, retail_links: updated});
                            }}
                            placeholder={link.link_type === "store_locator" ? "https://store.com/store-locator" : "https://store.com/product-page"}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive flex-shrink-0"
                            onClick={() => {
                              const updated = productForm.retail_links.filter((_, i) => i !== idx);
                              setProductForm({...productForm, retail_links: updated});
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleSaveProduct} className="w-full">
                    {editingProduct ? "Update Product" : "Create Product"}
                  </Button>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="capitalize">{product.category}</TableCell>
                      <TableCell>${product.price.toFixed(2)}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {product.is_active && <Badge variant="outline" className="text-green-400">Active</Badge>}
                          {product.is_featured && <Badge variant="outline" className="text-primary">Featured</Badge>}
                          {product.is_subscription && <Badge variant="outline" className="text-accent">Sub</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEditProduct(product)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteProduct(product.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Orders ({orders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">
                        {order.order_number || order.shopify_order_number || order.id.substring(0, 8)}
                        {order.shopify_order_id && (
                          <Badge variant="outline" className="ml-1 text-[10px]">Shopify</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{order.customer_name || order.profiles?.full_name || "Guest"}</p>
                          <p className="text-xs text-muted-foreground">{order.customer_email || order.profiles?.email || ""}</p>
                        </div>
                      </TableCell>
                      <TableCell>{order.store_order_items?.length || 0}</TableCell>
                      <TableCell className="font-bold">${Number(order.total).toFixed(2)}</TableCell>
                      <TableCell>
                        <Select value={order.status} onValueChange={(v) => handleUpdateOrderStatus(order.id, v)}>
                          <SelectTrigger className="w-28 h-8">
                            <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="shipped">Shipped</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {order.tracking_number ? (
                          <a href={order.tracking_url || "#"} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                            {order.tracking_number}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{formatDisplayDate(order.created_at)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => handleViewOrder(order)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {orders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No orders yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>{sub.profiles?.full_name || sub.profiles?.email}</TableCell>
                      <TableCell>{sub.store_products?.name}</TableCell>
                      <TableCell>
                        <Badge className={sub.status === "active" ? "bg-green-500/20 text-green-400" : "bg-muted"}>
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDisplayDate(sub.created_at)}</TableCell>
                    </TableRow>
                  ))}
                  {subscriptions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No subscriptions yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details - {selectedOrder?.order_number || selectedOrder?.shopify_order_number || ""}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <p className="font-medium">{selectedOrder.customer_name || selectedOrder.profiles?.full_name || "Guest"}</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.customer_email || selectedOrder.profiles?.email || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={getStatusColor(selectedOrder.status)}>{selectedOrder.status}</Badge>
                    {selectedOrder.shopify_order_id && <Badge variant="outline">Shopify #{selectedOrder.shopify_order_number}</Badge>}
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <Label className="text-xs text-muted-foreground">Items</Label>
                <div className="border border-border rounded-lg divide-y divide-border mt-1">
                  {selectedOrder.store_order_items?.map((item) => (
                    <div key={item.id} className="p-3 flex justify-between">
                      <div>
                        <p className="font-medium text-sm">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity} × ${Number(item.product_price).toFixed(2)}</p>
                      </div>
                      <p className="font-semibold">${Number(item.total).toFixed(2)}</p>
                    </div>
                  )) || <p className="p-3 text-sm text-muted-foreground">No items data</p>}
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${Number(selectedOrder.subtotal).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>${Number(selectedOrder.shipping_cost || 0).toFixed(2)}</span></div>
                {Number(selectedOrder.wallet_credit_applied) > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">VendX Pay Credit</span><span className="text-accent">-${Number(selectedOrder.wallet_credit_applied).toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-border pt-2"><span>Total</span><span className="text-primary">${Number(selectedOrder.total).toFixed(2)}</span></div>
              </div>

              {/* Tracking & Fulfillment */}
              <div className="border-t border-border pt-4 space-y-3">
                <h4 className="font-semibold">Tracking & Fulfillment</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tracking Number</Label>
                    <Input value={trackingForm.tracking_number} onChange={(e) => setTrackingForm({ ...trackingForm, tracking_number: e.target.value })} placeholder="e.g. 1Z999..." />
                  </div>
                  <div>
                    <Label>Tracking URL</Label>
                    <Input value={trackingForm.tracking_url} onChange={(e) => setTrackingForm({ ...trackingForm, tracking_url: e.target.value })} placeholder="https://..." />
                  </div>
                  <div>
                    <Label>Estimated Delivery</Label>
                    <Input type="date" value={trackingForm.estimated_delivery} onChange={(e) => setTrackingForm({ ...trackingForm, estimated_delivery: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Admin Notes</Label>
                  <Textarea value={trackingForm.admin_notes} onChange={(e) => setTrackingForm({ ...trackingForm, admin_notes: e.target.value })} rows={2} placeholder="Internal notes..." />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleUpdateTracking(selectedOrder.id)}>Save Tracking Info</Button>
                  <Button variant="outline" onClick={() => setSelectedOrder(null)}>Close</Button>
                </div>
              </div>

              {/* Timeline */}
              <div className="border-t border-border pt-4">
                <h4 className="font-semibold text-sm mb-2">Timeline</h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>📦 Ordered: {formatDisplayDate(selectedOrder.created_at)}</p>
                  {selectedOrder.shipped_at && <p>🚚 Shipped: {formatDisplayDate(selectedOrder.shipped_at)}</p>}
                  {selectedOrder.delivered_at && <p>✅ Delivered: {formatDisplayDate(selectedOrder.delivered_at)}</p>}
                  {selectedOrder.estimated_delivery && <p>📅 Est. Delivery: {selectedOrder.estimated_delivery}</p>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreManager;
