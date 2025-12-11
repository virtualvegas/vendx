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
  Users, TrendingUp, Eye, Loader2, RefreshCw 
} from "lucide-react";

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
  created_at: string;
  user_id: string;
  profiles?: { email: string; full_name: string } | null;
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
    images: [""]
  });

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

    // Fetch orders
    const { data: ordersData } = await supabase
      .from("store_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    
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
      images: [""]
    });
    setEditingProduct(null);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      slug: product.slug,
      description: "",
      short_description: "",
      price: product.price,
      category: product.category,
      stock: product.stock,
      is_active: product.is_active,
      is_featured: product.is_featured,
      is_subscription: product.is_subscription,
      subscription_price: 0,
      images: [""]
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
      images: productForm.images.filter(img => img.trim() !== "")
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
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono">{order.order_number}</TableCell>
                      <TableCell>{order.profiles?.full_name || order.profiles?.email || "Guest"}</TableCell>
                      <TableCell>${Number(order.total).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                      </TableCell>
                      <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Select 
                          value={order.status}
                          onValueChange={(v) => handleUpdateOrderStatus(order.id, v)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="shipped">Shipped</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {orders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                      <TableCell>{new Date(sub.created_at).toLocaleDateString()}</TableCell>
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
    </div>
  );
};

export default StoreManager;
