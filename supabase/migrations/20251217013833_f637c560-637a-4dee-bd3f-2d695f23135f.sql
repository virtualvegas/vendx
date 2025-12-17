-- Update RLS policies for service_routes to allow managers to view all routes
DROP POLICY IF EXISTS "Employees can view assigned routes" ON public.service_routes;

CREATE POLICY "Users can view routes based on role"
ON public.service_routes
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'global_operations_manager'::app_role) OR
  has_role(auth.uid(), 'regional_manager'::app_role) OR
  assigned_to = auth.uid()
);

-- Update RLS policies for route_stops to allow managers to view all stops
DROP POLICY IF EXISTS "Employees can view and update assigned route stops" ON public.route_stops;

CREATE POLICY "Users can view route stops based on role"
ON public.route_stops
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'global_operations_manager'::app_role) OR
  has_role(auth.uid(), 'regional_manager'::app_role) OR
  EXISTS (
    SELECT 1 FROM service_routes
    WHERE service_routes.id = route_stops.route_id
    AND service_routes.assigned_to = auth.uid()
  )
);

-- Allow managers to update any route stops
DROP POLICY IF EXISTS "Employees can update assigned route stops" ON public.route_stops;

CREATE POLICY "Users can update route stops based on role"
ON public.route_stops
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'global_operations_manager'::app_role) OR
  has_role(auth.uid(), 'regional_manager'::app_role) OR
  EXISTS (
    SELECT 1 FROM service_routes
    WHERE service_routes.id = route_stops.route_id
    AND service_routes.assigned_to = auth.uid()
  )
);

-- Allow operators to create restock logs
DROP POLICY IF EXISTS "Operators can create restock logs" ON public.restock_logs;

CREATE POLICY "Users can create restock logs"
ON public.restock_logs
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'global_operations_manager'::app_role) OR
  has_role(auth.uid(), 'regional_manager'::app_role) OR
  has_role(auth.uid(), 'warehouse_logistics'::app_role) OR
  has_role(auth.uid(), 'employee_operator'::app_role)
);

-- Allow managers to update service routes
CREATE POLICY "Managers can update service routes"
ON public.service_routes
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'global_operations_manager'::app_role) OR
  has_role(auth.uid(), 'regional_manager'::app_role)
);