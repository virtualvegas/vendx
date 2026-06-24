import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Trash2, Reply, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ProfileLite {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface CommentRow {
  id: string;
  article_id: string;
  parent_id: string | null;
  user_id: string;
  body: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

interface CommentWithAuthor extends CommentRow {
  author: ProfileLite | null;
  replies: CommentWithAuthor[];
}

/**
 * Threaded comments: one level of replies, soft-delete by author or moderator.
 */
const ArticleComments = ({ articleId }: { articleId: string }) => {
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from("news_article_comments")
      .select("*")
      .eq("article_id", articleId)
      .order("created_at", { ascending: true });

    const list = (rows ?? []) as CommentRow[];
    const userIds = Array.from(new Set(list.map((r) => r.user_id)));
    let profiles: ProfileLite[] = [];
    if (userIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);
      profiles = (data ?? []) as ProfileLite[];
    }
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const withAuthor: CommentWithAuthor[] = list.map((r) => ({
      ...r,
      author: profileById.get(r.user_id) ?? null,
      replies: [],
    }));
    const byId = new Map(withAuthor.map((c) => [c.id, c]));
    const tree: CommentWithAuthor[] = [];
    withAuthor.forEach((c) => {
      if (c.parent_id && byId.has(c.parent_id)) {
        byId.get(c.parent_id)!.replies.push(c);
      } else {
        tree.push(c);
      }
    });
    setComments(tree);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  const submit = async (text: string, parentId: string | null) => {
    if (!userId) {
      toast.error("Sign in to comment");
      return;
    }
    if (!text.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("news_article_comments").insert({
      article_id: articleId,
      parent_id: parentId,
      user_id: userId,
      body: text.trim(),
    });
    setPosting(false);
    if (error) {
      toast.error("Could not post comment");
      return;
    }
    if (parentId) {
      setReplyBody("");
      setReplyTo(null);
    } else {
      setBody("");
    }
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this comment?")) return;
    const { error } = await supabase
      .from("news_article_comments")
      .update({ is_deleted: true, body: "[deleted]" })
      .eq("id", id);
    if (error) {
      toast.error("Could not delete");
      return;
    }
    load();
  };

  const total = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  return (
    <section className="mt-12 pt-8 border-t" id="comments">
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Comments</h2>
        <Badge variant="secondary">{total}</Badge>
      </div>

      {userId ? (
        <div className="mb-8 space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts…"
            rows={3}
            maxLength={4000}
          />
          <div className="flex justify-end">
            <Button onClick={() => submit(body, null)} disabled={!body.trim() || posting}>
              {posting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Post comment
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-8 rounded-lg border border-dashed p-4 text-sm text-muted-foreground flex items-center justify-between">
          <span>Sign in to join the conversation.</span>
          <Link to="/auth">
            <Button size="sm" variant="outline">
              Sign in
            </Button>
          </Link>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Be the first to comment.</p>
      ) : (
        <ul className="space-y-6">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              userId={userId}
              onReply={(id) => {
                setReplyTo(id === replyTo ? null : id);
                setReplyBody("");
              }}
              activeReplyId={replyTo}
              replyBody={replyBody}
              setReplyBody={setReplyBody}
              onSubmitReply={(parentId) => submit(replyBody, parentId)}
              onDelete={remove}
              posting={posting}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

const CommentItem = ({
  comment,
  userId,
  onReply,
  activeReplyId,
  replyBody,
  setReplyBody,
  onSubmitReply,
  onDelete,
  posting,
  isReply = false,
}: {
  comment: CommentWithAuthor;
  userId: string | null;
  onReply: (id: string) => void;
  activeReplyId: string | null;
  replyBody: string;
  setReplyBody: (v: string) => void;
  onSubmitReply: (parentId: string) => void;
  onDelete: (id: string) => void;
  posting: boolean;
  isReply?: boolean;
}) => {
  const initials = (comment.author?.full_name ?? "User")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const canDelete = userId === comment.user_id && !comment.is_deleted;

  return (
    <li className={cn("flex gap-3", isReply && "ml-10")}>
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarImage src={comment.author?.avatar_url ?? undefined} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{comment.author?.full_name ?? "Anonymous"}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className={cn("mt-1 text-sm whitespace-pre-wrap", comment.is_deleted && "italic text-muted-foreground")}>
          {comment.body}
        </p>
        {!comment.is_deleted && (
          <div className="flex items-center gap-2 mt-2">
            {!isReply && userId && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onReply(comment.id)}>
                <Reply className="h-3 w-3 mr-1" /> Reply
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => onDelete(comment.id)}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            )}
          </div>
        )}

        {activeReplyId === comment.id && (
          <div className="mt-3 space-y-2">
            <Textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder={`Reply to ${comment.author?.full_name ?? "this comment"}…`}
              rows={2}
              maxLength={4000}
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => onReply(comment.id)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => onSubmitReply(comment.id)} disabled={!replyBody.trim() || posting}>
                Reply
              </Button>
            </div>
          </div>
        )}

        {comment.replies.length > 0 && (
          <ul className="mt-4 space-y-4">
            {comment.replies.map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                userId={userId}
                onReply={onReply}
                activeReplyId={activeReplyId}
                replyBody={replyBody}
                setReplyBody={setReplyBody}
                onSubmitReply={onSubmitReply}
                onDelete={onDelete}
                posting={posting}
                isReply
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
};

export default ArticleComments;
