DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.ecosnack_locker_purchases;
CREATE POLICY "Users can create their own locker purchases"
ON public.ecosnack_locker_purchases
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view inventory" ON public.prize_inventory;
CREATE POLICY "Authenticated users can view inventory"
ON public.prize_inventory
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.prize_inventory FROM anon;