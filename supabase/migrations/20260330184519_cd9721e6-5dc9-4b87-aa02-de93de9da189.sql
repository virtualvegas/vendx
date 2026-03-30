
-- Fix: drop the incorrectly-policied tables and recreate with correct roles
DROP TABLE IF EXISTS public.ecovend_suggestion_votes CASCADE;
DROP TABLE IF EXISTS public.ecovend_suggestions CASCADE;

CREATE TABLE public.ecovend_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID REFERENCES public.vendx_machines(id) ON DELETE CASCADE,
  machine_code TEXT NOT NULL,
  user_id UUID,
  suggestion_text TEXT NOT NULL,
  category TEXT DEFAULT 'snack',
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ecovend_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert suggestions" ON public.ecovend_suggestions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read suggestions" ON public.ecovend_suggestions FOR SELECT USING (true);
CREATE POLICY "Super admins can update suggestions" ON public.ecovend_suggestions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can delete suggestions" ON public.ecovend_suggestions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.ecovend_suggestion_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID REFERENCES public.ecovend_suggestions(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(suggestion_id, session_id)
);

ALTER TABLE public.ecovend_suggestion_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can vote" ON public.ecovend_suggestion_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read votes" ON public.ecovend_suggestion_votes FOR SELECT USING (true);
