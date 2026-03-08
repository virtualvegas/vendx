import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Layers, Eye, EyeOff } from "lucide-react";

interface Division {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  status: string | null;
  features: any[] | null;
  created_at: string;
}

const iconOptions = [
  { value: "Zap", label: "Zap (Mini)" },
  { value: "Maximize2", label: "Maximize (Max)" },
  { value: "Leaf", label: "Leaf (Fresh)" },
  { value: "Monitor", label: "Monitor (Digital)" },
  { value: "Truck", label: "Truck (Logistics)" },
  { value: "Bot", label: "Bot (Robotics)" },
  { value: "Rocket", label: "Rocket (Mars)" },
  { value: "Gamepad2", label: "Gamepad (Interactive)" },
];

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "inactive", label: "Inactive" },
];

const DivisionsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDivision, setEditingDivision] = useState<Division | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
    status: "active",
  });

  const { data: divisions, isLoading } = useQuery({
    queryKey: ["divisions-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("divisions")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Division[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; slug: string; description: string | null; icon: string | null; status: string }) => {
      const { error } = await supabase.from("divisions").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divisions-admin"] });
      toast({ title: "Division created successfully" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error creating division", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Division> }) => {
      const { error } = await supabase.from("divisions").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divisions-admin"] });
      toast({ title: "Division updated successfully" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error updating division", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("divisions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divisions-admin"] });
      toast({ title: "Division deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error deleting division", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setForm({ name: "", slug: "", description: "", icon: "", status: "active" });
    setEditingDivision(null);
  };

  const handleEdit = (division: Division) => {
    setEditingDivision(division);
    setForm({
      name: division.name,
      slug: division.slug,
      description: division.description || "",
      icon: division.icon || "",
      status: division.status || "active",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: form.name,
      slug: form.slug,
      description: form.description || null,
      icon: form.icon || null,
      status: form.status,
    };

    if (editingDivision) {
      updateMutation.mutate({ id: editingDivision.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-accent text-accent-foreground">Active</Badge>;
      case "coming_soon":
        return <Badge className="bg-primary/20 text-primary border-primary/30">Coming Soon</Badge>;
      case "inactive":
        return <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Division Management</h2>
          <p className="text-muted-foreground">Manage VendX business divisions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Division
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingDivision ? "Edit Division" : "Add New Division"}</DialogTitle>
              <DialogDescription>
                {editingDivision ? "Update division details" : "Create a new VendX division"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Division Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value, slug: generateSlug(e.target.value) });
                  }}
                  placeholder="VendX Mini"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="vendx-mini"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of the division..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon</Label>
                  <Select value={form.icon} onValueChange={(value) => setForm({ ...form, icon: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select icon" />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map((icon) => (
                        <SelectItem key={icon.value} value={icon.value}>
                          {icon.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingDivision ? "Update Division" : "Create Division"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Divisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{divisions?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">
              {divisions?.filter((d) => d.status === "active").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Coming Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {divisions?.filter((d) => d.status === "coming_soon").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Divisions Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            All Divisions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading divisions...</div>
          ) : divisions && divisions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Slug</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {divisions.map((division) => (
                  <TableRow key={division.id}>
                    <TableCell className="font-medium">{division.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">/divisions/{division.slug}</TableCell>
                    <TableCell className="hidden md:table-cell max-w-xs truncate text-muted-foreground">
                      {division.description || "—"}
                    </TableCell>
                    <TableCell>{getStatusBadge(division.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/divisions/${division.slug}`, "_blank")}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(division)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Delete "${division.name}"?`)) {
                              deleteMutation.mutate(division.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No divisions found. Create your first division to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DivisionsManager;