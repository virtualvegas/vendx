DROP POLICY IF EXISTS "Stands are viewable by everyone" ON public.stands;
CREATE POLICY "Public can view published stands" ON public.stands FOR SELECT
USING (
  status IN ('active','coming_soon','seasonal')
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role NOT IN ('customer'))
);

DROP POLICY IF EXISTS "Anyone can view quest rewards" ON public.quest_rewards;
CREATE POLICY "Public can view rewards of active quests" ON public.quest_rewards FOR SELECT
USING (EXISTS (SELECT 1 FROM public.quests q WHERE q.id = quest_rewards.quest_id AND q.status = 'active'));
REVOKE SELECT ON public.quest_rewards FROM anon, authenticated;
GRANT SELECT (id, quest_id, reward_type, reward_value, reward_item_id, is_guaranteed, drop_chance, rarity_multiplier, created_at) ON public.quest_rewards TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view leaderboards" ON public.quest_leaderboards;
CREATE POLICY "Public can view recent leaderboards" ON public.quest_leaderboards FOR SELECT
USING (period_start >= (current_date - 400) OR user_id = auth.uid());