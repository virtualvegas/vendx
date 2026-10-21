DROP POLICY IF EXISTS "Anyone can view builder styles" ON public.vendx_arcade_builder_styles;
CREATE POLICY "Anyone can view active builder styles" ON public.vendx_arcade_builder_styles FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Stand events are viewable by everyone" ON public.stand_events;
CREATE POLICY "Active stand events are viewable by everyone" ON public.stand_events FOR SELECT USING (status = 'active');