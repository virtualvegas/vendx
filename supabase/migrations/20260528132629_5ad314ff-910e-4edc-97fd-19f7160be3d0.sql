-- Allow super_admin and finance_accounting to view/manage all wallets
CREATE POLICY "Admins can view all wallets"
ON public.wallets FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_accounting'));

CREATE POLICY "Admins can update all wallets"
ON public.wallets FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_accounting'));

-- Also allow admins to see all wallet transactions for the admin view
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='wallet_transactions'
      AND policyname='Admins can view all wallet transactions'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admins can view all wallet transactions"
      ON public.wallet_transactions FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_accounting'))
    $p$;
  END IF;
END$$;

-- Allow admins to read profiles for join in admin views
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles'
      AND policyname='Admins can view all profiles'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admins can view all profiles"
      ON public.profiles FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance_accounting'))
    $p$;
  END IF;
END$$;