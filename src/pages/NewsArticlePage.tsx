import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Eye, Share2, Tag, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useSEO } from "@/hooks/useSEO";
import ArticleMarkdown from "@/components/news/ArticleMarkdown";
import ReadingProgress from "@/components/news/ReadingProgress";
import TableOfContents from "@/components/news/TableOfContents";
import ArticleLikeButton from "@/components/news/ArticleLikeButton";
import ArticleComments from "@/components/news/ArticleComments";
import NewsletterCategorySubscribe from "@/components/news/NewsletterCategorySubscribe";
import { extractHeadings, estimateReadMinutes } from "@/lib/newsHelpers";

interface NewsCategory {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  category_id: string | null;
  author_id: string | null;
  is_featured: boolean;
  is_published: boolean;
  status: string;
  published_at: string | null;
  view_count: number;
  tags: string[];
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  category?: NewsCategory;
}

export default function NewsArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPreview = searchParams.get("preview") === "1";
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<NewsArticle[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const articleRef = useRef<HTMLDivElement>(null);

  const ogImage =
    article?.featured_image ||
    "https://vendxglobal.net/__l5e/assets-v1/a07e477b-a87c-4f4a-8939-687226ba40b7/vendx-logo.png";

  useSEO({
    title: article?.meta_title || article?.title,
    description: article?.meta_description || article?.excerpt || article?.title,
    image: ogImage,
    type: "article",
  });

  useEffect(() => {
    if (!slug) return;
    let active = true;

    (async () => {
      setLoading(true);
      setNotFound(false);

      // Allow draft preview if ?preview=1 and viewer can moderate (RLS-gated)
      let query = supabase
        .from("news_articles")
        .select("*, category:news_categories(*)")
        .eq("slug", slug);
      if (!isPreview) query = query.eq("is_published", true);

      const { data, error } = await query.maybeSingle();
      if (!active) return;

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setArticle(data as NewsArticle);

      // Track view (idempotent log + counter bump for backwards-compat)
      if (data.is_published) {
        await Promise.all([
          supabase.from("news_article_views").insert({
            article_id: data.id,
            referrer: typeof document !== "undefined" ? document.referrer || null : null,
          }),
          supabase
            .from("news_articles")
            .update({ view_count: (data.view_count || 0) + 1 })
            .eq("id", data.id),
        ]).catch(() => {});
      }

      // Related: same category + tag overlap
      const { data: related } = await supabase
        .from("news_articles")
        .select("*, category:news_categories(*)")
        .eq("is_published", true)
        .neq("id", data.id)
        .order("published_at", { ascending: false })
        .limit(20);

      if (related && active) {
        const scored = (related as NewsArticle[])
          .map((r) => {
            let score = 0;
            if (r.category_id === data.category_id) score += 10;
            const tagOverlap = (r.tags ?? []).filter((t) => (data.tags ?? []).includes(t)).length;
            score += tagOverlap * 3;
            return { r, score };
          })
          .sort((a, b) => b.score - a.score || +new Date(b.r.published_at ?? 0) - +new Date(a.r.published_at ?? 0))
          .slice(0, 3)
          .map((x) => x.r);
        setRelatedArticles(scored);
      }

      // Categories for subscribe widget
      const { data: cats } = await supabase
        .from("news_categories")
        .select("id, name, slug, color")
        .eq("is_active", true)
        .order("display_order");
      if (active) setCategories((cats ?? []) as NewsCategory[]);

      // Author
      if (data.author_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", data.author_id)
          .maybeSingle();
        if (active) setAuthorName(profile?.full_name ?? null);
      }

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [slug, isPreview]);

  const headings = useMemo(() => (article ? extractHeadings(article.content) : []), [article]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: article?.title, text: article?.excerpt || "", url });
        return;
      } catch {
        /* fall through */
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-24 pb-12 max-w-3xl">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Footer />
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center px-4 pt-24 pb-12">
          <div className="text-center max-w-md space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground" />
            <h1 className="text-2xl font-bold">Article not found</h1>
            <p className="text-muted-foreground">
              It may have been moved or unpublished. Browse the rest of our news instead.
            </p>
            <Button onClick={() => navigate("/news")}>Back to news</Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const datePublished = article.published_at || article.created_at;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt || article.meta_description || "",
    image: ogImage,
    datePublished,
    dateModified: article.updated_at || datePublished,
    mainEntityOfPage: `https://vendxglobal.net/news/${article.slug}`,
    author: {
      "@type": authorName ? "Person" : "Organization",
      name: authorName || "VendX Global Corporation",
    },
    publisher: {
      "@type": "Organization",
      name: "VendX Global Corporation",
      logo: {
        "@type": "ImageObject",
        url: "https://vendxglobal.net/__l5e/assets-v1/a07e477b-a87c-4f4a-8939-687226ba40b7/vendx-logo.png",
      },
    },
    ...(article.tags && article.tags.length > 0 ? { keywords: article.tags.join(", ") } : {}),
  };

  return (
    <div className="min-h-screen bg-background">
      <ReadingProgress targetRef={articleRef} />
      <Navigation />

      {isPreview && !article.is_published && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 py-2 text-center text-xs text-amber-600 dark:text-amber-400">
          Draft preview — this article is not visible to the public.
        </div>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          <Link to="/news">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to News
            </Button>
          </Link>

          {article.featured_image && (
            <div className="aspect-[21/9] overflow-hidden rounded-xl mb-8 max-w-6xl mx-auto">
              <img
                src={article.featured_image}
                alt={article.title}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
          )}

          <div className="grid lg:grid-cols-[1fr_240px] gap-12 max-w-6xl mx-auto">
            <div ref={articleRef} className="min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {article.category && (
                  <Badge style={{ backgroundColor: article.category.color }} className="text-white">
                    {article.category.name}
                  </Badge>
                )}
                {article.is_featured && <Badge variant="secondary">Featured</Badge>}
              </div>

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">{article.title}</h1>

              {article.excerpt && (
                <p className="text-xl text-muted-foreground mb-6 leading-relaxed">{article.excerpt}</p>
              )}

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pb-6 mb-8 border-b text-sm text-muted-foreground">
                {authorName && <span className="font-medium text-foreground">{authorName}</span>}
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(datePublished), "MMM d, yyyy")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {estimateReadMinutes(article.content)} min read
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {article.view_count} views
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <ArticleLikeButton articleId={article.id} />
                  <Button variant="outline" size="sm" onClick={handleShare}>
                    <Share2 className="h-4 w-4 mr-1" /> Share
                  </Button>
                </div>
              </div>

              <ArticleMarkdown content={article.content} />

              {article.tags && article.tags.length > 0 && (
                <div className="mt-10 pt-6 border-t">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    {article.tags.map((tag, i) => (
                      <Link key={i} to={`/news?tag=${encodeURIComponent(tag)}`}>
                        <Badge variant="outline" className="hover:bg-primary hover:text-primary-foreground">
                          {tag}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-12 grid md:grid-cols-2 gap-4">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">Found this useful?</p>
                      <p className="text-sm text-muted-foreground">Let us know with a like.</p>
                    </div>
                    <ArticleLikeButton articleId={article.id} />
                  </CardContent>
                </Card>
                <Card className="bg-accent/5 border-accent/20">
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">Share with someone</p>
                      <p className="text-sm text-muted-foreground">Pass this story along.</p>
                    </div>
                    <Button variant="outline" onClick={handleShare}>
                      <Share2 className="h-4 w-4 mr-1" /> Share
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <ArticleComments articleId={article.id} />
            </div>

            <aside className="space-y-6">
              <TableOfContents headings={headings} />
              <NewsletterCategorySubscribe categories={categories} />
            </aside>
          </div>
        </div>
      </article>

      {relatedArticles.length > 0 && (
        <section className="py-12 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {relatedArticles.map((related) => (
                <Link key={related.id} to={`/news/${related.slug}`}>
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    {related.featured_image && (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={related.featured_image}
                          alt={related.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <CardContent className="p-4">
                      {related.category && (
                        <Badge style={{ backgroundColor: related.category.color }} className="text-white mb-2">
                          {related.category.name}
                        </Badge>
                      )}
                      <h3 className="font-bold mb-2 line-clamp-2 hover:text-primary transition-colors">
                        {related.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(related.published_at || related.created_at), "MMM d, yyyy")}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
