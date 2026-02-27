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
import { Plus, Trash2, Edit, Monitor, DollarSign, Layers, Gamepad2, Settings2 } from "lucide-react";
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
  machine_type: string;
  status: string;
  price_per_play: number | null;
  plays_per_bundle: number | null;
  bundle_price: number | null;
  pricing_template_id: string | null;
  location_id: string | null;
}

interface PricingTemplate {
  id: string;
  name: string;
  price_per_play: number;
  is_default: boolean;
}

const DEFAULT_CATEGORIES = ["Snacks", "Drinks", "Candy", "Chips", "Fresh Food", "Coffee"];

const KioskCategoriesManager = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<KioskCategory | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<KioskCategory | null>(null);
  const [filterMachine, setFilterMachine] = useState<string>("all");
  const [editingMachinePricing, setEditingMachinePricing] = useState<Machine | null>(null);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [pricingForm, setPricingForm] = useState({
    pricing_mode: "template" as "template" | "custom",
    pricing_template_id: "",
    price_per_play: 1.0,
    plays_per_bundle: 1,
    bundle_price: null as number | null,
  });

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
        .select(`*, machine:vendx_machines(name, machine_code)`)
        .order("machine_id")
        .order("display_order");
      if (error) throw error;
      return data as KioskCategory[];
    },
  });

  // Fetch all machines
  const { data: machines } = useQuery({
    queryKey: ["machines-for-kiosk-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, name, machine_code, machine_type, status, price_per_play, plays_per_bundle, bundle_price, pricing_template_id, location_id")
        .order("name");
      if (error) throw error;
      return data as Machine[];
    },
  });

  // Fetch pricing templates
  const { data: pricingTemplates } = useQuery({
    queryKey: ["arcade-pricing-templates-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arcade_pricing_templates")
        .select("id, name, price_per_play, is_default")
        .eq("is_active", true)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data as PricingTemplate[];
    },
  });

  const activeMachines = machines?.filter(m => m.status === "active") || [];
  const vendingTypes = ["snack", "beverage", "combo", "fresh", "digital", "ecosnack"];
  const arcadeTypes = ["arcade", "claw"];

  // Category mutations
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { error } = await supabase.from("machine_kiosk_categories").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosk-categories"] });
      toast({ title: "Category updated" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("machine_kiosk_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosk-categories"] });
      toast({ title: "Category deleted" });
      setShowDeleteConfirm(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("machine_kiosk_categories").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosk-categories"] });
    },
  });

  const resetForm = () => {
    setFormData({ machine_id: "", category_name: "", display_order: 0, base_price: 0, is_active: true });
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
    try {
      const inserts = DEFAULT_CATEGORIES.map((name, i) => ({
        machine_id: machineId,
        category_name: name,
        display_order: i + 1,
        base_price: 1.50,
        is_active: true,
      }));
      const { error } = await supabase.from("machine_kiosk_categories").insert(inserts);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["kiosk-categories"] });
      toast({ title: "Default categories added" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openMachinePricing = (machine: Machine) => {
    setEditingMachinePricing(machine);
    setPricingForm({
      pricing_mode: machine.pricing_template_id ? "template" : "custom",
      pricing_template_id: machine.pricing_template_id || "",
      price_per_play: machine.price_per_play || 1.0,
      plays_per_bundle: machine.plays_per_bundle || 1,
      bundle_price: machine.bundle_price,
    });
    setShowPricingDialog(true);
  };

  const saveMachinePricing = async () => {
    if (!editingMachinePricing) return;
    try {
      const updateData: Record<string, any> = {};
      if (pricingForm.pricing_mode === "template" && pricingForm.pricing_template_id) {
        updateData.pricing_template_id = pricingForm.pricing_template_id;
        updateData.price_per_play = null;
        updateData.plays_per_bundle = null;
        updateData.bundle_price = null;
      } else {
        updateData.pricing_template_id = null;
        updateData.price_per_play = pricingForm.price_per_play;
        updateData.plays_per_bundle = pricingForm.plays_per_bundle;
        updateData.bundle_price = pricingForm.bundle_price;
      }

      const { error } = await supabase
        .from("vendx_machines")
        .update(updateData)
        .eq("id", editingMachinePricing.id);
      if (error) throw error;

      toast({ title: "Machine pricing updated" });
      setShowPricingDialog(false);
      queryClient.invalidateQueries({ queryKey: ["machines-for-kiosk-full"] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const filteredCategories = filterMachine === "all"
    ? categories
    : categories?.filter(c => c.machine_id === filterMachine);

  const categoriesByMachine = filteredCategories?.reduce((acc, cat) => {
    const machineId = cat.machine_id;
    if (!acc[machineId]) {
      acc[machineId] = { machine: cat.machine, categories: [] };
    }
    acc[machineId].categories.push(cat);
    return acc;
  }, {} as Record<string, { machine: KioskCategory["machine"]; categories: KioskCategory[] }>);

  const getTemplateName = (id: string | null) => {
    if (!id) return null;
    return pricingTemplates?.find(t => t.id === id)?.name || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Kiosk Setup</h2>
        <p className="text-muted-foreground">Manage kiosk categories, pricing templates, and per-machine pricing</p>
      </div>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Vending Categories
          </TabsTrigger>
          <TabsTrigger value="machine-pricing" className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Machine Pricing
          </TabsTrigger>
          <TabsTrigger value="arcade-pricing" className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4" />
            Arcade Templates
          </TabsTrigger>
        </TabsList>

        {/* ─── VENDING CATEGORIES TAB ─── */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetForm(); setShowDialog(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </div>

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
                      {activeMachines.filter(m => vendingTypes.includes(m.machine_type)).map(m => (
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

          {isLoading ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">Loading...</CardContent></Card>
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
                            <span className="flex items-center gap-1 text-accent font-medium">
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
        </TabsContent>

        {/* ─── MACHINE PRICING TAB ─── */}
        <TabsContent value="machine-pricing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Per-Machine Pricing
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Set custom pricing or assign a template for each machine. Arcade machines use play pricing; vending machines use category base prices.
              </p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Machine</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Pricing Mode</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Bundle</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeMachines.map(machine => {
                      const isArcade = arcadeTypes.includes(machine.machine_type);
                      const templateName = getTemplateName(machine.pricing_template_id);
                      const categoryCount = categories?.filter(c => c.machine_id === machine.id).length || 0;

                      return (
                        <TableRow key={machine.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{machine.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{machine.machine_code}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{machine.machine_type}</Badge>
                          </TableCell>
                          <TableCell>
                            {isArcade ? (
                              templateName ? (
                                <Badge className="bg-primary/20 text-primary border-primary/30">Template: {templateName}</Badge>
                              ) : machine.price_per_play ? (
                                <Badge variant="secondary">Custom</Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">Not set</Badge>
                              )
                            ) : (
                              <Badge variant="secondary">{categoryCount} categories</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {isArcade ? (
                              <span className="font-medium">
                                {machine.price_per_play ? `$${machine.price_per_play.toFixed(2)}/play` : "—"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">Per-category</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isArcade && machine.plays_per_bundle && machine.plays_per_bundle > 1 ? (
                              <span className="text-sm">
                                {machine.plays_per_bundle} plays / ${machine.bundle_price?.toFixed(2) || "—"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => openMachinePricing(machine)}>
                              <Edit className="w-3 h-3 mr-1" />
                              {isArcade ? "Set Pricing" : "Edit"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ARCADE TEMPLATES TAB ─── */}
        <TabsContent value="arcade-pricing" className="space-y-4">
          <ArcadePricingTemplates />
        </TabsContent>
      </Tabs>

      {/* ─── ADD/EDIT CATEGORY DIALOG ─── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
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
                  {activeMachines.filter(m => vendingTypes.includes(m.machine_type)).map(m => (
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

      {/* ─── DELETE CATEGORY DIALOG ─── */}
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

      {/* ─── MACHINE PRICING DIALOG ─── */}
      <Dialog open={showPricingDialog} onOpenChange={setShowPricingDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Pricing — {editingMachinePricing?.name}
            </DialogTitle>
            <DialogDescription>
              {arcadeTypes.includes(editingMachinePricing?.machine_type || "")
                ? "Set arcade play pricing for this machine"
                : "Configure pricing for this vending machine"}
            </DialogDescription>
          </DialogHeader>

          {arcadeTypes.includes(editingMachinePricing?.machine_type || "") ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pricing Mode</Label>
                <Select
                  value={pricingForm.pricing_mode}
                  onValueChange={(v) => setPricingForm({ ...pricingForm, pricing_mode: v as "template" | "custom" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="template">Use Template</SelectItem>
                    <SelectItem value="custom">Custom Pricing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {pricingForm.pricing_mode === "template" ? (
                <div className="space-y-2">
                  <Label>Select Template</Label>
                  <Select
                    value={pricingForm.pricing_template_id}
                    onValueChange={(v) => setPricingForm({ ...pricingForm, pricing_template_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {pricingTemplates?.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} (${t.price_per_play.toFixed(2)}/play)
                          {t.is_default && " ★"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Price Per Play ($)</Label>
                    <Input
                      type="number"
                      step="0.25"
                      min="0.25"
                      value={pricingForm.price_per_play}
                      onChange={(e) => setPricingForm({ ...pricingForm, price_per_play: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Plays per Bundle</Label>
                      <Input
                        type="number"
                        min="1"
                        value={pricingForm.plays_per_bundle}
                        onChange={(e) => setPricingForm({ ...pricingForm, plays_per_bundle: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bundle Price ($)</Label>
                      <Input
                        type="number"
                        step="0.25"
                        min="0"
                        value={pricingForm.bundle_price ?? ""}
                        onChange={(e) => setPricingForm({ ...pricingForm, bundle_price: e.target.value ? parseFloat(e.target.value) : null })}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  {pricingForm.bundle_price && pricingForm.plays_per_bundle > 1 && (
                    <p className="text-sm text-muted-foreground">
                      Savings: ${((pricingForm.price_per_play * pricingForm.plays_per_bundle) - pricingForm.bundle_price).toFixed(2)}{" "}
                      ({Math.round((1 - pricingForm.bundle_price / (pricingForm.price_per_play * pricingForm.plays_per_bundle)) * 100)}% off)
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Vending machines use per-category pricing. Manage categories in the <strong>Vending Categories</strong> tab.
              </p>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Current Categories:</p>
                {categories?.filter(c => c.machine_id === editingMachinePricing?.id).length ? (
                  <div className="space-y-1">
                    {categories?.filter(c => c.machine_id === editingMachinePricing?.id).map(c => (
                      <div key={c.id} className="flex justify-between text-sm">
                        <span>{c.category_name}</span>
                        <span className="font-medium">${c.base_price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No categories configured</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPricingDialog(false)}>Cancel</Button>
            {arcadeTypes.includes(editingMachinePricing?.machine_type || "") && (
              <Button onClick={saveMachinePricing}>Save Pricing</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KioskCategoriesManager;
