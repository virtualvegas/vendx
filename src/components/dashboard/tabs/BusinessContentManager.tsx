import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical, Package, Star, MessageSquare } from "lucide-react";

const ICON_OPTIONS = [
  "Package", "Gamepad2", "Coins", "Candy", "CreditCard", "Smartphone",
  "DollarSign", "TrendingUp", "Wrench", "BarChart3", "Shield", "Clock",
  "Star", "Zap", "Users", "Building2", "Monitor", "Cpu", "Box", "Truck"
];

interface Service {
  id: string;
  icon: string;
  title: string;
  description: string;
  features: string[];
  display_order: number;
  is_active: boolean;
}

interface Benefit {
  id: string;
  icon: string;
  title: string;
  description: string;
  display_order: number;
  is_active: boolean;
}

interface Testimonial {
  id: string;
  name: string;
  role: string;
  location: string;
  quote: string;
  rating: number;
  is_featured: boolean;
  is_active: boolean;
}

const BusinessContentManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Dialog states
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [benefitDialogOpen, setBenefitDialogOpen] = useState(false);
  const [testimonialDialogOpen, setTestimonialDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);

  // Form states
  const [serviceForm, setServiceForm] = useState({
    icon: "Package",
    title: "",
    description: "",
    features: "",
    display_order: 0,
    is_active: true
  });

  const [benefitForm, setBenefitForm] = useState({
    icon: "Star",
    title: "",
    description: "",
    display_order: 0,
    is_active: true
  });

  const [testimonialForm, setTestimonialForm] = useState({
    name: "",
    role: "",
    location: "",
    quote: "",
    rating: 5,
    is_featured: false,
    is_active: true
  });

  // Fetch services
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["admin-business-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_services")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as Service[];
    },
  });

  // Fetch benefits
  const { data: benefits, isLoading: benefitsLoading } = useQuery({
    queryKey: ["admin-business-benefits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_benefits")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as Benefit[];
    },
  });

  // Fetch testimonials
  const { data: testimonials, isLoading: testimonialsLoading } = useQuery({
    queryKey: ["admin-business-testimonials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_testimonials")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Testimonial[];
    },
  });

  // Service mutations
  const saveServiceMutation = useMutation({
    mutationFn: async (data: { icon: string; title: string; description: string; features: string[]; display_order: number; is_active: boolean }) => {
      if (editingService) {
        const { error } = await supabase
          .from("business_services")
          .update(data)
          .eq("id", editingService.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("business_services")
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-business-services"] });
      setServiceDialogOpen(false);
      setEditingService(null);
      resetServiceForm();
      toast({ title: "Service saved successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-business-services"] });
      toast({ title: "Service deleted" });
    },
  });

  // Benefit mutations
  const saveBenefitMutation = useMutation({
    mutationFn: async (data: { icon: string; title: string; description: string; display_order: number; is_active: boolean }) => {
      if (editingBenefit) {
        const { error } = await supabase
          .from("business_benefits")
          .update(data)
          .eq("id", editingBenefit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("business_benefits").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-business-benefits"] });
      setBenefitDialogOpen(false);
      setEditingBenefit(null);
      resetBenefitForm();
      toast({ title: "Benefit saved successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteBenefitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_benefits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-business-benefits"] });
      toast({ title: "Benefit deleted" });
    },
  });

  // Testimonial mutations
  const saveTestimonialMutation = useMutation({
    mutationFn: async (data: { name: string; role: string; location: string; quote: string; rating: number; is_featured: boolean; is_active: boolean }) => {
      if (editingTestimonial) {
        const { error } = await supabase
          .from("business_testimonials")
          .update(data)
          .eq("id", editingTestimonial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("business_testimonials").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-business-testimonials"] });
      setTestimonialDialogOpen(false);
      setEditingTestimonial(null);
      resetTestimonialForm();
      toast({ title: "Testimonial saved successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTestimonialMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_testimonials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-business-testimonials"] });
      toast({ title: "Testimonial deleted" });
    },
  });

  // Form reset functions
  const resetServiceForm = () => {
    setServiceForm({ icon: "Package", title: "", description: "", features: "", display_order: 0, is_active: true });
  };

  const resetBenefitForm = () => {
    setBenefitForm({ icon: "Star", title: "", description: "", display_order: 0, is_active: true });
  };

  const resetTestimonialForm = () => {
    setTestimonialForm({ name: "", role: "", location: "", quote: "", rating: 5, is_featured: false, is_active: true });
  };

  // Edit handlers
  const handleEditService = (service: Service) => {
    setEditingService(service);
    setServiceForm({
      icon: service.icon,
      title: service.title,
      description: service.description,
      features: service.features?.join(", ") || "",
      display_order: service.display_order,
      is_active: service.is_active
    });
    setServiceDialogOpen(true);
  };

  const handleEditBenefit = (benefit: Benefit) => {
    setEditingBenefit(benefit);
    setBenefitForm({
      icon: benefit.icon,
      title: benefit.title,
      description: benefit.description,
      display_order: benefit.display_order,
      is_active: benefit.is_active
    });
    setBenefitDialogOpen(true);
  };

  const handleEditTestimonial = (testimonial: Testimonial) => {
    setEditingTestimonial(testimonial);
    setTestimonialForm({
      name: testimonial.name,
      role: testimonial.role,
      location: testimonial.location,
      quote: testimonial.quote,
      rating: testimonial.rating,
      is_featured: testimonial.is_featured,
      is_active: testimonial.is_active
    });
    setTestimonialDialogOpen(true);
  };

  // Submit handlers
  const handleServiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const features = serviceForm.features.split(",").map(f => f.trim()).filter(Boolean);
    saveServiceMutation.mutate({ ...serviceForm, features });
  };

  const handleBenefitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveBenefitMutation.mutate(benefitForm);
  };

  const handleTestimonialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveTestimonialMutation.mutate(testimonialForm);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Business Page Content</h2>
        <p className="text-muted-foreground">Manage services, benefits, and testimonials displayed on the business page</p>
      </div>

      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Services
          </TabsTrigger>
          <TabsTrigger value="benefits" className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            Benefits
          </TabsTrigger>
          <TabsTrigger value="testimonials" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Testimonials
          </TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Services</CardTitle>
                <CardDescription>Machine and service offerings for business partners</CardDescription>
              </div>
              <Button onClick={() => { resetServiceForm(); setEditingService(null); setServiceDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Service
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="hidden sm:table-cell">Order</TableHead>
                      <TableHead className="hidden md:table-cell">Icon</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="hidden lg:table-cell">Features</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services?.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell className="hidden sm:table-cell">
                          <GripVertical className="w-4 h-4 text-muted-foreground inline" />
                          {service.display_order}
                        </TableCell>
                        <TableCell className="hidden md:table-cell"><Badge variant="outline">{service.icon}</Badge></TableCell>
                        <TableCell className="font-medium">{service.title}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {service.features?.slice(0, 2).map((f, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
                            ))}
                            {(service.features?.length || 0) > 2 && (
                              <Badge variant="secondary" className="text-xs">+{service.features!.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={service.is_active ? "default" : "secondary"}>
                            {service.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditService(service)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteServiceMutation.mutate(service.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Benefits Tab */}
        <TabsContent value="benefits">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Benefits</CardTitle>
                <CardDescription>Why businesses should partner with VendX</CardDescription>
              </div>
              <Button onClick={() => { resetBenefitForm(); setEditingBenefit(null); setBenefitDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Benefit
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Icon</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {benefits?.map((benefit) => (
                      <TableRow key={benefit.id}>
                        <TableCell>{benefit.display_order}</TableCell>
                        <TableCell><Badge variant="outline">{benefit.icon}</Badge></TableCell>
                        <TableCell className="font-medium">{benefit.title}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{benefit.description}</TableCell>
                        <TableCell>
                          <Badge variant={benefit.is_active ? "default" : "secondary"}>
                            {benefit.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditBenefit(benefit)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteBenefitMutation.mutate(benefit.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Testimonials Tab */}
        <TabsContent value="testimonials">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Testimonials</CardTitle>
                <CardDescription>Partner reviews and success stories</CardDescription>
              </div>
              <Button onClick={() => { resetTestimonialForm(); setEditingTestimonial(null); setTestimonialDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Testimonial
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Featured</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testimonials?.map((testimonial) => (
                      <TableRow key={testimonial.id}>
                        <TableCell className="font-medium">{testimonial.name}</TableCell>
                        <TableCell>{testimonial.role}</TableCell>
                        <TableCell>{testimonial.location}</TableCell>
                        <TableCell>{"⭐".repeat(testimonial.rating)}</TableCell>
                        <TableCell>
                          <Badge variant={testimonial.is_featured ? "default" : "outline"}>
                            {testimonial.is_featured ? "Featured" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={testimonial.is_active ? "default" : "secondary"}>
                            {testimonial.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditTestimonial(testimonial)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteTestimonialMutation.mutate(testimonial.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Service Dialog */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit Service" : "Add Service"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleServiceSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select value={serviceForm.icon} onValueChange={(v) => setServiceForm({...serviceForm, icon: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map(icon => (
                      <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input 
                  type="number" 
                  value={serviceForm.display_order}
                  onChange={(e) => setServiceForm({...serviceForm, display_order: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input 
                value={serviceForm.title}
                onChange={(e) => setServiceForm({...serviceForm, title: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea 
                value={serviceForm.description}
                onChange={(e) => setServiceForm({...serviceForm, description: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Features (comma separated)</Label>
              <Input 
                value={serviceForm.features}
                onChange={(e) => setServiceForm({...serviceForm, features: e.target.value})}
                placeholder="Revenue sharing, Full maintenance, ..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={serviceForm.is_active}
                onCheckedChange={(v) => setServiceForm({...serviceForm, is_active: v})}
              />
              <Label>Active</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setServiceDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveServiceMutation.isPending}>
                {saveServiceMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Benefit Dialog */}
      <Dialog open={benefitDialogOpen} onOpenChange={setBenefitDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBenefit ? "Edit Benefit" : "Add Benefit"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBenefitSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select value={benefitForm.icon} onValueChange={(v) => setBenefitForm({...benefitForm, icon: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map(icon => (
                      <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input 
                  type="number" 
                  value={benefitForm.display_order}
                  onChange={(e) => setBenefitForm({...benefitForm, display_order: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input 
                value={benefitForm.title}
                onChange={(e) => setBenefitForm({...benefitForm, title: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea 
                value={benefitForm.description}
                onChange={(e) => setBenefitForm({...benefitForm, description: e.target.value})}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={benefitForm.is_active}
                onCheckedChange={(v) => setBenefitForm({...benefitForm, is_active: v})}
              />
              <Label>Active</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBenefitDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveBenefitMutation.isPending}>
                {saveBenefitMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Testimonial Dialog */}
      <Dialog open={testimonialDialogOpen} onOpenChange={setTestimonialDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTestimonial ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTestimonialSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input 
                  value={testimonialForm.name}
                  onChange={(e) => setTestimonialForm({...testimonialForm, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Role *</Label>
                <Input 
                  value={testimonialForm.role}
                  onChange={(e) => setTestimonialForm({...testimonialForm, role: e.target.value})}
                  placeholder="Restaurant Owner"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Location *</Label>
                <Input 
                  value={testimonialForm.location}
                  onChange={(e) => setTestimonialForm({...testimonialForm, location: e.target.value})}
                  placeholder="Boston, MA"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Rating</Label>
                <Select 
                  value={testimonialForm.rating.toString()} 
                  onValueChange={(v) => setTestimonialForm({...testimonialForm, rating: parseInt(v)})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(r => (
                      <SelectItem key={r} value={r.toString()}>{"⭐".repeat(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Quote *</Label>
              <Textarea 
                value={testimonialForm.quote}
                onChange={(e) => setTestimonialForm({...testimonialForm, quote: e.target.value})}
                required
                rows={3}
              />
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch 
                  checked={testimonialForm.is_featured}
                  onCheckedChange={(v) => setTestimonialForm({...testimonialForm, is_featured: v})}
                />
                <Label>Featured</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={testimonialForm.is_active}
                  onCheckedChange={(v) => setTestimonialForm({...testimonialForm, is_active: v})}
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTestimonialDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveTestimonialMutation.isPending}>
                {saveTestimonialMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessContentManager;
