import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Monitor, DollarSign, Layers, ArrowUpDown, Gamepad2 } from "lucide-react";
import { ArcadePricingTemplates } from "./machines";

interface KioskCategory {
  id: string;
  machine_id: string;
  category_name: string;
  display_order: number;
  base_price: number;
  is_active: boolean;
  created_at: string;
  machine?: {
    name: string;
    machine_code: string;
  };
}

interface Machine {
  id: string;
  name: string;
  machine_code: string;
}

const DEFAULT_CATEGORIES = ["Snacks", "Drinks", "Candy", "Chips", "Fresh Food", "Coffee"];

const KioskCategoriesManager = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<KioskCategory | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<KioskCategory | null>(null);
  const [filterMachine, setFilterMachine] = useState<string>("all");

  const [formData, setFormData] = useState({
    machine_id: "",
    category_name: "",
    display_order: 0,
    base_price: 0,
    is_active: true,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch kiosk categories
  const { data: categories, isLoading } = useQuery({
    queryKey: ["kiosk-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machine_kiosk_categories")
        .select(`
          *,
          machine:vendx_machines(name, machine_code)
        `)
        .order("machine_id")
        .order("display_order");
      if (error) throw error;
      return data as KioskCategory[];
    },
  });

  // Fetch machines
  const { data: machines } = useQuery({
    queryKey: ["machines-for-kiosk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, name, machine_code")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as Machine[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("machine_kiosk_categories").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosk-categories"] });
      toast({ title: "Category added successfully" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { error } = await supabase.from("machine_kiosk_categories").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosk-categories"] });
      toast({ title: "Category updated successfully" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("machine_kiosk_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosk-categories"] });
      toast({ title: "Category deleted" });
      setShowDeleteConfirm(false);
      setSelectedCategory(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("machine_kiosk_categories").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosk-categories"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      machine_id: "",
      category_name: "",
      display_order: 0,
      base_price: 0,
      is_active: true,
    });
    setEditingCategory(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (category: KioskCategory) => {
    setEditingCategory(category);
    setFormData({
      machine_id: category.machine_id,
      category_name: category.category_name,
      display_order: category.display_order,
      base_price: category.base_price,
      is_active: category.is_active,
    });
    setShowDialog(true);
  };

  const handleAddDefaultCategories = async (machineId: string) => {
    const existingCategories = categories?.filter(c => c.machine_id === machineId) || [];
    const existingNames = existingCategories.map(c => c.category_name.toLowerCase());
    
    const newCategories = DEFAULT_CATEGORIES
      .filter(name => !existingNames.includes(name.toLowerCase()))
      .map((name, idx) => ({
        machine_id: machineId,
        category_name: name,
        display_order: existingCategories.length + idx,
        base_price: name === "Drinks" ? 2.00 : name === "Fresh Food" ? 3.50 : name === "Coffee" ? 2.50 : 1.50,
        is_active: true,
      }));

    if (newCategories.length === 0) {
      toast({ title: "All default categories already exist for this machine" });
      return;
    }

    const { error } = await supabase.from("machine_kiosk_categories").insert(newCategories);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["kiosk-categories"] });
      toast({ title: `Added ${newCategories.length} default categories` });
    }
  };

  const filteredCategories = filterMachine === "all"
    ? categories
    : categories?.filter(c => c.machine_id === filterMachine);

  // Group categories by machine
  const categoriesByMachine = filteredCategories?.reduce((acc, cat) => {
    const machineId = cat.machine_id;
    if (!acc[machineId]) {
      acc[machineId] = {
        machine: cat.machine,
        categories: [],
      };
    }
    acc[machineId].categories.push(cat);
    return acc;
  }, {} as Record<string, { machine: KioskCategory["machine"]; categories: KioskCategory[] }>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Kiosk Setup</h2>
          <p className="text-muted-foreground">Manage kiosk categories, pricing, and arcade pricing templates</p>
        </div>
      </div>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Vending Categories
          </TabsTrigger>
          <TabsTrigger value="arcade-pricing" className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4" />
            Arcade Pricing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setShowDialog(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Label>Filter by Machine:</Label>
              <Select value={filterMachine} onValueChange={setFilterMachine}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="All Machines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Machines</SelectItem>
                  {machines?.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.machine_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filterMachine !== "all" && (
              <Button variant="outline" onClick={() => handleAddDefaultCategories(filterMachine)}>
                <Layers className="w-4 h-4 mr-2" />
                Add Default Categories
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Categories by Machine */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">Loading...</CardContent>
        </Card>
      ) : Object.keys(categoriesByMachine || {}).length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No kiosk categories configured yet</p>
            <p className="text-sm">Select a machine and add categories to customize the kiosk display</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(categoriesByMachine || {}).map(([machineId, { machine, categories: cats }]) => (
          <Card key={machineId}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                {machine?.name || "Unknown Machine"}
                <Badge variant="outline" className="font-mono">{machine?.machine_code}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Order</TableHead>
                    <TableHead>Category Name</TableHead>
                    <TableHead>Base Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cats.sort((a, b) => a.display_order - b.display_order).map(cat => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-mono text-muted-foreground">{cat.display_order}</TableCell>
                      <TableCell className="font-medium">{cat.category_name}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-green-500 font-medium">
                          <DollarSign className="w-4 h-4" />
                          {cat.base_price.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={cat.is_active}
                          onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: cat.id, is_active: checked })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(cat)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { setSelectedCategory(cat); setShowDeleteConfirm(true); }}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "Add Category"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Machine *</Label>
              <Select
                value={formData.machine_id}
                onValueChange={(v) => setFormData({ ...formData, machine_id: v })}
                disabled={!!editingCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a machine" />
                </SelectTrigger>
                <SelectContent>
                  {machines?.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.machine_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category Name *</Label>
              <Input
                value={formData.category_name}
                onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                placeholder="e.g. Snacks, Drinks, Candy"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base Price ($) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit">{editingCategory ? "Update" : "Add"} Category</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedCategory?.category_name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => selectedCategory && deleteMutation.mutate(selectedCategory.id)}>
              Delete Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        </TabsContent>

        <TabsContent value="arcade-pricing" className="space-y-4">
          <ArcadePricingTemplates />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KioskCategoriesManager;