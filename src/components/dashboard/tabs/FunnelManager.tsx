import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Settings, Package, Zap, Layers, BarChart3, ShoppingBag, CreditCard, Store } from "lucide-react";
import { useShopifyProducts } from "@/hooks/useShopifyProducts";

interface Funnel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  funnel_type: string;
  display_order: number;
  settings: unknown;
  created_at: string;
}

interface FunnelStep {
  id: string;
  funnel_id: string;
  step_order: number;
  step_type: string;
  title: string;
  description: string | null;
  is_required: boolean;
  settings: unknown;
}

interface FunnelProduct {
  id: string;
  funnel_step_id: string;
  product_id: string | null;
  product_source: string;
  external_product_id: string | null;
  external_product_data: Record<string, unknown> | null;
  custom_price: number | null;
  custom_name: string | null;
  discount_percentage: number;
  display_order: number;
  is_featured: boolean;
  quantity_limit: number | null;
  product?: {
    name: string;
    price: number;
    images: string[];
    is_subscription?: boolean;
    subscription_price?: number | null;
  };
}

interface FunnelAddon {
  id: string;
  funnel_step_id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  display_order: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
  is_active: boolean;
  is_subscription: boolean;
  subscription_price: number | null;
}

const funnelTypes = [
  { value: 'standard', label: 'Standard Funnel' },
  { value: 'upsell', label: 'Upsell Funnel' },
  { value: 'cross-sell', label: 'Cross-sell Funnel' },
  { value: 'bundle', label: 'Bundle Funnel' },
];

const stepTypes = [
  { value: 'product', label: 'Product Selection' },
  { value: 'upsell', label: 'Upsell Offer' },
  { value: 'cross-sell', label: 'Cross-sell' },
  { value: 'addon', label: 'Add-ons' },
  { value: 'checkout', label: 'Checkout' },
];

const productSources = [
  { value: 'internal', label: 'Internal Product', icon: Package },
  { value: 'subscription', label: 'Subscription', icon: CreditCard },
  { value: 'shopify', label: 'Shopify Product', icon: ShoppingBag },
];

export default function FunnelManager() {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFunnel, setSelectedFunnel] = useState<Funnel | null>(null);
  const [funnelSteps, setFunnelSteps] = useState<FunnelStep[]>([]);
  const [stepProducts, setStepProducts] = useState<FunnelProduct[]>([]);
  const [stepAddons, setStepAddons] = useState<FunnelAddon[]>([]);
  const [selectedStep, setSelectedStep] = useState<FunnelStep | null>(null);
  
  const { products: shopifyProducts, loading: shopifyLoading } = useShopifyProducts();
  
  // Dialog states
  const [funnelDialogOpen, setFunnelDialogOpen] = useState(false);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [addonDialogOpen, setAddonDialogOpen] = useState(false);
  
  // Form states
  const [funnelForm, setFunnelForm] = useState({
    name: '',
    slug: '',
    description: '',
    funnel_type: 'standard',
    is_active: true,
  });
  
  const [stepForm, setStepForm] = useState({
    title: '',
    description: '',
    step_type: 'product',
    is_required: false,
  });
  
  const [productForm, setProductForm] = useState({
    product_source: 'internal',
    product_id: '',
    external_product_id: '',
    custom_price: '',
    custom_name: '',
    discount_percentage: '0',
    is_featured: false,
    quantity_limit: '',
  });
  
  const [addonForm, setAddonForm] = useState({
    name: '',
    description: '',
    price: '',
    is_active: true,
  });
  
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [editingStep, setEditingStep] = useState<FunnelStep | null>(null);
  const [editingProduct, setEditingProduct] = useState<FunnelProduct | null>(null);
  const [editingAddon, setEditingAddon] = useState<FunnelAddon | null>(null);

  // Derived lists
  const internalProducts = products.filter(p => !p.is_subscription);
  const subscriptionProducts = products.filter(p => p.is_subscription);

  useEffect(() => {
    fetchFunnels();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedFunnel) {
      fetchFunnelSteps(selectedFunnel.id);
    }
  }, [selectedFunnel]);

  useEffect(() => {
    if (selectedStep) {
      fetchStepProducts(selectedStep.id);
      fetchStepAddons(selectedStep.id);
    }
  }, [selectedStep]);

  const fetchFunnels = async () => {
    const { data, error } = await supabase
      .from('store_funnels')
      .select('*')
      .order('display_order');
    if (!error) setFunnels(data || []);
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('store_products')
      .select('id, name, price, images, is_active, is_subscription, subscription_price')
      .eq('is_active', true)
      .order('name');
    setProducts(data || []);
  };

  const fetchFunnelSteps = async (funnelId: string) => {
    const { data } = await supabase
      .from('store_funnel_steps')
      .select('*')
      .eq('funnel_id', funnelId)
      .order('step_order');
    if (data) {
      setFunnelSteps(data);
      if (data.length > 0 && !selectedStep) setSelectedStep(data[0]);
    }
  };

  const fetchStepProducts = async (stepId: string) => {
    const { data } = await supabase
      .from('store_funnel_products')
      .select(`*, product:store_products(name, price, images, is_subscription, subscription_price)`)
      .eq('funnel_step_id', stepId)
      .order('display_order');
    setStepProducts((data as FunnelProduct[]) || []);
  };

  const fetchStepAddons = async (stepId: string) => {
    const { data } = await supabase
      .from('store_funnel_addons')
      .select('*')
      .eq('funnel_step_id', stepId)
      .order('display_order');
    setStepAddons(data || []);
  };

  const generateSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // ---- CRUD Handlers ----

  const handleSaveFunnel = async () => {
    const slug = funnelForm.slug || generateSlug(funnelForm.name);
    if (editingFunnel) {
      const { error } = await supabase.from('store_funnels').update({ ...funnelForm, slug }).eq('id', editingFunnel.id);
      error ? toast.error('Failed to update funnel') : toast.success('Funnel updated');
    } else {
      const { error } = await supabase.from('store_funnels').insert([{ ...funnelForm, slug }]);
      error ? toast.error('Failed to create funnel') : toast.success('Funnel created');
    }
    setFunnelDialogOpen(false);
    resetFunnelForm();
    fetchFunnels();
  };

  const handleDeleteFunnel = async (id: string) => {
    if (!confirm('Delete this funnel and all its steps?')) return;
    const { error } = await supabase.from('store_funnels').delete().eq('id', id);
    if (error) { toast.error('Failed to delete funnel'); return; }
    toast.success('Funnel deleted');
    if (selectedFunnel?.id === id) { setSelectedFunnel(null); setFunnelSteps([]); setSelectedStep(null); }
    fetchFunnels();
  };

  const handleSaveStep = async () => {
    if (!selectedFunnel) return;
    if (editingStep) {
      const { error } = await supabase.from('store_funnel_steps').update(stepForm).eq('id', editingStep.id);
      error ? toast.error('Failed to update step') : toast.success('Step updated');
    } else {
      const { error } = await supabase.from('store_funnel_steps').insert([{ ...stepForm, funnel_id: selectedFunnel.id, step_order: funnelSteps.length }]);
      error ? toast.error('Failed to create step') : toast.success('Step created');
    }
    setStepDialogOpen(false);
    resetStepForm();
    fetchFunnelSteps(selectedFunnel.id);
  };

  const handleDeleteStep = async (id: string) => {
    if (!confirm('Delete this step?')) return;
    const { error } = await supabase.from('store_funnel_steps').delete().eq('id', id);
    if (error) { toast.error('Failed to delete step'); return; }
    toast.success('Step deleted');
    if (selectedStep?.id === id) setSelectedStep(null);
    if (selectedFunnel) fetchFunnelSteps(selectedFunnel.id);
  };

  const handleSaveProduct = async () => {
    if (!selectedStep) return;

    const source = productForm.product_source;
    let externalData: Record<string, unknown> = {};
    
    // Build external_product_data for Shopify items
    if (source === 'shopify' && productForm.external_product_id) {
      const sp = shopifyProducts.find(p => p.node.handle === productForm.external_product_id);
      if (sp) {
        externalData = {
          name: sp.node.title,
          price: parseFloat(sp.node.priceRange.minVariantPrice.amount),
          image: sp.node.images.edges[0]?.node.url || null,
          handle: sp.node.handle,
          variantId: sp.node.variants.edges[0]?.node.id || null,
        };
      }
    }

    const productData: Record<string, unknown> = {
      funnel_step_id: selectedStep.id,
      product_source: source,
      product_id: source === 'shopify' ? null : (productForm.product_id || null),
      external_product_id: source === 'shopify' ? productForm.external_product_id : null,
      external_product_data: source === 'shopify' ? externalData : {},
      custom_price: productForm.custom_price ? parseFloat(productForm.custom_price) : null,
      custom_name: productForm.custom_name || null,
      discount_percentage: parseFloat(productForm.discount_percentage) || 0,
      is_featured: productForm.is_featured,
      quantity_limit: productForm.quantity_limit ? parseInt(productForm.quantity_limit) : null,
    };
    
    if (editingProduct) {
      const { error } = await supabase.from('store_funnel_products').update(productData).eq('id', editingProduct.id);
      error ? toast.error('Failed to update product') : toast.success('Product updated');
    } else {
      const insertData = { ...productData, funnel_step_id: selectedStep.id, display_order: stepProducts.length };
      const { error } = await supabase.from('store_funnel_products').insert([insertData]);
      error ? toast.error('Failed to add product') : toast.success('Product added');
    }
    setProductDialogOpen(false);
    resetProductForm();
    fetchStepProducts(selectedStep.id);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!selectedStep) return;
    const { error } = await supabase.from('store_funnel_products').delete().eq('id', id);
    error ? toast.error('Failed to remove product') : toast.success('Product removed');
    fetchStepProducts(selectedStep.id);
  };

  const handleSaveAddon = async () => {
    if (!selectedStep) return;
    const addonData = {
      funnel_step_id: selectedStep.id,
      name: addonForm.name,
      description: addonForm.description || null,
      price: parseFloat(addonForm.price) || 0,
      is_active: addonForm.is_active,
    };
    if (editingAddon) {
      const { error } = await supabase.from('store_funnel_addons').update(addonData).eq('id', editingAddon.id);
      error ? toast.error('Failed to update addon') : toast.success('Addon updated');
    } else {
      const { error } = await supabase.from('store_funnel_addons').insert([{ ...addonData, display_order: stepAddons.length }]);
      error ? toast.error('Failed to add addon') : toast.success('Addon added');
    }
    setAddonDialogOpen(false);
    resetAddonForm();
    fetchStepAddons(selectedStep.id);
  };

  const handleDeleteAddon = async (id: string) => {
    if (!selectedStep) return;
    const { error } = await supabase.from('store_funnel_addons').delete().eq('id', id);
    error ? toast.error('Failed to remove addon') : toast.success('Addon removed');
    fetchStepAddons(selectedStep.id);
  };

  // ---- Reset Helpers ----
  const resetFunnelForm = () => { setFunnelForm({ name: '', slug: '', description: '', funnel_type: 'standard', is_active: true }); setEditingFunnel(null); };
  const resetStepForm = () => { setStepForm({ title: '', description: '', step_type: 'product', is_required: false }); setEditingStep(null); };
  const resetProductForm = () => { setProductForm({ product_source: 'internal', product_id: '', external_product_id: '', custom_price: '', custom_name: '', discount_percentage: '0', is_featured: false, quantity_limit: '' }); setEditingProduct(null); };
  const resetAddonForm = () => { setAddonForm({ name: '', description: '', price: '', is_active: true }); setEditingAddon(null); };

  // ---- Edit Openers ----
  const openEditFunnel = (funnel: Funnel) => {
    setEditingFunnel(funnel);
    setFunnelForm({ name: funnel.name, slug: funnel.slug, description: funnel.description || '', funnel_type: funnel.funnel_type, is_active: funnel.is_active });
    setFunnelDialogOpen(true);
  };
  const openEditStep = (step: FunnelStep) => {
    setEditingStep(step);
    setStepForm({ title: step.title, description: step.description || '', step_type: step.step_type, is_required: step.is_required });
    setStepDialogOpen(true);
  };
  const openEditProduct = (fp: FunnelProduct) => {
    setEditingProduct(fp);
    setProductForm({
      product_source: fp.product_source || 'internal',
      product_id: fp.product_id || '',
      external_product_id: fp.external_product_id || '',
      custom_price: fp.custom_price?.toString() || '',
      custom_name: fp.custom_name || '',
      discount_percentage: fp.discount_percentage.toString(),
      is_featured: fp.is_featured,
      quantity_limit: fp.quantity_limit?.toString() || '',
    });
    setProductDialogOpen(true);
  };
  const openEditAddon = (addon: FunnelAddon) => {
    setEditingAddon(addon);
    setAddonForm({ name: addon.name, description: addon.description || '', price: addon.price.toString(), is_active: addon.is_active });
    setAddonDialogOpen(true);
  };

  // ---- Display Helpers ----
  const getProductDisplayName = (fp: FunnelProduct): string => {
    if (fp.custom_name) return fp.custom_name;
    if (fp.product_source === 'shopify') return (fp.external_product_data as any)?.name || fp.external_product_id || 'Shopify Product';
    return fp.product?.name || 'Unknown Product';
  };

  const getProductDisplayPrice = (fp: FunnelProduct): number => {
    if (fp.custom_price != null) return fp.custom_price;
    if (fp.product_source === 'shopify') return (fp.external_product_data as any)?.price || 0;
    if (fp.product_source === 'subscription') return fp.product?.subscription_price || fp.product?.price || 0;
    return fp.product?.price || 0;
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'shopify': return <Badge variant="outline" className="text-xs gap-1"><ShoppingBag className="h-3 w-3" />Shopify</Badge>;
      case 'subscription': return <Badge variant="outline" className="text-xs gap-1"><CreditCard className="h-3 w-3" />Subscription</Badge>;
      default: return <Badge variant="outline" className="text-xs gap-1"><Package className="h-3 w-3" />Internal</Badge>;
    }
  };

  const getFunnelTypeIcon = (type: string) => {
    switch (type) {
      case 'upsell': return <Zap className="h-4 w-4" />;
      case 'cross-sell': return <Layers className="h-4 w-4" />;
      case 'bundle': return <Package className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold truncate">Sales Funnels</h2>
          <p className="text-sm text-muted-foreground">Create multi-source funnels with internal, Shopify &amp; subscription products</p>
        </div>
        <Dialog open={funnelDialogOpen} onOpenChange={(open) => { setFunnelDialogOpen(open); if (!open) resetFunnelForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Create Funnel</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingFunnel ? 'Edit Funnel' : 'Create New Funnel'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={funnelForm.name} onChange={(e) => setFunnelForm({ ...funnelForm, name: e.target.value })} placeholder="Summer Sale Funnel" /></div>
              <div><Label>Slug</Label><Input value={funnelForm.slug} onChange={(e) => setFunnelForm({ ...funnelForm, slug: e.target.value })} placeholder="Auto-generated from name" /></div>
              <div><Label>Description</Label><Textarea value={funnelForm.description} onChange={(e) => setFunnelForm({ ...funnelForm, description: e.target.value })} /></div>
              <div>
                <Label>Funnel Type</Label>
                <Select value={funnelForm.funnel_type} onValueChange={(v) => setFunnelForm({ ...funnelForm, funnel_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{funnelTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2"><Switch checked={funnelForm.is_active} onCheckedChange={(c) => setFunnelForm({ ...funnelForm, is_active: c })} /><Label>Active</Label></div>
              <Button onClick={handleSaveFunnel} className="w-full">{editingFunnel ? 'Update' : 'Create'} Funnel</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnels List */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Funnels</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {funnels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No funnels created yet</p>
            ) : funnels.map((funnel) => (
              <div key={funnel.id} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedFunnel?.id === funnel.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`} onClick={() => { setSelectedFunnel(funnel); setSelectedStep(null); }}>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {getFunnelTypeIcon(funnel.funnel_type)}
                    <span className="font-medium truncate">{funnel.name}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Badge variant={funnel.is_active ? 'default' : 'secondary'} className="text-xs">{funnel.is_active ? 'Active' : 'Off'}</Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditFunnel(funnel); }}><Edit className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDeleteFunnel(funnel.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{funnel.funnel_type}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Steps Panel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Funnel Steps</CardTitle>
            {selectedFunnel && (
              <Dialog open={stepDialogOpen} onOpenChange={(open) => { setStepDialogOpen(open); if (!open) resetStepForm(); }}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Step</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editingStep ? 'Edit Step' : 'Add Step'}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Title</Label><Input value={stepForm.title} onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })} placeholder="Choose Your Product" /></div>
                    <div><Label>Description</Label><Textarea value={stepForm.description} onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })} /></div>
                    <div>
                      <Label>Step Type</Label>
                      <Select value={stepForm.step_type} onValueChange={(v) => setStepForm({ ...stepForm, step_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{stepTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2"><Switch checked={stepForm.is_required} onCheckedChange={(c) => setStepForm({ ...stepForm, is_required: c })} /><Label>Required Step</Label></div>
                    <Button onClick={handleSaveStep} className="w-full">{editingStep ? 'Update' : 'Add'} Step</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {!selectedFunnel ? (
              <p className="text-sm text-muted-foreground">Select a funnel to view steps</p>
            ) : funnelSteps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No steps added yet</p>
            ) : funnelSteps.map((step, index) => (
              <div key={step.id} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedStep?.id === step.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`} onClick={() => setSelectedStep(step)}>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold flex-shrink-0">{index + 1}</span>
                    <span className="font-medium truncate">{step.title}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Badge variant="outline" className="text-xs">{step.step_type}</Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditStep(step); }}><Edit className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDeleteStep(step.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                {step.is_required && <Badge variant="secondary" className="mt-1 text-xs">Required</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Step Details Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{selectedStep ? selectedStep.title : 'Step Details'}</CardTitle>
            {selectedStep && <CardDescription>{selectedStep.step_type}</CardDescription>}
          </CardHeader>
          <CardContent>
            {!selectedStep ? (
              <p className="text-sm text-muted-foreground">Select a step to manage products and add-ons</p>
            ) : (
              <Tabs defaultValue="products">
                <TabsList className="w-full">
                  <TabsTrigger value="products" className="flex-1">Products</TabsTrigger>
                  <TabsTrigger value="addons" className="flex-1">Add-ons</TabsTrigger>
                </TabsList>
                
                <TabsContent value="products" className="space-y-3">
                  <Dialog open={productDialogOpen} onOpenChange={(open) => { setProductDialogOpen(open); if (!open) resetProductForm(); }}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="w-full"><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                      <DialogHeader><DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product to Step'}</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        {/* Product Source Selector */}
                        <div>
                          <Label>Product Source</Label>
                          <Select value={productForm.product_source} onValueChange={(v) => setProductForm({ ...productForm, product_source: v, product_id: '', external_product_id: '' })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {productSources.map(s => (
                                <SelectItem key={s.value} value={s.value}>
                                  <span className="flex items-center gap-2"><s.icon className="h-4 w-4" />{s.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Internal Product Selector */}
                        {productForm.product_source === 'internal' && (
                          <div>
                            <Label>Select Product</Label>
                            <Select value={productForm.product_id} onValueChange={(v) => setProductForm({ ...productForm, product_id: v })}>
                              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                              <SelectContent>
                                {internalProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} (${p.price})</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Subscription Product Selector */}
                        {productForm.product_source === 'subscription' && (
                          <div>
                            <Label>Select Subscription</Label>
                            <Select value={productForm.product_id} onValueChange={(v) => setProductForm({ ...productForm, product_id: v })}>
                              <SelectTrigger><SelectValue placeholder="Select subscription" /></SelectTrigger>
                              <SelectContent>
                                {subscriptionProducts.length === 0 ? (
                                  <SelectItem value="_none" disabled>No subscriptions available</SelectItem>
                                ) : subscriptionProducts.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.name} (${p.subscription_price || p.price}/mo)</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Shopify Product Selector */}
                        {productForm.product_source === 'shopify' && (
                          <div>
                            <Label>Select Shopify Product</Label>
                            {shopifyLoading ? (
                              <p className="text-sm text-muted-foreground py-2">Loading Shopify products...</p>
                            ) : (
                              <Select value={productForm.external_product_id} onValueChange={(v) => setProductForm({ ...productForm, external_product_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Select Shopify product" /></SelectTrigger>
                                <SelectContent>
                                  {shopifyProducts.length === 0 ? (
                                    <SelectItem value="_none" disabled>No Shopify products found</SelectItem>
                                  ) : shopifyProducts.map((sp) => (
                                    <SelectItem key={sp.node.handle} value={sp.node.handle}>
                                      {sp.node.title} (${parseFloat(sp.node.priceRange.minVariantPrice.amount).toFixed(2)})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        )}

                        <div><Label>Custom Name (optional)</Label><Input value={productForm.custom_name} onChange={(e) => setProductForm({ ...productForm, custom_name: e.target.value })} placeholder="Override product name" /></div>
                        <div className="grid grid-cols-2 gap-4">
                          <div><Label>Custom Price ($)</Label><Input type="number" value={productForm.custom_price} onChange={(e) => setProductForm({ ...productForm, custom_price: e.target.value })} placeholder="Override price" /></div>
                          <div><Label>Discount (%)</Label><Input type="number" value={productForm.discount_percentage} onChange={(e) => setProductForm({ ...productForm, discount_percentage: e.target.value })} /></div>
                        </div>
                        <div><Label>Quantity Limit</Label><Input type="number" value={productForm.quantity_limit} onChange={(e) => setProductForm({ ...productForm, quantity_limit: e.target.value })} placeholder="Max per order" /></div>
                        <div className="flex items-center gap-2"><Switch checked={productForm.is_featured} onCheckedChange={(c) => setProductForm({ ...productForm, is_featured: c })} /><Label>Featured in this step</Label></div>
                        <Button onClick={handleSaveProduct} className="w-full">{editingProduct ? 'Update' : 'Add'} Product</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  {stepProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No products added</p>
                  ) : (
                    <div className="space-y-2">
                      {stepProducts.map((fp) => (
                        <div key={fp.id} className="flex items-center justify-between p-2 rounded border gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{getProductDisplayName(fp)}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs text-muted-foreground">
                                ${getProductDisplayPrice(fp).toFixed(2)}
                                {fp.discount_percentage > 0 && <span className="text-green-600 ml-1">-{fp.discount_percentage}%</span>}
                              </p>
                              {getSourceBadge(fp.product_source)}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {fp.is_featured && <Badge className="text-xs">Featured</Badge>}
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditProduct(fp)}><Edit className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteProduct(fp.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="addons" className="space-y-3">
                  <Dialog open={addonDialogOpen} onOpenChange={(open) => { setAddonDialogOpen(open); if (!open) resetAddonForm(); }}>
                    <DialogTrigger asChild><Button size="sm" className="w-full"><Plus className="h-4 w-4 mr-1" /> Add Add-on</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>{editingAddon ? 'Edit Add-on' : 'Create Add-on'}</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div><Label>Name</Label><Input value={addonForm.name} onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })} placeholder="Extended Warranty" /></div>
                        <div><Label>Description</Label><Textarea value={addonForm.description} onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })} /></div>
                        <div><Label>Price ($)</Label><Input type="number" value={addonForm.price} onChange={(e) => setAddonForm({ ...addonForm, price: e.target.value })} /></div>
                        <div className="flex items-center gap-2"><Switch checked={addonForm.is_active} onCheckedChange={(c) => setAddonForm({ ...addonForm, is_active: c })} /><Label>Active</Label></div>
                        <Button onClick={handleSaveAddon} className="w-full">{editingAddon ? 'Update' : 'Add'} Add-on</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  {stepAddons.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No add-ons</p>
                  ) : (
                    <div className="space-y-2">
                      {stepAddons.map((addon) => (
                        <div key={addon.id} className="flex items-center justify-between p-2 rounded border">
                          <div>
                            <p className="font-medium text-sm">{addon.name}</p>
                            <p className="text-xs text-muted-foreground">${addon.price}</p>
                          </div>
                          <div className="flex gap-1">
                            <Badge variant={addon.is_active ? 'default' : 'secondary'} className="text-xs">{addon.is_active ? 'Active' : 'Off'}</Badge>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditAddon(addon)}><Edit className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteAddon(addon.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analytics Summary */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Funnel Analytics</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg"><p className="text-2xl font-bold">{funnels.length}</p><p className="text-sm text-muted-foreground">Total Funnels</p></div>
            <div className="text-center p-4 bg-muted/50 rounded-lg"><p className="text-2xl font-bold">{funnels.filter(f => f.is_active).length}</p><p className="text-sm text-muted-foreground">Active Funnels</p></div>
            <div className="text-center p-4 bg-muted/50 rounded-lg"><p className="text-2xl font-bold">{funnelSteps.length}</p><p className="text-sm text-muted-foreground">Steps (Selected)</p></div>
            <div className="text-center p-4 bg-muted/50 rounded-lg"><p className="text-2xl font-bold">{stepProducts.length + stepAddons.length}</p><p className="text-sm text-muted-foreground">Items (Selected Step)</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
