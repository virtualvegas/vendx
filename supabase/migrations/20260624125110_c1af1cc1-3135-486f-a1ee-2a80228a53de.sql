
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published')),
  ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS notify_on_publish BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ NULL;

UPDATE public.news_articles SET status = 'published' WHERE is_published = true AND status = 'draft';

CREATE OR REPLACE FUNCTION public.sync_news_article_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'published' THEN
    NEW.is_published := true;
    IF NEW.published_at IS NULL THEN NEW.published_at := now(); END IF;
  ELSE
    NEW.is_published := false;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_news_article_status ON public.news_articles;
CREATE TRIGGER trg_sync_news_article_status
BEFORE INSERT OR UPDATE ON public.news_articles
FOR EACH ROW EXECUTE FUNCTION public.sync_news_article_status();

-- Helper: can current user moderate news
CREATE OR REPLACE FUNCTION public.can_moderate_news(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('super_admin','global_operations_manager','marketing_sales')
  );
$$;

-- Likes
CREATE TABLE IF NOT EXISTS public.news_article_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anon_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS news_article_likes_user_uk
  ON public.news_article_likes(article_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS news_article_likes_anon_uk
  ON public.news_article_likes(article_id, anon_hash) WHERE anon_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS news_article_likes_article_idx ON public.news_article_likes(article_id);

GRANT SELECT, INSERT, DELETE ON public.news_article_likes TO authenticated, anon;
GRANT ALL ON public.news_article_likes TO service_role;
ALTER TABLE public.news_article_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read likes" ON public.news_article_likes FOR SELECT USING (true);
CREATE POLICY "Insert likes" ON public.news_article_likes FOR INSERT WITH CHECK (
  (user_id IS NULL AND anon_hash IS NOT NULL)
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
);
CREATE POLICY "Remove likes" ON public.news_article_likes FOR DELETE USING (
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR (user_id IS NULL AND anon_hash IS NOT NULL)
);

-- Comments
CREATE TABLE IF NOT EXISTS public.news_article_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  parent_id UUID NULL REFERENCES public.news_article_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_article_comments_article_idx ON public.news_article_comments(article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS news_article_comments_parent_idx ON public.news_article_comments(parent_id);
CREATE INDEX IF NOT EXISTS news_article_comments_user_idx ON public.news_article_comments(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_article_comments TO authenticated;
GRANT SELECT ON public.news_article_comments TO anon;
GRANT ALL ON public.news_article_comments TO service_role;
ALTER TABLE public.news_article_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads comments" ON public.news_article_comments FOR SELECT USING (true);
CREATE POLICY "Auth users comment" ON public.news_article_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
CREATE POLICY "Edit own or moderate" ON public.news_article_comments FOR UPDATE
  USING (auth.uid() = user_id OR public.can_moderate_news(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.can_moderate_news(auth.uid()));
CREATE POLICY "Delete own or moderate" ON public.news_article_comments FOR DELETE
  USING (auth.uid() = user_id OR public.can_moderate_news(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_news_article_comments()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_touch_news_article_comments ON public.news_article_comments;
CREATE TRIGGER trg_touch_news_article_comments
BEFORE UPDATE ON public.news_article_comments
FOR EACH ROW EXECUTE FUNCTION public.touch_news_article_comments();

-- Views log
CREATE TABLE IF NOT EXISTS public.news_article_views (
  id BIGSERIAL PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  referrer TEXT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_article_views_article_idx ON public.news_article_views(article_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS news_article_views_viewed_at_idx ON public.news_article_views(viewed_at DESC);

GRANT INSERT ON public.news_article_views TO anon, authenticated;
GRANT SELECT ON public.news_article_views TO authenticated;
GRANT ALL ON public.news_article_views TO service_role;
GRANT USAGE ON SEQUENCE public.news_article_views_id_seq TO anon, authenticated;
ALTER TABLE public.news_article_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Record view" ON public.news_article_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Moderators read views" ON public.news_article_views FOR SELECT
  USING (public.can_moderate_news(auth.uid()));

-- Category subscriptions
CREATE TABLE IF NOT EXISTS public.news_category_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES public.vendx_email_subscribers(id) ON DELETE CASCADE,
  category_id UUID NULL REFERENCES public.news_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS news_category_subscriptions_uk
  ON public.news_category_subscriptions(subscriber_id, COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS news_category_subscriptions_cat_idx ON public.news_category_subscriptions(category_id);

GRANT SELECT, INSERT, DELETE ON public.news_category_subscriptions TO anon, authenticated;
GRANT ALL ON public.news_category_subscriptions TO service_role;
ALTER TABLE public.news_category_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read subs" ON public.news_category_subscriptions FOR SELECT USING (true);
CREATE POLICY "Insert subs" ON public.news_category_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Delete subs" ON public.news_category_subscriptions FOR DELETE USING (true);

-- Stats view
CREATE OR REPLACE VIEW public.news_article_stats AS
SELECT
  a.id AS article_id,
  COALESCE((SELECT count(*) FROM public.news_article_likes l WHERE l.article_id = a.id), 0) AS like_count,
  COALESCE((SELECT count(*) FROM public.news_article_comments c WHERE c.article_id = a.id AND NOT c.is_deleted), 0) AS comment_count,
  COALESCE((SELECT count(*) FROM public.news_article_views v WHERE v.article_id = a.id AND v.viewed_at >= now() - interval '30 days'), 0) AS views_30d
FROM public.news_articles a;
GRANT SELECT ON public.news_article_stats TO anon, authenticated, service_role;
