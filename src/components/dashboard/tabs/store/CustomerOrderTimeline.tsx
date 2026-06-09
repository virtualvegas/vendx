import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, Truck, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const icon = (type: string) => {
  if (type === "order_created") return <Package className="w-4 h-4" />;
  if (type === "tracking_added") return <Truck className="w-4 h-4" />;
  if (type === "fulfillment_changed") return <CheckCircle2 className="w-4 h-4" />;
  return <AlertCircle className="w-4 h-4" />;
};

export const CustomerOrderTimeline = ({ orderId }: { orderId: string }) => {
  const { data: events, isLoading } = useQuery({
    queryKey: ["customer-order-events", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_order_events")
        .select("id, event_type, status, note, created_at")
        .eq("order_id", orderId)
        .eq("customer_visible", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <Loader2 className="w-4 h-4 animate-spin mx-auto" />;
  if (!events?.length) return null;

  return (
    <div className="border-t border-border pt-3 mt-3">
      <p className="text-sm font-semibold mb-2">Order Updates</p>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {events.map((ev) => (
          <div key={ev.id} className="flex gap-2 text-xs">
            <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              {icon(ev.event_type)}
            </div>
            <div className="flex-1">
              <p className="text-foreground">{ev.note || ev.event_type.replace(/_/g, " ")}</p>
              <p className="text-muted-foreground">{format(new Date(ev.created_at), "MMM d, yyyy h:mm a")}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
