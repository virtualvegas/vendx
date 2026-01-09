import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Eye, FileText, FolderOpen, Calendar, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface NewsCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
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
  is_published: boolean;
  is_featured: boolean;
  published_at: string | null;
  view_count: number;
  tags: string[];
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  category?: NewsCategory;
}

export default function NewsManager() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [articleDialogOpen, setArticleDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  
  // Form states
  const [articleForm, setArticleForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    featured_image: '',
    category_id: '',
    is_published: false,
    is_featured: false,
    tags: '',
    meta_title: '',
    meta_description: '',
  });
  
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    slug: '',
    description: '',
    color: '#3b82f6',
    is_active: true,
  });
  
  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);
  const [editingCategory, setEditingCategory] = useState<NewsCategory | null>(null);
  const [previewArticle, setPreviewArticle] = useState<NewsArticle | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [articlesRes, categoriesRes] = await Promise.all([
      supabase.from('news_articles').select('*, category:news_categories(*)').order('created_at', { ascending: false }),
      supabase.from('news_categories').select('*').order('display_order'),
    ]);
    
    if (!articlesRes.error) setArticles(articlesRes.data || []);
    if (!categoriesRes.error) setCategories(categoriesRes.data || []);
    setLoading(false);
  };

  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const handleSaveArticle = async () => {
    const slug = articleForm.slug || generateSlug(articleForm.title);
    const tagsArray = articleForm.tags.split(',').map(t => t.trim()).filter(Boolean);
    
    const articleData = {
      title: articleForm.title,
      slug,
      excerpt: articleForm.excerpt || null,
      content: articleForm.content,
      featured_image: articleForm.featured_image || null,
      category_id: articleForm.category_id || null,
      is_published: articleForm.is_published,
      is_featured: articleForm.is_featured,
      published_at: articleForm.is_published ? new Date().toISOString() : null,
      tags: tagsArray,
      meta_title: articleForm.meta_title || null,
      meta_description: articleForm.meta_description || null,
    };
    
    if (editingArticle) {
      const { error } = await supabase
        .from('news_articles')
        .update(articleData)
        .eq('id', editingArticle.id);
      
      if (error) {
        toast.error('Failed to update article');
      } else {
        toast.success('Article updated');
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from('news_articles')
        .insert([articleData]);
      
      if (error) {
        toast.error('Failed to create article');
      } else {
        toast.success('Article created');
        fetchData();
      }
    }
    
    setArticleDialogOpen(false);
    resetArticleForm();
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Delete this article?')) return;
    
    const { error } = await supabase
      .from('news_articles')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to delete article');
    } else {
      toast.success('Article deleted');
      fetchData();
    }
  };

  const handleSaveCategory = async () => {
    const slug = categoryForm.slug || generateSlug(categoryForm.name);
    
    if (editingCategory) {
      const { error } = await supabase
        .from('news_categories')
        .update({ ...categoryForm, slug })
        .eq('id', editingCategory.id);
      
      if (error) {
        toast.error('Failed to update category');
      } else {
        toast.success('Category updated');
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from('news_categories')
        .insert([{ ...categoryForm, slug, display_order: categories.length }]);
      
      if (error) {
        toast.error('Failed to create category');
      } else {
        toast.success('Category created');
        fetchData();
      }
    }
    
    setCategoryDialogOpen(false);
    resetCategoryForm();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    
    const { error } = await supabase
      .from('news_categories')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to delete category');
    } else {
      toast.success('Category deleted');
      fetchData();
    }
  };

  const togglePublish = async (article: NewsArticle) => {
    const { error } = await supabase
      .from('news_articles')
      .update({ 
        is_published: !article.is_published,
        published_at: !article.is_published ? new Date().toISOString() : null
      })
      .eq('id', article.id);
    
    if (!error) {
      toast.success(article.is_published ? 'Article unpublished' : 'Article published');
      fetchData();
    }
  };

  const toggleFeatured = async (article: NewsArticle) => {
    const { error } = await supabase
      .from('news_articles')
      .update({ is_featured: !article.is_featured })
      .eq('id', article.id);
    
    if (!error) {
      toast.success(article.is_featured ? 'Removed from featured' : 'Added to featured');
      fetchData();
    }
  };

  const resetArticleForm = () => {
    setArticleForm({
      title: '', slug: '', excerpt: '', content: '', featured_image: '',
      category_id: '', is_published: false, is_featured: false, tags: '',
      meta_title: '', meta_description: '',
    });
    setEditingArticle(null);
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', slug: '', description: '', color: '#3b82f6', is_active: true });
    setEditingCategory(null);
  };

  const openEditArticle = (article: NewsArticle) => {
    setEditingArticle(article);
    setArticleForm({
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt || '',
      content: article.content,
      featured_image: article.featured_image || '',
      category_id: article.category_id || '',
      is_published: article.is_published,
      is_featured: article.is_featured,
      tags: article.tags?.join(', ') || '',
      meta_title: article.meta_title || '',
      meta_description: article.meta_description || '',
    });
    setArticleDialogOpen(true);
  };

  const openEditCategory = (category: NewsCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      color: category.color,
      is_active: category.is_active,
    });
    setCategoryDialogOpen(true);
  };

  const openPreview = (article: NewsArticle) => {
    setPreviewArticle(article);
    setPreviewDialogOpen(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">News & Announcements</h2>
          <p className="text-muted-foreground">Manage articles, updates, and news content</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{articles.length}</p>
                <p className="text-sm text-muted-foreground">Total Articles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Eye className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{articles.filter(a => a.is_published).length}</p>
                <p className="text-sm text-muted-foreground">Published</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FolderOpen className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{categories.length}</p>
                <p className="text-sm text-muted-foreground">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{articles.reduce((sum, a) => sum + a.view_count, 0)}</p>
                <p className="text-sm text-muted-foreground">Total Views</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="articles">
        <TabsList>
          <TabsTrigger value="articles">Articles</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={articleDialogOpen} onOpenChange={(open) => { setArticleDialogOpen(open); if (!open) resetArticleForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> New Article</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingArticle ? 'Edit Article' : 'Create New Article'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Title</Label>
                      <Input value={articleForm.title} onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })} placeholder="Article title" />
                    </div>
                    <div>
                      <Label>Slug</Label>
                      <Input value={articleForm.slug} onChange={(e) => setArticleForm({ ...articleForm, slug: e.target.value })} placeholder="Auto-generated" />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Excerpt</Label>
                    <Textarea value={articleForm.excerpt} onChange={(e) => setArticleForm({ ...articleForm, excerpt: e.target.value })} placeholder="Brief summary..." rows={2} />
                  </div>
                  
                  <div>
                    <Label>Content</Label>
                    <Textarea value={articleForm.content} onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })} placeholder="Full article content (supports markdown)" rows={10} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Featured Image URL</Label>
                      <Input value={articleForm.featured_image} onChange={(e) => setArticleForm({ ...articleForm, featured_image: e.target.value })} placeholder="https://..." />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select value={articleForm.category_id} onValueChange={(v) => setArticleForm({ ...articleForm, category_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Tags (comma-separated)</Label>
                    <Input value={articleForm.tags} onChange={(e) => setArticleForm({ ...articleForm, tags: e.target.value })} placeholder="news, update, feature" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Meta Title (SEO)</Label>
                      <Input value={articleForm.meta_title} onChange={(e) => setArticleForm({ ...articleForm, meta_title: e.target.value })} />
                    </div>
                    <div>
                      <Label>Meta Description (SEO)</Label>
                      <Input value={articleForm.meta_description} onChange={(e) => setArticleForm({ ...articleForm, meta_description: e.target.value })} />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch checked={articleForm.is_published} onCheckedChange={(c) => setArticleForm({ ...articleForm, is_published: c })} />
                      <Label>Publish</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={articleForm.is_featured} onCheckedChange={(c) => setArticleForm({ ...articleForm, is_featured: c })} />
                      <Label>Featured</Label>
                    </div>
                  </div>
                  
                  <Button onClick={handleSaveArticle} className="w-full">{editingArticle ? 'Update' : 'Create'} Article</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No articles yet. Create your first one!
                    </TableCell>
                  </TableRow>
                ) : (
                  articles.map((article) => (
                    <TableRow key={article.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{article.title}</p>
                          {article.is_featured && <Badge variant="secondary" className="mt-1">Featured</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {article.category ? (
                          <Badge style={{ backgroundColor: article.category.color }} className="text-white">
                            {article.category.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Uncategorized</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={article.is_published ? 'default' : 'outline'}>
                          {article.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </TableCell>
                      <TableCell>{article.view_count}</TableCell>
                      <TableCell>{format(new Date(article.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openPreview(article)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => togglePublish(article)}>
                            <Calendar className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEditArticle(article)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteArticle(article.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={categoryDialogOpen} onOpenChange={(open) => { setCategoryDialogOpen(open); if (!open) resetCategoryForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> New Category</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCategory ? 'Edit Category' : 'Create Category'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="Company News" />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input value={categoryForm.slug} onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })} placeholder="Auto-generated" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} />
                  </div>
                  <div>
                    <Label>Color</Label>
                    <div className="flex gap-2">
                      <Input type="color" value={categoryForm.color} onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })} className="w-16 h-10 p-1" />
                      <Input value={categoryForm.color} onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={categoryForm.is_active} onCheckedChange={(c) => setCategoryForm({ ...categoryForm, is_active: c })} />
                    <Label>Active</Label>
                  </div>
                  <Button onClick={handleSaveCategory} className="w-full">{editingCategory ? 'Update' : 'Create'} Category</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <Card key={category.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: category.color }} />
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                    </div>
                    <Badge variant={category.is_active ? 'default' : 'secondary'}>
                      {category.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{category.description || 'No description'}</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {articles.filter(a => a.category_id === category.id).length} articles
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditCategory(category)}>
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeleteCategory(category.id)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Article Preview</DialogTitle>
          </DialogHeader>
          {previewArticle && (
            <div className="space-y-4">
              {previewArticle.featured_image && (
                <img src={previewArticle.featured_image} alt={previewArticle.title} className="w-full h-48 object-cover rounded-lg" />
              )}
              <h2 className="text-2xl font-bold">{previewArticle.title}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {previewArticle.category && (
                  <Badge style={{ backgroundColor: previewArticle.category.color }} className="text-white">
                    {previewArticle.category.name}
                  </Badge>
                )}
                <span>•</span>
                <span>{format(new Date(previewArticle.created_at), 'MMMM d, yyyy')}</span>
                <span>•</span>
                <span>{previewArticle.view_count} views</span>
              </div>
              {previewArticle.excerpt && (
                <p className="text-lg text-muted-foreground italic">{previewArticle.excerpt}</p>
              )}
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {previewArticle.content}
              </div>
              {previewArticle.tags && previewArticle.tags.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {previewArticle.tags.map((tag, i) => (
                    <Badge key={i} variant="outline">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
