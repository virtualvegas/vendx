import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Users, Package, Loader2, RefreshCw, Mail, 
  CheckCircle, Clock, XCircle, Search, Trash2
} from "lucide-react";
import { format } from "date-fns";

interface WaitlistEntry {
  id: string;
  product_id: string | null;
  email: string;
  full_name: string | null;
  phone: string | null;
  status: string | null;
  created_at: string;
  notified_at: string | null;
  converted_at: string | null;
  product?: {
    name: string;
    slug: string;
  } | null;
}

interface ProductWithWaitlist {
  id: string;
  name: string;
  slug: string;
  waitlist_enabled: boolean | null;
  waitlist_count: number;
}

const WaitlistManager = () => {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [products, setProducts] = useState<ProductWithWaitlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchWaitlistEntries(), fetchProductsWithWaitlist()]);
    setLoading(false);
  };

  const fetchWaitlistEntries = async () => {
    const { data, error } = await supabase
      .from("product_waitlist")
      .select(`
        *,
        product:store_products(name, slug)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching waitlist:", error);
      toast.error("Failed to load waitlist entries");
    } else {
      setEntries(data || []);
    }
  };

  const fetchProductsWithWaitlist = async () => {
    // Fetch products with waitlist enabled
    const { data: productsData, error: productsError } = await supabase
      .from("store_products")
      .select("id, name, slug, waitlist_enabled")
      .eq("waitlist_enabled", true)
      .order("name");

    if (productsError) {
      console.error("Error fetching products:", productsError);
      return;
    }

    // Count waitlist entries for each product
    const productsWithCounts: ProductWithWaitlist[] = await Promise.all(
      (productsData || []).map(async (product) => {
        const { count } = await supabase
          .from("product_waitlist")
          .select("*", { count: "exact", head: true })
          .eq("product_id", product.id);

        return {
          ...product,
          waitlist_count: count || 0,
        };
      })
    );

    setProducts(productsWithCounts);
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    
    if (status === "notified") {
      updates.notified_at = new Date().toISOString();
    } else if (status === "converted") {
      updates.converted_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("product_waitlist")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast.error("Failed to update status");
      return;
    }

    toast.success("Status updated successfully");
    fetchWaitlistEntries();
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Are you sure you want to remove this waitlist entry?")) return;

    const { error } = await supabase
      .from("product_waitlist")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete entry");
      return;
    }

    toast.success("Entry removed");
    fetchData();
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "notified":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Mail className="w-3 h-3 mr-1" /> Notified</Badge>;
      case "converted":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Converted</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const matchesProduct = selectedProduct === "all" || entry.product_id === selectedProduct;
    const matchesStatus = selectedStatus === "all" || entry.status === selectedStatus;
    const matchesSearch = 
      searchQuery === "" ||
      entry.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.product?.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesProduct && matchesStatus && matchesSearch;
  });

  const stats = {
    total: entries.length,
    pending: entries.filter((e) => e.status === "pending" || !e.status).length,
    notified: entries.filter((e) => e.status === "notified").length,
    converted: entries.filter((e) => e.status === "converted").length,
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
          <h2 className="text-2xl font-bold">Product Waitlist</h2>
          <p className="text-muted-foreground">Manage waitlist signups for products</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Signups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Notified</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.notified}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Converted</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.converted}</div>
          </CardContent>
        </Card>
      </div>

      {/* Products with Waitlist */}
      {products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Products with Waitlist Enabled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="p-3 border border-border rounded-lg flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">/{product.slug}</p>
                  </div>
                  <Badge variant="secondary">
                    {product.waitlist_count} signup{product.waitlist_count !== 1 ? "s" : ""}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name, or product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="notified">Notified</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Waitlist Entries Table */}
      <Card>
        <CardContent className="pt-6">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No waitlist entries found</p>
              <p className="text-sm mt-1">
                Enable waitlist on products in the Products Manager to start collecting signups
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{entry.full_name || "—"}</p>
                        <p className="text-sm text-muted-foreground">{entry.email}</p>
                        {entry.phone && (
                          <p className="text-xs text-muted-foreground">{entry.phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.product ? (
                        <div>
                          <p className="font-medium">{entry.product.name}</p>
                          <p className="text-xs text-muted-foreground">/{entry.product.slug}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell>
                      <div>
                        <p>{format(new Date(entry.created_at), "MMM d, yyyy")}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(entry.created_at), "h:mm a")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Select
                          value={entry.status || "pending"}
                          onValueChange={(v) => updateStatus(entry.id, v)}
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="notified">Notified</SelectItem>
                            <SelectItem value="converted">Converted</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteEntry(entry.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WaitlistManager;
