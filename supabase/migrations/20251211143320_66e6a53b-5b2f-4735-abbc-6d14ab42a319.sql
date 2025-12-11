-- Create service_routes table for route management
CREATE TABLE public.service_routes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create route_stops table for individual stops on a route
CREATE TABLE public.route_stops (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id UUID NOT NULL REFERENCES public.service_routes(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    machine_id UUID REFERENCES public.vendx_machines(id) ON DELETE SET NULL,
    stop_order INTEGER NOT NULL DEFAULT 0,
    stop_name TEXT NOT NULL,
    address TEXT,
    notes TEXT,
    estimated_duration_minutes INTEGER DEFAULT 15,
    status TEXT NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_routes
CREATE POLICY "Admins can manage all routes" 
ON public.service_routes 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'global_operations_manager'::app_role));

CREATE POLICY "Employees can view assigned routes" 
ON public.service_routes 
FOR SELECT 
USING (assigned_to = auth.uid());

-- RLS Policies for route_stops
CREATE POLICY "Admins can manage all stops" 
ON public.route_stops 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'global_operations_manager'::app_role));

CREATE POLICY "Employees can view and update assigned route stops" 
ON public.route_stops 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.service_routes 
    WHERE service_routes.id = route_stops.route_id 
    AND service_routes.assigned_to = auth.uid()
));

CREATE POLICY "Employees can update assigned route stops" 
ON public.route_stops 
FOR UPDATE 
USING (EXISTS (
    SELECT 1 FROM public.service_routes 
    WHERE service_routes.id = route_stops.route_id 
    AND service_routes.assigned_to = auth.uid()
));

-- Update timestamp trigger
CREATE TRIGGER update_service_routes_updated_at
    BEFORE UPDATE ON public.service_routes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_route_stops_updated_at
    BEFORE UPDATE ON public.route_stops
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();