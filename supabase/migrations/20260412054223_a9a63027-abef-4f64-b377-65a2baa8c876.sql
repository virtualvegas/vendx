-- Fix arcade_play_sessions
DROP POLICY IF EXISTS "Service can manage play sessions" ON public.arcade_play_sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON public.arcade_play_sessions;
DROP POLICY IF EXISTS "Users can view own play sessions" ON public.arcade_play_sessions;
DROP POLICY IF EXISTS "Admins can view all play sessions" ON public.arcade_play_sessions;

CREATE POLICY "Users can view own play sessions"
ON public.arcade_play_sessions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all play sessions"
ON public.arcade_play_sessions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'global_operations_manager'::app_role));

-- Fix user_tickets
DROP POLICY IF EXISTS "Allow all access to user_tickets" ON public.user_tickets;
DROP POLICY IF EXISTS "Users can view own tickets" ON public.user_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.user_tickets;

CREATE POLICY "Users can view own tickets"
ON public.user_tickets FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all tickets"
ON public.user_tickets FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Fix ticket_transactions
DROP POLICY IF EXISTS "Allow insert ticket transactions" ON public.ticket_transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.ticket_transactions;
DROP POLICY IF EXISTS "Users can view own ticket transactions" ON public.ticket_transactions;
DROP POLICY IF EXISTS "Admins can view all ticket transactions" ON public.ticket_transactions;

CREATE POLICY "Users can view own ticket transactions"
ON public.ticket_transactions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all ticket transactions"
ON public.ticket_transactions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Fix ecosnack_locker_purchases
DROP POLICY IF EXISTS "Anyone can update locker purchases" ON public.ecosnack_locker_purchases;
DROP POLICY IF EXISTS "Users can update own locker purchases" ON public.ecosnack_locker_purchases;

CREATE POLICY "Users can update own locker purchases"
ON public.ecosnack_locker_purchases FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Fix arcade_pricing_templates
DROP POLICY IF EXISTS "Anyone can manage arcade pricing templates" ON public.arcade_pricing_templates;
DROP POLICY IF EXISTS "Public can view pricing templates" ON public.arcade_pricing_templates;
DROP POLICY IF EXISTS "Anyone can view pricing templates" ON public.arcade_pricing_templates;
DROP POLICY IF EXISTS "Admins can manage pricing templates" ON public.arcade_pricing_templates;

CREATE POLICY "Anyone can view pricing templates"
ON public.arcade_pricing_templates FOR SELECT
USING (true);

CREATE POLICY "Admins can manage pricing templates"
ON public.arcade_pricing_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Fix machine_activity_log
DROP POLICY IF EXISTS "Allow insert machine activity" ON public.machine_activity_log;
DROP POLICY IF EXISTS "Authenticated users can view machine activity" ON public.machine_activity_log;

CREATE POLICY "Authenticated users can view machine activity"
ON public.machine_activity_log FOR SELECT TO authenticated
USING (true);

-- Fix vendx_machines: Remove public policy exposing api_key
DROP POLICY IF EXISTS "Public can view ecosnack machines by code" ON public.vendx_machines;
DROP POLICY IF EXISTS "Public machines read via RPC only" ON public.vendx_machines;
DROP POLICY IF EXISTS "Authenticated staff can view machines" ON public.vendx_machines;

CREATE OR REPLACE FUNCTION public.get_public_machine_info(p_machine_code text)
RETURNS TABLE (
  id uuid, machine_code text, name text, machine_type text, status text, location_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT vm.id, vm.machine_code, vm.name, vm.machine_type, vm.status, vm.location_id
  FROM public.vendx_machines vm
  WHERE vm.machine_code = p_machine_code AND vm.status = 'active';
$$;

CREATE POLICY "Authenticated staff can view machines"
ON public.vendx_machines FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role) OR 
  public.has_role(auth.uid(), 'tech_support_lead'::app_role) OR 
  public.has_role(auth.uid(), 'employee_operator'::app_role) OR
  public.has_role(auth.uid(), 'global_operations_manager'::app_role) OR
  public.has_role(auth.uid(), 'regional_manager'::app_role) OR
  public.has_role(auth.uid(), 'warehouse_logistics'::app_role)
);