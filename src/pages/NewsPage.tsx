import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Eye, Search, Tag, ArrowRight } from "lucide-react";
import { format } from "date-fns";

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
  created_at: string;
  category?: NewsCategory;
}

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [articlesRes, categoriesRes] = await Promise.all([
      supabase
        .from('news_articles')
        .select('*, category:news_categories(*)')
        .eq('is_published', true)
        .order('published_at', { ascending: false }),
      supabase
        .from('news_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order'),
    ]);

    if (!articlesRes.error) setArticles(articlesRes.data || []);
    if (!categoriesRes.error) setCategories(categoriesRes.data || []);
    setLoading(false);
  };

  const filteredArticles = articles.filter((article) => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = !selectedCategory || article.category_id === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const featuredArticles = filteredArticles.filter(a => a.is_featured);
  const regularArticles = filteredArticles.filter(a => !a.is_featured);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-24 pb-12 bg-gradient-to-b from-primary/10 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">News & Updates</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Stay updated with the latest news, announcements, and insights from VendX Global
            </p>
            
            {/* Search */}
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles..."
                className="pl-12 h-12 text-lg"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1">
            {loading ? (
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-48 w-full mb-4" />
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <>
                {/* Featured Articles */}
                {featuredArticles.length > 0 && (
                  <div className="mb-12">
                    <h2 className="text-2xl font-bold mb-6">Featured</h2>
                    <div className="grid gap-6">
                      {featuredArticles.map((article) => (
                        <Link key={article.id} to={`/news/${article.slug}`}>
                          <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="flex flex-col md:flex-row">
                              {article.featured_image && (
                                <div className="md:w-1/3">
                                  <img
                                    src={article.featured_image}
                                    alt={article.title}
                                    className="w-full h-48 md:h-full object-cover"
                                  />
                                </div>
                              )}
                              <CardContent className={`p-6 ${article.featured_image ? 'md:w-2/3' : 'w-full'}`}>
                                <div className="flex items-center gap-2 mb-3">
                                  {article.category && (
                                    <Badge style={{ backgroundColor: article.category.color }} className="text-white">
                                      {article.category.name}
                                    </Badge>
                                  )}
                                  <Badge variant="secondary">Featured</Badge>
                                </div>
                                <h3 className="text-2xl font-bold mb-2 hover:text-primary transition-colors">
                                  {article.title}
                                </h3>
                                <p className="text-muted-foreground mb-4 line-clamp-2">
                                  {article.excerpt || article.content.substring(0, 150) + '...'}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {format(new Date(article.published_at || article.created_at), 'MMM d, yyyy')}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Eye className="h-4 w-4" />
                                    {article.view_count} views
                                  </span>
                                </div>
                              </CardContent>
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Regular Articles */}
                <div>
                  <h2 className="text-2xl font-bold mb-6">
                    {selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : 'All Articles'}
                  </h2>
                  
                  {regularArticles.length === 0 && featuredArticles.length === 0 ? (
                    <Card className="p-12 text-center">
                      <p className="text-muted-foreground">No articles found</p>
                      {(searchQuery || selectedCategory) && (
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
                        >
                          Clear filters
                        </Button>
                      )}
                    </Card>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                      {regularArticles.map((article) => (
                        <Link key={article.id} to={`/news/${article.slug}`}>
                          <Card className="h-full hover:shadow-lg transition-shadow">
                            {article.featured_image && (
                              <div className="aspect-video overflow-hidden">
                                <img
                                  src={article.featured_image}
                                  alt={article.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <CardContent className="p-5">
                              {article.category && (
                                <Badge style={{ backgroundColor: article.category.color }} className="text-white mb-3">
                                  {article.category.name}
                                </Badge>
                              )}
                              <h3 className="text-lg font-bold mb-2 hover:text-primary transition-colors line-clamp-2">
                                {article.title}
                              </h3>
                              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                {article.excerpt || article.content.substring(0, 100) + '...'}
                              </p>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(article.published_at || article.created_at), 'MMM d, yyyy')}
                                </span>
                                <span className="flex items-center gap-1 text-primary">
                                  Read more <ArrowRight className="h-3 w-3" />
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:w-80 space-y-6">
            {/* Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant={!selectedCategory ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(null)}
                >
                  All Categories
                  <Badge variant="secondary" className="ml-auto">{articles.length}</Badge>
                </Button>
                {categories.map((category) => {
                  const count = articles.filter(a => a.category_id === category.id).length;
                  return (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: category.color }} />
                      {category.name}
                      <Badge variant="secondary" className="ml-auto">{count}</Badge>
                    </Button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Popular Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Popular Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(articles.flatMap(a => a.tags || []))).slice(0, 15).map((tag, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                      onClick={() => setSearchQuery(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Articles */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Articles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {articles.slice(0, 5).map((article) => (
                  <Link key={article.id} to={`/news/${article.slug}`} className="block group">
                    <h4 className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(article.published_at || article.created_at), 'MMM d, yyyy')}
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  );
}
