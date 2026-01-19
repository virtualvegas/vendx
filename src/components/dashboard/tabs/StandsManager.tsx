import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Store,
  MapPin,
  Sparkles,
  Search,
} from "lucide-react";
import { format } from "date-fns";

interface Stand {
  id: string;
  name: string;
  description: string | null;
  story: string | null;
  brand_future_focus: string | null;
  image_url: string | null;
  status: string;
  created_at: string;
}

interface StandEvent {
  id: string;
  stand_id: string;
  event_name: string;
  event_location: string;
  event_date: string;
  event_end_date: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  stands?: Stand;
}

const StandsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("stands");
  const [searchQuery, setSearchQuery] = useState("");

  // Stand dialog state
  const [standDialogOpen, setStandDialogOpen] = useState(false);
  const [editingStand, setEditingStand] = useState<Stand | null>(null);
  const [standForm, setStandForm] = useState({
    name: "",
    description: "",
    story: "",
    brand_future_focus: "",
    image_url: "",
    status: "active",
  });

  // Event dialog state
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<StandEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    stand_id: "",
    event_name: "",
    event_location: "",
    event_date: "",
    event_end_date: "",
    notes: "",
    status: "upcoming",
  });

  // Delete confirmation state
  const [deleteDialog, setDeleteDialog] = useState<{
    type: "stand" | "event";
    id: string;
    name: string;
  } | null>(null);

  // Fetch stands
  const { data: stands = [], isLoading: standsLoading } = useQuery({
    queryKey: ["stands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stands")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Stand[];
    },
  });

  // Fetch stand events
  const { data: standEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["stand_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stand_events")
        .select("*, stands(*)")
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data as StandEvent[];
    },
  });

  // Stand mutations
  const standMutation = useMutation({
    mutationFn: async (data: typeof standForm & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from("stands")
          .update(data)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stands").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stands"] });
      setStandDialogOpen(false);
      resetStandForm();
      toast({
        title: editingStand ? "Stand updated" : "Stand created",
        description: "Your changes have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteStandMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stands").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stands"] });
      queryClient.invalidateQueries({ queryKey: ["stand_events"] });
      setDeleteDialog(null);
      toast({ title: "Stand deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Event mutations
  const eventMutation = useMutation({
    mutationFn: async (data: typeof eventForm & { id?: string }) => {
      const payload = {
        ...data,
        event_end_date: data.event_end_date || null,
        notes: data.notes || null,
      };
      if (data.id) {
        const { error } = await supabase
          .from("stand_events")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stand_events").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stand_events"] });
      setEventDialogOpen(false);
      resetEventForm();
      toast({
        title: editingEvent ? "Event updated" : "Event scheduled",
        description: "Your changes have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("stand_events")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stand_events"] });
      setDeleteDialog(null);
      toast({ title: "Event removed" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetStandForm = () => {
    setStandForm({
      name: "",
      description: "",
      story: "",
      brand_future_focus: "",
      image_url: "",
      status: "active",
    });
    setEditingStand(null);
  };

  const resetEventForm = () => {
    setEventForm({
      stand_id: "",
      event_name: "",
      event_location: "",
      event_date: "",
      event_end_date: "",
      notes: "",
      status: "upcoming",
    });
    setEditingEvent(null);
  };

  const handleEditStand = (stand: Stand) => {
    setEditingStand(stand);
    setStandForm({
      name: stand.name,
      description: stand.description || "",
      story: stand.story || "",
      brand_future_focus: stand.brand_future_focus || "",
      image_url: stand.image_url || "",
      status: stand.status,
    });
    setStandDialogOpen(true);
  };

  const handleEditEvent = (event: StandEvent) => {
    setEditingEvent(event);
    setEventForm({
      stand_id: event.stand_id,
      event_name: event.event_name,
      event_location: event.event_location,
      event_date: event.event_date,
      event_end_date: event.event_end_date || "",
      notes: event.notes || "",
      status: event.status,
    });
    setEventDialogOpen(true);
  };

  const handleStandSubmit = () => {
    if (!standForm.name) {
      toast({
        title: "Validation Error",
        description: "Stand name is required",
        variant: "destructive",
      });
      return;
    }
    standMutation.mutate(
      editingStand ? { ...standForm, id: editingStand.id } : standForm
    );
  };

  const handleEventSubmit = () => {
    if (!eventForm.stand_id || !eventForm.event_name || !eventForm.event_date) {
      toast({
        title: "Validation Error",
        description: "Stand, event name, and date are required",
        variant: "destructive",
      });
      return;
    }
    eventMutation.mutate(
      editingEvent ? { ...eventForm, id: editingEvent.id } : eventForm
    );
  };

  const filteredStands = stands.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEvents = standEvents.filter(
    (e) =>
      e.event_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.event_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.stands?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "ongoing":
        return "bg-green-500/20 text-green-400";
      case "upcoming":
        return "bg-blue-500/20 text-blue-400";
      case "inactive":
      case "completed":
        return "bg-muted text-muted-foreground";
      case "retired":
      case "cancelled":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Amusement & Concession Stands</h1>
          <p className="text-muted-foreground">
            Manage your stands and their event schedules
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Stands
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stands.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Stands
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stands.filter((s) => s.status === "active").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {standEvents.filter((e) => e.status === "upcoming").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ongoing Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {standEvents.filter((e) => e.status === "ongoing").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <TabsList>
            <TabsTrigger value="stands" className="gap-2">
              <Store className="h-4 w-4" />
              Stands
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-2">
              <Calendar className="h-4 w-4" />
              Event Schedule
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {activeTab === "stands" ? (
              <Button
                onClick={() => {
                  resetStandForm();
                  setStandDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Stand
              </Button>
            ) : (
              <Button
                onClick={() => {
                  resetEventForm();
                  setEventDialogOpen(true);
                }}
                disabled={stands.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Schedule Event
              </Button>
            )}
          </div>
        </div>

        {/* Stands Tab */}
        <TabsContent value="stands" className="mt-4">
          {standsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading stands...
            </div>
          ) : filteredStands.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No stands yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first amusement or concession stand
                </p>
                <Button
                  onClick={() => {
                    resetStandForm();
                    setStandDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stand
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredStands.map((stand) => (
                <Card key={stand.id} className="overflow-hidden">
                  {stand.image_url && (
                    <div className="aspect-video relative">
                      <img
                        src={stand.image_url}
                        alt={stand.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{stand.name}</CardTitle>
                        <Badge className={getStatusColor(stand.status)}>
                          {stand.status}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditStand(stand)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDeleteDialog({
                              type: "stand",
                              id: stand.id,
                              name: stand.name,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {stand.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {stand.description}
                      </p>
                    )}
                    {stand.story && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Our Story
                        </p>
                        <p className="text-sm line-clamp-3">{stand.story}</p>
                      </div>
                    )}
                    {stand.brand_future_focus && (
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/5">
                        <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-primary mb-1">
                            Future Vision
                          </p>
                          <p className="text-sm line-clamp-2">
                            {stand.brand_future_focus}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground">
                        {
                          standEvents.filter((e) => e.stand_id === stand.id)
                            .length
                        }{" "}
                        scheduled events
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="mt-4">
          {eventsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading events...
            </div>
          ) : filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No events scheduled</h3>
                <p className="text-muted-foreground mb-4">
                  Schedule your stands at local events
                </p>
                <Button
                  onClick={() => {
                    resetEventForm();
                    setEventDialogOpen(true);
                  }}
                  disabled={stands.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Event
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stand</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">
                        {event.stands?.name || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{event.event_name}</p>
                          {event.notes && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {event.notes}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {event.event_location}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(event.event_date), "MMM d, yyyy")}
                          {event.event_end_date && (
                            <>
                              {" - "}
                              {format(
                                new Date(event.event_end_date),
                                "MMM d, yyyy"
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(event.status)}>
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditEvent(event)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDeleteDialog({
                              type: "event",
                              id: event.id,
                              name: event.event_name,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Stand Dialog */}
      <Dialog open={standDialogOpen} onOpenChange={setStandDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStand ? "Edit Stand" : "Add New Stand"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Stand Name *</Label>
                <Input
                  id="name"
                  value={standForm.name}
                  onChange={(e) =>
                    setStandForm({ ...standForm, name: e.target.value })
                  }
                  placeholder="e.g., Sweet Treats Cart"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={standForm.status}
                  onValueChange={(val) =>
                    setStandForm({ ...standForm, status: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="image_url">Image URL</Label>
              <Input
                id="image_url"
                value={standForm.image_url}
                onChange={(e) =>
                  setStandForm({ ...standForm, image_url: e.target.value })
                }
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={standForm.description}
                onChange={(e) =>
                  setStandForm({ ...standForm, description: e.target.value })
                }
                placeholder="What does this stand offer?"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="story">Our Story</Label>
              <Textarea
                id="story"
                value={standForm.story}
                onChange={(e) =>
                  setStandForm({ ...standForm, story: e.target.value })
                }
                placeholder="Share the story behind this stand..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand_future_focus">Future Vision</Label>
              <Textarea
                id="brand_future_focus"
                value={standForm.brand_future_focus}
                onChange={(e) =>
                  setStandForm({
                    ...standForm,
                    brand_future_focus: e.target.value,
                  })
                }
                placeholder="What's the vision for this brand's future?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStandDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStandSubmit}
              disabled={standMutation.isPending}
            >
              {standMutation.isPending
                ? "Saving..."
                : editingStand
                ? "Update"
                : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Dialog */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? "Edit Event" : "Schedule Event"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stand_id">Stand *</Label>
              <Select
                value={eventForm.stand_id}
                onValueChange={(val) =>
                  setEventForm({ ...eventForm, stand_id: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a stand" />
                </SelectTrigger>
                <SelectContent>
                  {stands.map((stand) => (
                    <SelectItem key={stand.id} value={stand.id}>
                      {stand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event_name">Event Name *</Label>
              <Input
                id="event_name"
                value={eventForm.event_name}
                onChange={(e) =>
                  setEventForm({ ...eventForm, event_name: e.target.value })
                }
                placeholder="e.g., County Fair 2025"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event_location">Location *</Label>
              <Input
                id="event_location"
                value={eventForm.event_location}
                onChange={(e) =>
                  setEventForm({ ...eventForm, event_location: e.target.value })
                }
                placeholder="e.g., Downtown Plaza, City Name"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event_date">Start Date *</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={eventForm.event_date}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, event_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event_end_date">End Date</Label>
                <Input
                  id="event_end_date"
                  type="date"
                  value={eventForm.event_end_date}
                  onChange={(e) =>
                    setEventForm({
                      ...eventForm,
                      event_end_date: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event_status">Status</Label>
              <Select
                value={eventForm.status}
                onValueChange={(val) =>
                  setEventForm({ ...eventForm, status: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={eventForm.notes}
                onChange={(e) =>
                  setEventForm({ ...eventForm, notes: e.target.value })
                }
                placeholder="Any additional details..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEventSubmit}
              disabled={eventMutation.isPending}
            >
              {eventMutation.isPending
                ? "Saving..."
                : editingEvent
                ? "Update"
                : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteDialog}
        onOpenChange={() => setDeleteDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to delete "{deleteDialog?.name}"? This action
            cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteDialog?.type === "stand") {
                  deleteStandMutation.mutate(deleteDialog.id);
                } else if (deleteDialog?.type === "event") {
                  deleteEventMutation.mutate(deleteDialog.id);
                }
              }}
              disabled={
                deleteStandMutation.isPending || deleteEventMutation.isPending
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StandsManager;
