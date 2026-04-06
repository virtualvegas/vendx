
-- Add service tech fields to route_stops
ALTER TABLE public.route_stops 
  ADD COLUMN IF NOT EXISTS service_type text DEFAULT 'routine',
  ADD COLUMN IF NOT EXISTS tech_notes text,
  ADD COLUMN IF NOT EXISTS restocked_items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id);

-- Enable realtime for route_stops so business owners get live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.route_stops;
