-- First, drop ALL existing policies on wallets table to start fresh
DROP POLICY IF EXISTS "Users can view own wallets" ON wallets;
DROP POLICY IF EXISTS "Users can insert own wallets" ON wallets;
DROP POLICY IF EXISTS "Users can update own wallets" ON wallets;
DROP POLICY IF EXISTS "Users can delete own child wallets" ON wallets;
DROP POLICY IF EXISTS "Users can view own and child wallets" ON wallets;
DROP POLICY IF EXISTS "Users can update own and child wallets" ON wallets;
DROP POLICY IF EXISTS "Users can delete own child wallets" ON wallets;
DROP POLICY IF EXISTS "wallets_select_policy" ON wallets;
DROP POLICY IF EXISTS "wallets_insert_policy" ON wallets;
DROP POLICY IF EXISTS "wallets_update_policy" ON wallets;
DROP POLICY IF EXISTS "wallets_delete_policy" ON wallets;

-- Also drop any other potential policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'wallets'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON wallets', pol.policyname);
  END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive RLS policies
-- Key insight: child wallets have the same user_id as parent, so we just check user_id directly

CREATE POLICY "wallet_select"
ON wallets FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "wallet_insert"
ON wallets FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "wallet_update"
ON wallets FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "wallet_delete"
ON wallets FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND wallet_type = 'child');