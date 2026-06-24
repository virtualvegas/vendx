
CREATE OR REPLACE FUNCTION public.touch_news_article_comments()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

ALTER VIEW public.news_article_stats SET (security_invoker = on);
