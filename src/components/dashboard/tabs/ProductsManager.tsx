import { useState, useEffect, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Gift, Plus, Edit, Trash2, Loader2, RefreshCw, 
  Upload, X, Image as ImageIcon, Eye, Star
} from "lucide-react";

// Subscription Product type
type SubscriptionProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  category: string;
  subcategory: string | null;
  images: string[] | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  is_subscription: boolean | null;
  subscription_price: number | null;
  subscription_interval: string | null;
  waitlist_enabled: boolean | null;
  created_at: string | null;
};

const subscriptionIntervals = ["week", "month", "year"];

const ProductsManager = () => {
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SubscriptionProduct | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    short_description: "",
    price: 0,
    compare_at_price: 0,
    subcategory: "",
    images: [] as string[],
    is_active: true,
    is_featured: false,
    subscription_price: 0,
    subscription_interval: "month",
    waitlist_enabled: false,
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("store_products")
        .select("*")
        .eq("is_subscription", true)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error("Failed to fetch subscription products:", error);
      toast.error("Failed to load subscription products");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      slug: "",
      description: "",
      short_description: "",
      price: 0,
      compare_at_price: 0,
      subcategory: "",
      images: [],
      is_active: true,
      is_featured: false,
      subscription_price: 0,
      subscription_interval: "month",
      waitlist_enabled: false,
    });
    setEditingProduct(null);
  };

  const handleEdit = (product: SubscriptionProduct) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      short_description: product.short_description || "",
      price: product.price,
      compare_at_price: product.compare_at_price || 0,
      subcategory: product.subcategory || "",
      images: product.images || [],
      is_active: product.is_active ?? true,
      is_featured: product.is_featured ?? false,
      subscription_price: product.subscription_price || 0,
      subscription_interval: product.subscription_interval || "month",
      waitlist_enabled: product.waitlist_enabled ?? false,
    });
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploadingImage(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      setForm(prev => ({
        ...prev,
        images: [...prev.images, publicUrl]
      }));

      toast.success("Image uploaded successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = (index: number) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }

    setSaving(true);
    const slug = form.slug || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    
    const productData = {
      name: form.name.trim(),
      slug,
      description: form.description || null,
      short_description: form.short_description || null,
      price: form.price,
      compare_at_price: form.compare_at_price > 0 ? form.compare_at_price : null,
      category: "subscriptions",
      subcategory: form.subcategory || null,
      images: form.images.length > 0 ? form.images : null,
      is_active: form.is_active,
      is_featured: form.is_featured,
      is_subscription: true,
      subscription_price: form.subscription_price,
      subscription_interval: form.subscription_interval,
      waitlist_enabled: form.waitlist_enabled,
    };

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from("store_products")
          .update(productData)
          .eq("id", editingProduct.id);
        
        if (error) throw error;
        toast.success("Subscription updated successfully");
      } else {
        const { error } = await supabase
          .from("store_products")
          .insert(productData);
        
        if (error) throw error;
        toast.success("Subscription created successfully");
      }

      setDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save subscription");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subscription? This action cannot be undone.")) return;
    
    try {
      const { error } = await supabase.from("store_products").delete().eq("id", id);
      
      if (error) throw error;
      
      toast.success("Subscription deleted successfully");
      fetchProducts();
    } catch (error: any) {
      console.error("Failed to delete subscription:", error);
      toast.error("Failed to delete subscription");
    }
  };

  const toggleActive = async (product: SubscriptionProduct) => {
    try {
      const { error } = await supabase
        .from("store_products")
        .update({ is_active: !product.is_active })
        .eq("id", product.id);
      
      if (error) throw error;
      
      toast.success(product.is_active ? "Subscription deactivated" : "Subscription activated");
      fetchProducts();
    } catch (error: any) {
      console.error("Failed to update subscription status:", error);
      toast.error("Failed to update subscription status");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeCount = products.filter(p => p.is_active).length;
  const featuredCount = products.filter(p => p.is_featured).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold truncate">Subscriptions Manager</h2>
          <p className="text-sm text-muted-foreground">Manage subscription products and plans</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button onClick={fetchProducts} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Subscription</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Edit Subscription" : "Add New Subscription"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Subscription Name *</Label>
                    <Input 
                      value={form.name}
                      onChange={(e) => setForm({...form, name: e.target.value})}
                      placeholder="e.g., Snack In The Box"
                    />
                  </div>
                  <div>
                    <Label>URL Slug</Label>
                    <Input 
                      value={form.slug}
                      onChange={(e) => setForm({...form, slug: e.target.value})}
                      placeholder="auto-generated from name"
                    />
                  </div>
                </div>

                <div>
                  <Label>Short Description</Label>
                  <Input 
                    value={form.short_description}
                    onChange={(e) => setForm({...form, short_description: e.target.value})}
                    placeholder="Brief subscription description for listings"
                  />
                </div>

                <div>
                  <Label>Full Description</Label>
                  <Textarea 
                    value={form.description}
                    onChange={(e) => setForm({...form, description: e.target.value})}
                    placeholder="Detailed subscription description..."
                    rows={3}
                  />
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Subscription Price ($) *</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.subscription_price}
                      onChange={(e) => setForm({...form, subscription_price: parseFloat(e.target.value) || 0, price: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>Compare At Price ($)</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.compare_at_price}
                      onChange={(e) => setForm({...form, compare_at_price: parseFloat(e.target.value) || 0})}
                      placeholder="Original price"
                    />
                  </div>
                  <div>
                    <Label>Billing Interval</Label>
                    <Select 
                      value={form.subscription_interval}
                      onValueChange={(v) => setForm({...form, subscription_interval: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {subscriptionIntervals.map(interval => (
                          <SelectItem key={interval} value={interval} className="capitalize">{interval}ly</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Subcategory</Label>
                  <Input 
                    value={form.subcategory}
                    onChange={(e) => setForm({...form, subcategory: e.target.value})}
                    placeholder="e.g., snack-box, arcade"
                  />
                </div>

                {/* Images */}
                <div>
                  <Label>Product Images</Label>
                  <div className="mt-2 space-y-3">
                    {form.images.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {form.images.map((url, index) => (
                          <div key={index} className="relative group">
                            <img 
                              src={url} 
                              alt={`Product ${index + 1}`}
                              className="w-full h-20 object-cover rounded-lg border border-border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeImage(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Image
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <Label>Active</Label>
                    <Switch 
                      checked={form.is_active}
                      onCheckedChange={(checked) => setForm({...form, is_active: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <Label>Featured</Label>
                    <Switch 
                      checked={form.is_featured}
                      onCheckedChange={(checked) => setForm({...form, is_featured: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <Label>Waitlist</Label>
                    <Switch 
                      checked={form.waitlist_enabled}
                      onCheckedChange={(checked) => setForm({...form, waitlist_enabled: checked})}
                    />
                  </div>
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingProduct ? "Update Subscription" : "Create Subscription"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Gift className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{products.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Eye className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Star className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Featured</p>
                <p className="text-2xl font-bold">{featuredCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Gift className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold">{products.length - activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Products</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="hidden md:table-cell">Interval</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Gift className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No subscription products found.</p>
                    <p className="text-sm">Create one using the "Add Subscription" button above.</p>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      {product.images && product.images.length > 0 ? (
                        <img 
                          src={product.images[0]} 
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded-lg border border-border"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                          <Gift className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-primary">
                        ${(product.subscription_price || product.price).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize">
                      {product.subscription_interval || "month"}ly
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        <Badge 
                          variant="outline" 
                          className={product.is_active ? "text-accent border-accent/30" : "text-muted-foreground border-muted-foreground/30"}
                        >
                          {product.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {product.is_featured && (
                          <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                            <Star className="h-3 w-3 mr-1" />
                            Featured
                          </Badge>
                        )}
                        {product.waitlist_enabled && (
                          <Badge variant="secondary">Waitlist</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => toggleActive(product)}>
                          <Eye className={`h-4 w-4 ${product.is_active ? "text-accent" : "text-muted-foreground"}`} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductsManager;
