DROP POLICY IF EXISTS "Allow insert for beat purchases" ON public.beat_purchases;

DROP POLICY IF EXISTS "Anyone can view stand menu items" ON public.stand_menu_items;
CREATE POLICY "Anyone can view available stand menu items" ON public.stand_menu_items
  FOR SELECT USING (is_available = true OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view funnel products" ON public.store_funnel_products;
CREATE POLICY "Anyone can view products of active funnels" ON public.store_funnel_products
  FOR SELECT USING (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.store_funnel_steps s JOIN public.store_funnels f ON f.id = s.funnel_id
      WHERE s.id = store_funnel_products.funnel_step_id AND f.is_active = true)
  );