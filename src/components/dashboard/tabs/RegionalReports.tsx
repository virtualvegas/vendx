import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, TrendingUp, Trash2, Edit } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Region {
  id: string;
  name: string;
  country: string;
  active_machines: number;
  monthly_revenue: number;
  monthly_transactions: number;
  growth_rate: number;
}

const RegionalReports = () => {
  const [open, setOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    country: "",
    active_machines: 0,
    monthly_revenue: 0,
    monthly_transactions: 0,
    growth_rate: 0,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: regions, isLoading } = useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regions")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Region[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("regions").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regions"] });
      toast({ title: "Success", description: "Region added successfully" });
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { error } = await supabase.from("regions").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regions"] });
      toast({ title: "Success", description: "Region updated successfully" });
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("regions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regions"] });
      toast({ title: "Success", description: "Region deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      country: "",
      active_machines: 0,
      monthly_revenue: 0,
      monthly_transactions: 0,
      growth_rate: 0,
    });
    setEditingRegion(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRegion) {
      updateMutation.mutate({ id: editingRegion.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (region: Region) => {
    setEditingRegion(region);
    setFormData({
      name: region.name,
      country: region.country,
      active_machines: region.active_machines,
      monthly_revenue: region.monthly_revenue,
      monthly_transactions: region.monthly_transactions,
      growth_rate: region.growth_rate,
    });
    setOpen(true);
  };

  const totalMachines = regions?.reduce((sum, r) => sum + r.active_machines, 0) || 0;
  const totalRevenue = regions?.reduce((sum, r) => sum + r.monthly_revenue, 0) || 0;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Regional Reports</h2>
          <p className="text-muted-foreground">Monitor performance across all regions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Region
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRegion ? "Edit Region" : "Add New Region"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Region Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="active_machines">Active Machines</Label>
                  <Input
                    id="active_machines"
                    type="number"
                    value={formData.active_machines}
                    onChange={(e) => setFormData({ ...formData, active_machines: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="monthly_revenue">Monthly Revenue ($)</Label>
                  <Input
                    id="monthly_revenue"
                    type="number"
                    step="0.01"
                    value={formData.monthly_revenue}
                    onChange={(e) => setFormData({ ...formData, monthly_revenue: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="monthly_transactions">Monthly Transactions</Label>
                  <Input
                    id="monthly_transactions"
                    type="number"
                    value={formData.monthly_transactions}
                    onChange={(e) => setFormData({ ...formData, monthly_transactions: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="growth_rate">Growth Rate (%)</Label>
                  <Input
                    id="growth_rate"
                    type="number"
                    step="0.01"
                    value={formData.growth_rate}
                    onChange={(e) => setFormData({ ...formData, growth_rate: parseFloat(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">{editingRegion ? "Update" : "Add"} Region</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Regions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{regions?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Machines</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{totalMachines}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">${totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regional Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {regions?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No regions found. Add one to get started!</p>
            ) : (
              regions?.map((region) => (
                <div key={region.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-foreground">{region.name}</h3>
                        <span className="text-sm text-muted-foreground">{region.country}</span>
                        <span className={`text-sm flex items-center gap-1 ${
                          region.growth_rate >= 0 ? "text-green-500" : "text-red-500"
                        }`}>
                          <TrendingUp className="w-4 h-4" />
                          {region.growth_rate >= 0 ? "+" : ""}{region.growth_rate}%
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>{region.active_machines} machines</span>
                        <span>${region.monthly_revenue.toLocaleString()} revenue</span>
                        <span>{region.monthly_transactions.toLocaleString()} transactions</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(region)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(region.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <Progress value={(region.monthly_revenue / totalRevenue) * 100} className="h-2" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegionalReports;
