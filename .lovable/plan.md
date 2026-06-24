# News & Articles System Improvement Plan

A full upgrade across all four areas you picked. Implemented in one pass so everything ties together.

## 1. Reader Experience (`/news/:slug`)

- Render article body as **Markdown** (react-markdown + remark-gfm) with syntax highlighting, lists, tables, blockquotes, code blocks.
- **Sticky reading-progress bar** at the top of the article.
- **Table of Contents** auto-built from `##`/`###` headings, sticky on desktop, collapsible on mobile, with active-section highlight on scroll.
- **Like button** (heart) — anonymous like by hashed IP / signed-in user, persisted, optimistic UI.
- **Comments thread** — sign-in required, top-level + 1-level replies, author name/avatar from `profiles`, soft-delete by author or admin.
- Improved **related-articles** ranking (same category + shared-tag overlap score).

## 2. Engagement

- **Subscribe by category**: lightweight subscribe widget on `/news` sidebar and `/news/:slug` footer. Reuses `vendx_email_subscribers`; new `news_category_subscriptions` table links a subscriber to one or many categories ("All News" = no rows).
- **Auto-email on publish**: when an article flips to published (or its scheduled time passes), edge function `news-notify-subscribers` emails subscribers whose category matches (or who subscribed to all). Uses the existing email infra. Toggleable per article ("Notify subscribers on publish").
- **View analytics in admin**: views over time chart (last 30 days), top articles, average read time, like/comment counts on each row.

## 3. Discovery & SEO

- **JSON-LD `Article` schema** on `/news/:slug` (headline, image, datePublished, dateModified, author, publisher).
- **RSS 2.0 + Atom feeds** via edge function `news-rss` at `/feeds/news.xml`. Cached 5 min. Linked from `<head>` on `/news`.
- **Sitemap**: extend `scripts/generate-sitemap.ts` to pull every published article slug.
- **Open Graph image fallback**: if no `featured_image`, use a generated VendX brand OG image; per-article OG already wired via `useSEO`.

## 4. Admin Authoring (`NewsManager.tsx`)

- **Markdown editor** with split-pane live preview (same renderer as reader).
- **Cover image upload**: drag-and-drop / file picker into new public storage bucket `news-images`; auto-fill `featured_image` URL.
- **Inline image upload** inside body — uploads to `news-images` and inserts Markdown `![alt](url)` at cursor.
- **Drafts vs Published vs Scheduled**: status select (`draft` | `scheduled` | `published`). New `status` column; when `scheduled`, `scheduled_publish_at` controls auto-publish via cron edge function `news-publish-scheduled` (runs every 5 min).
- **Autosave drafts** every 8 s after edits (debounced) into the same row when status = draft.
- **"Open public preview"** button — opens `/news/:slug?preview=<draft-token>` which bypasses the published filter when token matches a server-issued short-lived JWT.
- **Notify-on-publish toggle**, **scheduled time picker**, **read-time estimate**, **word count** in editor footer.

## Database changes

New tables (all `vendx_`-prefixed per project convention is not used by `news_*` tables today — keeping existing `news_*` naming to match):

- `news_article_likes(article_id, user_id NULL, anon_hash, created_at)` — unique (article_id, coalesce(user_id, anon_hash)).
- `news_article_comments(id, article_id, parent_id NULL, user_id, body, is_deleted, created_at, updated_at)`.
- `news_article_views(id, article_id, viewed_at, user_id NULL, referrer)` — append-only, used for the chart; existing `view_count` stays as denormalized counter.
- `news_category_subscriptions(id, subscriber_id → vendx_email_subscribers.id, category_id NULL, created_at)`.

Columns added to `news_articles`:

- `status TEXT DEFAULT 'draft'` (`draft`|`scheduled`|`published`) — kept in sync with `is_published` via trigger for back-compat.
- `scheduled_publish_at TIMESTAMPTZ NULL`.
- `notify_on_publish BOOLEAN DEFAULT true`.
- `last_notified_at TIMESTAMPTZ NULL` (prevents duplicate sends).
- `author_id UUID NULL` (for byline; pulled from `profiles` if set).
- `updated_at TIMESTAMPTZ` + trigger.

RLS + grants: public SELECT for published comments/likes counts via secure RPCs; authenticated insert for own like/comment; admins manage all via existing role check.

## Storage

- New **public** bucket `news-images`. RLS: anyone can read; admins/editors can write.

## Edge Functions

- `news-rss` (GET) → RSS XML.
- `news-publish-scheduled` (cron, every 5 min) → flips `status='scheduled'` rows whose time has passed to `published`, sets `published_at`, fires notifications.
- `news-notify-subscribers` (POST) → batches emails through existing email infra; called by publish trigger + scheduler.
- `news-issue-preview-token` (GET, admin only) → JWT-signed short-lived token for the preview link.

## File changes (new / edited)

New:
- `src/components/news/ArticleMarkdown.tsx`
- `src/components/news/ReadingProgress.tsx`
- `src/components/news/TableOfContents.tsx`
- `src/components/news/ArticleLikeButton.tsx`
- `src/components/news/ArticleComments.tsx`
- `src/components/news/NewsletterCategorySubscribe.tsx`
- `src/components/dashboard/news/MarkdownEditor.tsx`
- `src/components/dashboard/news/NewsAnalyticsPanel.tsx`
- `supabase/functions/news-rss/index.ts`
- `supabase/functions/news-publish-scheduled/index.ts`
- `supabase/functions/news-notify-subscribers/index.ts`
- `supabase/functions/news-issue-preview-token/index.ts`

Edited:
- `src/pages/NewsPage.tsx`, `src/pages/NewsArticlePage.tsx`
- `src/components/dashboard/tabs/NewsManager.tsx`
- `scripts/generate-sitemap.ts`
- `index.html` (RSS `<link rel="alternate">`)

## Out of scope

- Full WYSIWYG (TipTap/Lexical) — Markdown + preview hits the goal at a fraction of the bundle weight. Easy to upgrade later.
- Multi-author workflow, editorial approvals, revision history.
- Per-article paywall.

Approve to build, or tell me what to trim.