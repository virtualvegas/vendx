
DROP POLICY IF EXISTS "Users can view own waitlist entry" ON public.arcade_waitlist;
CREATE POLICY "Staff view waitlist" ON public.arcade_waitlist
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'marketing_sales'));

DROP POLICY IF EXISTS "Public can read artist payouts" ON public.artist_payouts;
CREATE POLICY "Staff view artist payouts" ON public.artist_payouts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_accounting'));

DROP POLICY IF EXISTS "Public can read payout items" ON public.artist_payout_items;
CREATE POLICY "Staff view artist payout items" ON public.artist_payout_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_accounting'));

DROP POLICY IF EXISTS "Authenticated users can view inquiries" ON public.business_inquiries;
CREATE POLICY "Staff view business inquiries" ON public.business_inquiries
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'marketing_sales'));
