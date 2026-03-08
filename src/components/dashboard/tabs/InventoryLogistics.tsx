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
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, AlertTriangle, Trash2, Edit, Search, RefreshCw, Warehouse, TrendingDown, DollarSign, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface InventoryItem {
  id: string;
  product_name: string;
  sku: string;
  category: string;
  quantity: number;
  min_stock_level: number;
  location: string;
  unit_cost: number;
  supplier: string | null;
  last_restocked: string | null;
}

const CATEGORIES = [
  "Snacks", "Beverages", "Fresh Food", "Candy",
  "Healthy Options", "Coffee/Tea", "Supplies", "Other",
];

const InventoryLogistics = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterLowStock, setFilterLowStock] = useState(false);

  const [formData, setFormData] = useState({
    product_name: "", sku: "", category: "Snacks",
    quantity: 0, min_stock_level: 10, location: "Main Warehouse",
    unit_cost: 0, supplier: "",
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
      return data as InventoryItem[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("inventory_items").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      toast({ title: "Warehouse item added successfully" });
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
      toast({ title: "Item updated successfully" });
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
      toast({ title: "Item deleted" });
      setShowDeleteConfirm(false);
      setSelectedItem(null);
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setFormData({ product_name: "", sku: "", category: "Snacks", quantity: 0, min_stock_level: 10, location: "Main Warehouse", unit_cost: 0, supplier: "" });
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

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      product_name: item.product_name, sku: item.sku, category: item.category,
      quantity: item.quantity, min_stock_level: item.min_stock_level,
      location: item.location, unit_cost: item.unit_cost, supplier: item.supplier || "",
    });
    setShowDialog(true);
  };

  const handleRestock = async (item: InventoryItem, addQty: number) => {
    await supabase
      .from("inventory_items")
      .update({ quantity: item.quantity + addQty, last_restocked: new Date().toISOString() })
      .eq("id", item.id);
    queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    toast({ title: `Added ${addQty} units to ${item.product_name}` });
  };

  const filteredItems = useMemo(() => {
    return (warehouseItems || []).filter(item => {
      const matchesSearch = item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === "all" || item.category === filterCategory;
      const matchesLowStock = !filterLowStock || item.quantity <= item.min_stock_level;
      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [warehouseItems, searchTerm, filterCategory, filterLowStock]);

  const stats = useMemo(() => {
    const items = warehouseItems || [];
    return {
      totalItems: items.length,
      totalUnits: items.reduce((sum, i) => sum + i.quantity, 0),
      lowStock: items.filter(i => i.quantity <= i.min_stock_level).length,
      totalValue: items.reduce((sum, i) => sum + (i.quantity * i.unit_cost), 0),
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
            <span className="truncate">Warehouse Inventory</span>
          </h2>
          <p className="text-sm text-muted-foreground">Manage central warehouse stock</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["inventory-items"] })}>
          <RefreshCw className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground flex items-center gap-2"><Package className="w-4 h-4" /> Total SKUs</p><p className="text-2xl font-bold">{stats.totalItems}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground flex items-center gap-2"><Warehouse className="w-4 h-4" /> Total Units</p><p className="text-2xl font-bold">{stats.totalUnits.toLocaleString()}</p></CardContent></Card>
        <Card className={stats.lowStock > 0 ? "border-destructive/50" : ""}><CardContent className="p-6"><p className="text-sm text-muted-foreground flex items-center gap-2"><TrendingDown className="w-4 h-4" /> Low Stock</p><p className={`text-2xl font-bold ${stats.lowStock > 0 ? "text-destructive" : ""}`}>{stats.lowStock}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="w-4 h-4" /> Inventory Value</p><p className="text-2xl font-bold">${stats.totalValue.toLocaleString()}</p></CardContent></Card>
      </div>

      {/* Low Stock Alerts */}
      {stats.lowStock > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Low Stock Alerts ({stats.lowStock})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(warehouseItems || []).filter(i => i.quantity <= i.min_stock_level).slice(0, 10).map(item => (
                <Badge key={item.id} variant="destructive" className="gap-1">
                  {item.product_name}: {item.quantity}/{item.min_stock_level}
                  <Button size="sm" variant="ghost" className="h-auto p-0 ml-1" onClick={() => handleRestock(item, item.min_stock_level * 2)}>+</Button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant={filterLowStock ? "default" : "outline"} size="sm" onClick={() => setFilterLowStock(!filterLowStock)}>
              <AlertTriangle className="w-4 h-4 mr-2" /> Low Stock Only
            </Button>
            {isSuperAdmin && (
              <Button onClick={() => { resetForm(); setShowDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Add Item
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>Warehouse Inventory ({filteredItems.length})</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden sm:table-cell">SKU</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden lg:table-cell">Location</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead className="hidden sm:table-cell">Unit Cost</TableHead>
                  <TableHead className="hidden md:table-cell">Value</TableHead>
                  {isSuperAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map(item => (
                  <TableRow key={item.id} className={item.quantity <= item.min_stock_level ? "bg-destructive/5" : ""}>
                    <TableCell className="font-medium">
                      {item.product_name}
                      {item.quantity <= item.min_stock_level && <AlertTriangle className="w-3 h-3 text-destructive inline ml-2" />}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-sm text-muted-foreground">{item.sku}</TableCell>
                    <TableCell className="hidden md:table-cell"><Badge variant="outline">{item.category}</Badge></TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{item.location}</TableCell>
                    <TableCell>
                      <span className={item.quantity <= item.min_stock_level ? "text-destructive font-medium" : ""}>{item.quantity}</span>
                      <span className="text-muted-foreground">/{item.min_stock_level}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">${item.unit_cost.toFixed(2)}</TableCell>
                    <TableCell className="hidden md:table-cell font-medium">${(item.quantity * item.unit_cost).toFixed(2)}</TableCell>
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
                            <DropdownMenuItem className="text-destructive" onClick={() => { setSelectedItem(item); setShowDeleteConfirm(true); }}>
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? "Edit Warehouse Item" : "Add Warehouse Item"}</DialogTitle></DialogHeader>
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
              <div className="space-y-2"><Label>Location</Label><Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Quantity</Label><Input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} required /></div>
              <div className="space-y-2"><Label>Min Stock Level</Label><Input type="number" value={formData.min_stock_level} onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })} required /></div>
              <div className="space-y-2"><Label>Unit Cost ($)</Label><Input type="number" step="0.01" value={formData.unit_cost} onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })} required /></div>
              <div className="space-y-2"><Label>Supplier</Label><Input value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit">{editingItem ? "Update" : "Add"} Item</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>Are you sure you want to delete "{selectedItem?.product_name}"? This cannot be undone.</DialogDescription>
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
