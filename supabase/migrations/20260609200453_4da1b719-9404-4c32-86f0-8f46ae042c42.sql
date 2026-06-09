
-- 1. Add columns to existing tables
ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

ALTER TABLE public.store_orders
  ADD COLUMN IF NOT EXISTS carrier text,
  ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'unfulfilled',
  ADD COLUMN IF NOT EXISTS customer_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_visible_note text;

-- 2. Inventory adjustments log
CREATE TABLE IF NOT EXISTS public.store_inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  new_stock integer NOT NULL,
  reason text,
  adjustment_type text NOT NULL DEFAULT 'manual',
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_inv_adj_product ON public.store_inventory_adjustments(product_id, created_at DESC);

GRANT SELECT, INSERT ON public.store_inventory_adjustments TO authenticated;
GRANT ALL ON public.store_inventory_adjustments TO service_role;
ALTER TABLE public.store_inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage inventory adjustments"
  ON public.store_inventory_adjustments
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'finance_accounting')
    OR public.has_role(auth.uid(),'global_operations_manager')
    OR public.has_role(auth.uid(),'regional_manager')
    OR public.has_role(auth.uid(),'support')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'finance_accounting')
    OR public.has_role(auth.uid(),'global_operations_manager')
    OR public.has_role(auth.uid(),'regional_manager')
    OR public.has_role(auth.uid(),'support')
  );

-- 3. Order events / timeline
CREATE TABLE IF NOT EXISTS public.store_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  status text,
  note text,
  customer_visible boolean NOT NULL DEFAULT false,
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_order_events_order ON public.store_order_events(order_id, created_at DESC);

GRANT SELECT, INSERT ON public.store_order_events TO authenticated;
GRANT ALL ON public.store_order_events TO service_role;
ALTER TABLE public.store_order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage all order events"
  ON public.store_order_events
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'finance_accounting')
    OR public.has_role(auth.uid(),'global_operations_manager')
    OR public.has_role(auth.uid(),'regional_manager')
    OR public.has_role(auth.uid(),'support')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'finance_accounting')
    OR public.has_role(auth.uid(),'global_operations_manager')
    OR public.has_role(auth.uid(),'regional_manager')
    OR public.has_role(auth.uid(),'support')
  );

CREATE POLICY "Customers read their own visible events"
  ON public.store_order_events
  FOR SELECT
  TO authenticated
  USING (
    customer_visible = true
    AND EXISTS (
      SELECT 1 FROM public.store_orders so
      WHERE so.id = store_order_events.order_id
        AND so.user_id = auth.uid()
    )
  );

-- 4. Trigger: auto event on store_orders status changes
CREATE OR REPLACE FUNCTION public.log_store_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.store_order_events (order_id, event_type, status, note, customer_visible)
    VALUES (NEW.id, 'order_created', NEW.status, 'Order placed', true);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.store_order_events (order_id, event_type, status, note, customer_visible)
    VALUES (NEW.id, 'status_changed', NEW.status,
            'Status changed from ' || COALESCE(OLD.status,'(none)') || ' to ' || COALESCE(NEW.status,'(none)'),
            true);
  END IF;

  IF NEW.tracking_number IS DISTINCT FROM OLD.tracking_number AND NEW.tracking_number IS NOT NULL THEN
    INSERT INTO public.store_order_events (order_id, event_type, status, note, customer_visible, metadata)
    VALUES (NEW.id, 'tracking_added', NEW.status,
            'Tracking number added: ' || NEW.tracking_number,
            true,
            jsonb_build_object('carrier', NEW.carrier, 'tracking_url', NEW.tracking_url));
  END IF;

  IF NEW.fulfillment_status IS DISTINCT FROM OLD.fulfillment_status THEN
    INSERT INTO public.store_order_events (order_id, event_type, status, note, customer_visible)
    VALUES (NEW.id, 'fulfillment_changed', NEW.fulfillment_status,
            'Fulfillment: ' || COALESCE(NEW.fulfillment_status,'(none)'),
            true);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_orders_status_event ON public.store_orders;
CREATE TRIGGER trg_store_orders_status_event
  AFTER INSERT OR UPDATE ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_store_order_status_change();

-- 5. Trigger: auto inventory adjustment log when stock changes manually
CREATE OR REPLACE FUNCTION public.log_store_product_stock_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stock IS DISTINCT FROM OLD.stock THEN
    INSERT INTO public.store_inventory_adjustments (product_id, delta, new_stock, reason, adjustment_type, actor_id)
    VALUES (NEW.id, COALESCE(NEW.stock,0) - COALESCE(OLD.stock,0), COALESCE(NEW.stock,0),
            'Stock updated', 'system', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_products_stock_log ON public.store_products;
CREATE TRIGGER trg_store_products_stock_log
  AFTER UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.log_store_product_stock_change();
