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
  Package, Plus, Edit, Trash2, Loader2, RefreshCw, 
  Upload, X, Image as ImageIcon, Eye 
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  category: string;
  subcategory: string | null;
  stock: number | null;
  images: string[] | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  is_subscription: boolean | null;
  subscription_price: number | null;
  subscription_interval: string | null;
  created_at: string | null;
}

const categories = ["subscriptions", "apparel", "accessories", "snacks", "tech", "merchandise"];
const subscriptionIntervals = ["week", "month", "year"];

const ProductsManager = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    short_description: "",
    price: 0,
    compare_at_price: 0,
    category: "apparel",
    subcategory: "",
    stock: 0,
    images: [] as string[],
    is_active: true,
    is_featured: false,
    is_subscription: false,
    subscription_price: 0,
    subscription_interval: "month"
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("store_products")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("Failed to load products");
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      name: "",
      slug: "",
      description: "",
      short_description: "",
      price: 0,
      compare_at_price: 0,
      category: "apparel",
      subcategory: "",
      stock: 0,
      images: [],
      is_active: true,
      is_featured: false,
      is_subscription: false,
      subscription_price: 0,
      subscription_interval: "month"
    });
    setEditingProduct(null);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      short_description: product.short_description || "",
      price: product.price,
      compare_at_price: product.compare_at_price || 0,
      category: product.category,
      subcategory: product.subcategory || "",
      stock: product.stock || 0,
      images: product.images || [],
      is_active: product.is_active ?? true,
      is_featured: product.is_featured ?? false,
      is_subscription: product.is_subscription ?? false,
      subscription_price: product.subscription_price || 0,
      subscription_interval: product.subscription_interval || "month"
    });
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
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
      category: form.category,
      subcategory: form.subcategory || null,
      stock: form.stock,
      images: form.images.length > 0 ? form.images : null,
      is_active: form.is_active,
      is_featured: form.is_featured,
      is_subscription: form.is_subscription,
      subscription_price: form.is_subscription ? form.subscription_price : null,
      subscription_interval: form.is_subscription ? form.subscription_interval : null
    };

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from("store_products")
          .update(productData)
          .eq("id", editingProduct.id);
        
        if (error) throw error;
        toast.success("Product updated successfully");
      } else {
        const { error } = await supabase
          .from("store_products")
          .insert(productData);
        
        if (error) throw error;
        toast.success("Product created successfully");
      }

      setDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product? This action cannot be undone.")) return;
    
    const { error } = await supabase.from("store_products").delete().eq("id", id);
    
    if (error) {
      toast.error("Failed to delete product");
      return;
    }
    
    toast.success("Product deleted successfully");
    fetchProducts();
  };

  const toggleActive = async (product: Product) => {
    const { error } = await supabase
      .from("store_products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    
    if (error) {
      toast.error("Failed to update product status");
      return;
    }
    
    toast.success(product.is_active ? "Product deactivated" : "Product activated");
    fetchProducts();
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
        <div>
          <h2 className="text-2xl font-bold">Products Manager</h2>
          <p className="text-muted-foreground">Manage store products with image uploads</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchProducts} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Product Name *</Label>
                    <Input 
                      value={form.name}
                      onChange={(e) => setForm({...form, name: e.target.value})}
                      placeholder="e.g., VendX T-Shirt"
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
                    placeholder="Brief product description for listings"
                  />
                </div>

                <div>
                  <Label>Full Description</Label>
                  <Textarea 
                    value={form.description}
                    onChange={(e) => setForm({...form, description: e.target.value})}
                    placeholder="Detailed product description..."
                    rows={4}
                  />
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Price ($) *</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.price}
                      onChange={(e) => setForm({...form, price: parseFloat(e.target.value) || 0})}
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
                      placeholder="Original price for sale items"
                    />
                  </div>
                  <div>
                    <Label>Stock</Label>
                    <Input 
                      type="number"
                      min="0"
                      value={form.stock}
                      onChange={(e) => setForm({...form, stock: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                {/* Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category *</Label>
                    <Select 
                      value={form.category}
                      onValueChange={(v) => setForm({...form, category: v})}
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
                    <Label>Subcategory</Label>
                    <Input 
                      value={form.subcategory}
                      onChange={(e) => setForm({...form, subcategory: e.target.value})}
                      placeholder="e.g., t-shirts, hoodies"
                    />
                  </div>
                </div>

                {/* Images */}
                <div>
                  <Label>Product Images</Label>
                  <div className="mt-2 space-y-3">
                    {/* Image Grid */}
                    {form.images.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {form.images.map((url, index) => (
                          <div key={index} className="relative group">
                            <img 
                              src={url} 
                              alt={`Product ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border border-border"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute top-1 right-1 p-1 bg-destructive rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Upload Button */}
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
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {uploadingImage ? "Uploading..." : "Upload Image"}
                      </Button>
                      <p className="text-xs text-muted-foreground self-center">Max 5MB per image</p>
                    </div>
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={form.is_active}
                      onCheckedChange={(v) => setForm({...form, is_active: v})}
                    />
                    <Label>Active</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={form.is_featured}
                      onCheckedChange={(v) => setForm({...form, is_featured: v})}
                    />
                    <Label>Featured</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={form.is_subscription}
                      onCheckedChange={(v) => setForm({...form, is_subscription: v})}
                    />
                    <Label>Subscription Product</Label>
                  </div>
                </div>

                {/* Subscription Options */}
                {form.is_subscription && (
                  <div className="grid grid-cols-2 gap-4 p-4 border border-border rounded-lg bg-muted/30">
                    <div>
                      <Label>Subscription Price ($)</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.subscription_price}
                        onChange={(e) => setForm({...form, subscription_price: parseFloat(e.target.value) || 0})}
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
                            <SelectItem key={interval} value={interval} className="capitalize">
                              {interval}ly
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingProduct ? "Update Product" : "Create Product"
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
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{products.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Eye className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{products.filter(p => p.is_active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ImageIcon className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">With Images</p>
                <p className="text-2xl font-bold">{products.filter(p => p.images && p.images.length > 0).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Subscriptions</p>
                <p className="text-2xl font-bold">{products.filter(p => p.is_subscription).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Products ({products.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No products found. Create your first product above.
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
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{product.category}</TableCell>
                    <TableCell>
                      <div>
                        <p>${product.price.toFixed(2)}</p>
                        {product.compare_at_price && (
                          <p className="text-xs text-muted-foreground line-through">
                            ${product.compare_at_price.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{product.stock ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        <Badge 
                          variant="outline" 
                          className={product.is_active ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"}
                        >
                          {product.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {product.is_featured && (
                          <Badge variant="outline" className="text-primary border-primary/30">Featured</Badge>
                        )}
                        {product.is_subscription && (
                          <Badge variant="outline" className="text-accent border-accent/30">Sub</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(product)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActive(product)}
                        >
                          <Eye className={`h-4 w-4 ${product.is_active ? "text-green-400" : "text-muted-foreground"}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(product.id)}
                          className="text-destructive hover:text-destructive"
                        >
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

      {/* Preview Dialog */}
      <Dialog open={!!previewProduct} onOpenChange={(open) => !open && setPreviewProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Product Preview</DialogTitle>
          </DialogHeader>
          {previewProduct && (
            <div className="space-y-4">
              {previewProduct.images && previewProduct.images.length > 0 && (
                <img 
                  src={previewProduct.images[0]} 
                  alt={previewProduct.name}
                  className="w-full h-64 object-cover rounded-lg"
                />
              )}
              <h3 className="text-xl font-bold">{previewProduct.name}</h3>
              <p className="text-muted-foreground">{previewProduct.description}</p>
              <p className="text-2xl font-bold text-primary">${previewProduct.price.toFixed(2)}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductsManager;
