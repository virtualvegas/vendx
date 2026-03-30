import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, AlertTriangle, Trash2, Edit, Search, RefreshCw, Warehouse, TrendingDown, DollarSign, MoreHorizontal, Archive } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface WarehouseProduct {
  id: string;
  product_name: string;
  sku: string;
  category: string;
  quantity: number;
  min_stock_level: number;
  location: string;
  unit_cost: number;
  default_retail_price: number;
  supplier: string | null;
  is_active: boolean;
  last_restocked: string | null;
}

const CATEGORIES = [
  "Snacks", "Beverages", "Fresh Food", "Candy",
  "Healthy Options", "Coffee/Tea", "Supplies", "Other",
];

const InventoryLogistics = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseProduct | null>(null);
  const [selectedItem, setSelectedItem] = useState<WarehouseProduct | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [formData, setFormData] = useState({
    product_name: "", sku: "", category: "Snacks",
    quantity: 0, min_stock_level: 10, location: "Main Warehouse",
    unit_cost: 0, default_retail_price: 0, supplier: "", is_active: true,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: isSuperAdmin } = useQuery({
    queryKey: ["is-super-admin"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin");
      return (data && data.length > 0) || false;
    },
  });

  const { data: warehouseItems, isLoading } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("*").order("product_name");
      if (error) throw error;
      return data as WarehouseProduct[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("inventory_items").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      toast({ title: "Product added to catalog" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { error } = await supabase.from("inventory_items").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      toast({ title: "Product updated" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      toast({ title: "Product removed" });
      setShowDeleteConfirm(false);
      setSelectedItem(null);
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setFormData({ product_name: "", sku: "", category: "Snacks", quantity: 0, min_stock_level: 10, location: "Main Warehouse", unit_cost: 0, default_retail_price: 0, supplier: "", is_active: true });
    setEditingItem(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (item: WarehouseProduct) => {
    setEditingItem(item);
    setFormData({
      product_name: item.product_name, sku: item.sku, category: item.category,
      quantity: item.quantity, min_stock_level: item.min_stock_level,
      location: item.location, unit_cost: item.unit_cost,
      default_retail_price: item.default_retail_price || 0,
      supplier: item.supplier || "", is_active: item.is_active,
    });
    setShowDialog(true);
  };

  const handleRestock = async (item: WarehouseProduct, addQty: number) => {
    await supabase
      .from("inventory_items")
      .update({ quantity: item.quantity + addQty, last_restocked: new Date().toISOString() })
      .eq("id", item.id);
    queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    toast({ title: `Added ${addQty} units to ${item.product_name}` });
  };

  const toggleActive = async (item: WarehouseProduct) => {
    await supabase.from("inventory_items").update({ is_active: !item.is_active }).eq("id", item.id);
    queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    toast({ title: item.is_active ? "Product archived" : "Product reactivated" });
  };

  const filteredItems = useMemo(() => {
    return (warehouseItems || []).filter(item => {
      const matchesSearch = item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === "all" || item.category === filterCategory;
      const matchesLowStock = !filterLowStock || item.quantity <= item.min_stock_level;
      const matchesActive = showInactive || item.is_active !== false;
      return matchesSearch && matchesCategory && matchesLowStock && matchesActive;
    });
  }, [warehouseItems, searchTerm, filterCategory, filterLowStock, showInactive]);

  const stats = useMemo(() => {
    const items = (warehouseItems || []).filter(i => i.is_active !== false);
    return {
      totalProducts: items.length,
      totalUnits: items.reduce((sum, i) => sum + i.quantity, 0),
      lowStock: items.filter(i => i.quantity <= i.min_stock_level && i.quantity > 0).length,
      outOfStock: items.filter(i => i.quantity === 0).length,
      totalCostValue: items.reduce((sum, i) => sum + (i.quantity * i.unit_cost), 0),
      totalRetailValue: items.reduce((sum, i) => sum + (i.quantity * (i.default_retail_price || 0)), 0),
    };
  }, [warehouseItems]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Warehouse className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
            <span className="truncate">Product Catalog (Warehouse)</span>
          </h2>
          <p className="text-sm text-muted-foreground">All supported products — stays listed even when out of stock</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["inventory-items"] })}>
          <RefreshCw className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Products</p><p className="text-xl font-bold">{stats.totalProducts}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Units</p><p className="text-xl font-bold">{stats.totalUnits.toLocaleString()}</p></CardContent></Card>
        <Card className={stats.lowStock > 0 ? "border-yellow-500/50" : ""}><CardContent className="p-4"><p className="text-xs text-muted-foreground">Low Stock</p><p className={`text-xl font-bold ${stats.lowStock > 0 ? "text-yellow-500" : ""}`}>{stats.lowStock}</p></CardContent></Card>
        <Card className={stats.outOfStock > 0 ? "border-destructive/50" : ""}><CardContent className="p-4"><p className="text-xs text-muted-foreground">Out of Stock</p><p className={`text-xl font-bold ${stats.outOfStock > 0 ? "text-destructive" : ""}`}>{stats.outOfStock}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cost Value</p><p className="text-xl font-bold">${stats.totalCostValue.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Retail Value</p><p className="text-xl font-bold text-primary">${stats.totalRetailValue.toLocaleString()}</p></CardContent></Card>
      </div>

      {/* Low Stock Alerts */}
      {stats.lowStock > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-yellow-600 text-base">
              <AlertTriangle className="w-5 h-5" />
              Low Stock Alerts ({stats.lowStock})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(warehouseItems || []).filter(i => i.is_active !== false && i.quantity <= i.min_stock_level && i.quantity > 0).slice(0, 10).map(item => (
                <Badge key={item.id} variant="outline" className="gap-1 border-yellow-500/50 text-yellow-600">
                  {item.product_name}: {item.quantity}/{item.min_stock_level}
                  {isSuperAdmin && (
                    <Button size="sm" variant="ghost" className="h-auto p-0 ml-1 text-xs" onClick={() => handleRestock(item, item.min_stock_level * 2)}>+restock</Button>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search products or SKUs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant={filterLowStock ? "default" : "outline"} size="sm" onClick={() => setFilterLowStock(!filterLowStock)}>
              <AlertTriangle className="w-4 h-4 mr-1" /> Low Stock
            </Button>
            <Button variant={showInactive ? "default" : "outline"} size="sm" onClick={() => setShowInactive(!showInactive)}>
              <Archive className="w-4 h-4 mr-1" /> Archived
            </Button>
            {isSuperAdmin && (
              <Button size="sm" onClick={() => { resetForm(); setShowDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Product
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>Product Catalog ({filteredItems.length})</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden sm:table-cell">SKU</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="hidden sm:table-cell">Cost (COGS)</TableHead>
                  <TableHead className="hidden sm:table-cell">Default Retail</TableHead>
                  <TableHead className="hidden lg:table-cell">Margin</TableHead>
                  <TableHead className="hidden lg:table-cell">Supplier</TableHead>
                  {isSuperAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map(item => {
                  const margin = (item.default_retail_price || 0) - item.unit_cost;
                  const marginPct = (item.default_retail_price || 0) > 0 ? (margin / item.default_retail_price) * 100 : 0;
                  const isOutOfStock = item.quantity === 0;
                  const isLow = item.quantity > 0 && item.quantity <= item.min_stock_level;
                  const isInactive = item.is_active === false;

                  return (
                    <TableRow key={item.id} className={isInactive ? "opacity-50" : isOutOfStock ? "bg-destructive/5" : isLow ? "bg-yellow-500/5" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            <div className="flex gap-1 mt-0.5">
                              {isOutOfStock && <Badge variant="destructive" className="text-[10px] px-1 py-0">Out of Stock</Badge>}
                              {isLow && <Badge variant="outline" className="text-[10px] px-1 py-0 border-yellow-500 text-yellow-600">Low</Badge>}
                              {isInactive && <Badge variant="secondary" className="text-[10px] px-1 py-0">Archived</Badge>}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-mono text-sm text-muted-foreground">{item.sku}</TableCell>
                      <TableCell className="hidden md:table-cell"><Badge variant="outline">{item.category}</Badge></TableCell>
                      <TableCell>
                        <span className={isOutOfStock ? "text-destructive font-medium" : isLow ? "text-yellow-500 font-medium" : ""}>{item.quantity}</span>
                        <span className="text-muted-foreground text-xs"> / {item.min_stock_level} min</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">${item.unit_cost.toFixed(2)}</TableCell>
                      <TableCell className="hidden sm:table-cell font-medium text-primary">${(item.default_retail_price || 0).toFixed(2)}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className={marginPct >= 30 ? "text-green-600" : marginPct >= 15 ? "text-yellow-500" : "text-destructive"}>
                          {marginPct.toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{item.supplier || "—"}</TableCell>
                      {isSuperAdmin && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(item)}>
                                <Edit className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRestock(item, 10)}>
                                <RefreshCw className="w-4 h-4 mr-2" /> Quick Restock (+10)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleActive(item)}>
                                <Archive className="w-4 h-4 mr-2" /> {item.is_active !== false ? "Archive" : "Reactivate"}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => { setSelectedItem(item); setShowDeleteConfirm(true); }}>
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? "Edit Product" : "Add Product to Catalog"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Product Name *</Label><Input value={formData.product_name} onChange={(e) => setFormData({ ...formData, product_name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>SKU *</Label><Input value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Category</Label>
                <SearchableSelect
                  options={CATEGORIES.map(c => ({ value: c, label: c }))}
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                  placeholder="Select category"
                  searchPlaceholder="Search categories..."
                />
              </div>
              <div className="space-y-2"><Label>Warehouse Location</Label><Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Stock Quantity</Label><Input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} required /></div>
              <div className="space-y-2"><Label>Min Stock Level</Label><Input type="number" value={formData.min_stock_level} onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })} required /></div>
              <div className="space-y-2">
                <Label>Cost of Goods (COGS) *</Label>
                <Input type="number" step="0.01" value={formData.unit_cost} onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })} required />
                <p className="text-xs text-muted-foreground">Your cost per unit from supplier</p>
              </div>
              <div className="space-y-2">
                <Label>Default Retail Price *</Label>
                <Input type="number" step="0.01" value={formData.default_retail_price} onChange={(e) => setFormData({ ...formData, default_retail_price: parseFloat(e.target.value) || 0 })} required />
                <p className="text-xs text-muted-foreground">Default selling price for machines (can be overridden per machine)</p>
              </div>
              <div className="space-y-2"><Label>Supplier</Label><Input value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} /></div>
              <div className="space-y-2 flex items-center gap-3 pt-6">
                <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
                <Label>Active in catalog</Label>
              </div>
            </div>
            {formData.unit_cost > 0 && formData.default_retail_price > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <span className="text-muted-foreground">Margin: </span>
                <span className="font-medium text-primary">
                  ${(formData.default_retail_price - formData.unit_cost).toFixed(2)} ({(((formData.default_retail_price - formData.unit_cost) / formData.default_retail_price) * 100).toFixed(1)}%)
                </span>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit">{editingItem ? "Update" : "Add"} Product</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>Are you sure you want to permanently delete "{selectedItem?.product_name}"? Consider archiving instead.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => selectedItem && deleteMutation.mutate(selectedItem.id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryLogistics;
