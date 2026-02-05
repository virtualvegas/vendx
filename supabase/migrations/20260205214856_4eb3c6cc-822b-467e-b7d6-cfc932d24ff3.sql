-- Drop the recursive policies
DROP POLICY IF EXISTS "Users can view own and child wallets" ON wallets;
DROP POLICY IF EXISTS "Users can update own and child wallets" ON wallets;
DROP POLICY IF EXISTS "Users can delete own child wallets" ON wallets;
DROP POLICY IF EXISTS "Users can insert own wallets" ON wallets;

-- Create non-recursive policies using a different approach
-- For child wallets, we check if the user_id matches (since child wallets have same user_id as parent)

-- SELECT: Users can see wallets they own (parent and child share same user_id)
CREATE POLICY "Users can view own wallets"
ON wallets FOR SELECT
USING (auth.uid() = user_id);

-- INSERT: Users can create their own wallets
CREATE POLICY "Users can insert own wallets"
ON wallets FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own wallets
CREATE POLICY "Users can update own wallets"
ON wallets FOR UPDATE
USING (auth.uid() = user_id);

-- DELETE: Users can delete their own child wallets only
CREATE POLICY "Users can delete own child wallets"
ON wallets FOR DELETE
USING (auth.uid() = user_id AND wallet_type = 'child');