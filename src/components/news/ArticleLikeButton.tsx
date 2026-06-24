import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAnonHash } from "@/lib/newsHelpers";
import { cn } from "@/lib/utils";

/**
 * Heart-button with optimistic count update. Signed-in users like by user_id;
 * anonymous visitors like by a locally persisted anon hash (still unique per article).
 */
const ArticleLikeButton = ({ articleId }: { articleId: string }) => {
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!active) return;
      const uid = auth.user?.id ?? null;
      setUserId(uid);
      const anon = getAnonHash();

      const [totalRes, mineRes] = await Promise.all([
        supabase
          .from("news_article_likes")
          .select("*", { count: "exact", head: true })
          .eq("article_id", articleId),
        uid
          ? supabase
              .from("news_article_likes")
              .select("id")
              .eq("article_id", articleId)
              .eq("user_id", uid)
              .maybeSingle()
          : supabase
              .from("news_article_likes")
              .select("id")
              .eq("article_id", articleId)
              .eq("anon_hash", anon)
              .maybeSingle(),
      ]);
      if (!active) return;
      setCount(totalRes.count ?? 0);
      setLiked(Boolean(mineRes.data));
    })();
    return () => {
      active = false;
    };
  }, [articleId]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const anon = getAnonHash();
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => c + (wasLiked ? -1 : 1));

    try {
      if (wasLiked) {
        const q = supabase.from("news_article_likes").delete().eq("article_id", articleId);
        await (userId ? q.eq("user_id", userId) : q.eq("anon_hash", anon));
      } else {
        await supabase.from("news_article_likes").insert({
          article_id: articleId,
          user_id: userId,
          anon_hash: userId ? null : anon,
        });
      }
    } catch {
      // rollback optimistic update
      setLiked(wasLiked);
      setCount((c) => c + (wasLiked ? 1 : -1));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={liked ? "default" : "outline"}
      size="sm"
      onClick={toggle}
      disabled={busy}
      className={cn("gap-2 transition-transform", liked && "scale-[1.02]")}
      aria-pressed={liked}
      aria-label={liked ? "Unlike article" : "Like article"}
    >
      <Heart className={cn("h-4 w-4", liked && "fill-current")} />
      <span className="font-medium tabular-nums">{count}</span>
    </Button>
  );
};

export default ArticleLikeButton;
