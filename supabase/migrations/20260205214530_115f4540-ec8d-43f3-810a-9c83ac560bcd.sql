-- Drop old restrictive policies
DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON wallets;
DROP POLICY IF EXISTS "System can insert wallets" ON wallets;

-- Create new policies that support wallet hierarchy

-- Allow users to view their own wallets AND child wallets they created
CREATE POLICY "Users can view own and child wallets"
ON wallets FOR SELECT
USING (
  auth.uid() = user_id
  OR parent_wallet_id IN (
    SELECT id FROM wallets WHERE user_id = auth.uid() AND wallet_type = 'standard'
  )
);

-- Allow users to insert their own standard wallets and child wallets
CREATE POLICY "Users can insert own wallets"
ON wallets FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

-- Allow users to update their own wallets AND child wallets they manage
CREATE POLICY "Users can update own and child wallets"
ON wallets FOR UPDATE
USING (
  auth.uid() = user_id
  OR parent_wallet_id IN (
    SELECT id FROM wallets WHERE user_id = auth.uid() AND wallet_type = 'standard'
  )
);

-- Allow users to delete child wallets they created
CREATE POLICY "Users can delete own child wallets"
ON wallets FOR DELETE
USING (
  (auth.uid() = user_id AND wallet_type = 'child')
  OR parent_wallet_id IN (
    SELECT id FROM wallets WHERE user_id = auth.uid() AND wallet_type = 'standard'
  )
);