import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Eye, Share2, Tag, Clock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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
  is_featured: boolean;
  published_at: string | null;
  view_count: number;
  tags: string[];
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  category?: NewsCategory;
}

export default function NewsArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      fetchArticle();
    }
  }, [slug]);

  const fetchArticle = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('news_articles')
      .select('*, category:news_categories(*)')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (error || !data) {
      navigate('/news');
      return;
    }

    setArticle(data);
    
    // Increment view count
    await supabase
      .from('news_articles')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', data.id);

    // Fetch related articles
    const { data: related } = await supabase
      .from('news_articles')
      .select('*, category:news_categories(*)')
      .eq('is_published', true)
      .neq('id', data.id)
      .limit(3);

    if (related) {
      // Prioritize same category, then by tags
      const sorted = related.sort((a, b) => {
        if (a.category_id === data.category_id && b.category_id !== data.category_id) return -1;
        if (b.category_id === data.category_id && a.category_id !== data.category_id) return 1;
        return 0;
      });
      setRelatedArticles(sorted);
    }

    setLoading(false);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: article?.title,
        text: article?.excerpt || '',
        url: window.location.href,
      });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  };

  const estimateReadTime = (content: string) => {
    const words = content.split(/\s+/).length;
    return Math.ceil(words / 200);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-24 pb-12">
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

  if (!article) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Article Header */}
      <article className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          {/* Back Button */}
          <Link to="/news">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to News
            </Button>
          </Link>

          {/* Featured Image */}
          {article.featured_image && (
            <div className="aspect-[21/9] overflow-hidden rounded-xl mb-8">
              <img
                src={article.featured_image}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="max-w-3xl mx-auto">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {article.category && (
                <Badge style={{ backgroundColor: article.category.color }} className="text-white">
                  {article.category.name}
                </Badge>
              )}
              {article.is_featured && <Badge variant="secondary">Featured</Badge>}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              {article.title}
            </h1>

            {/* Excerpt */}
            {article.excerpt && (
              <p className="text-xl text-muted-foreground mb-6 italic">
                {article.excerpt}
              </p>
            )}

            {/* Article Meta */}
            <div className="flex flex-wrap items-center gap-6 pb-6 mb-8 border-b text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(article.published_at || article.created_at), 'MMMM d, yyyy')}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {article.view_count} views
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {estimateReadTime(article.content)} min read
              </span>
              <Button variant="ghost" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-1" /> Share
              </Button>
            </div>

            {/* Content */}
            <div className="prose prose-lg max-w-none dark:prose-invert whitespace-pre-wrap">
              {article.content}
            </div>

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="mt-8 pt-6 border-t">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  {article.tags.map((tag, i) => (
                    <Link key={i} to={`/news?tag=${tag}`}>
                      <Badge variant="outline" className="hover:bg-primary hover:text-primary-foreground">
                        {tag}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </article>

      {/* Related Articles */}
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
                        {format(new Date(related.published_at || related.created_at), 'MMM d, yyyy')}
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
