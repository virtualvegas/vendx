import { useEffect, useRef, useState } from "react";
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
import {
  Plus, Edit, Trash2, Eye, FileText, FolderOpen, Calendar, TrendingUp,
  Send, ExternalLink, Image as ImageIcon, Upload, Loader2, Heart, MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import MarkdownEditor from "@/components/dashboard/news/MarkdownEditor";
import NewsAnalyticsPanel from "@/components/dashboard/news/NewsAnalyticsPanel";
import { slugify } from "@/lib/newsHelpers";

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

type ArticleStatus = "draft" | "scheduled" | "published";

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
  status: ArticleStatus;
  scheduled_publish_at: string | null;
  notify_on_publish: boolean;
  last_notified_at: string | null;
  published_at: string | null;
  view_count: number;
  tags: string[];
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  category?: NewsCategory;
}

interface ArticleStat {
  article_id: string;
  like_count: number;
  comment_count: number;
  views_30d: number;
}

const emptyArticleForm = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  featured_image: "",
  category_id: "",
  status: "draft" as ArticleStatus,
  scheduled_publish_at: "",
  notify_on_publish: true,
  is_featured: false,
  tags: "",
  meta_title: "",
  meta_description: "",
};

export default function NewsManager() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [stats, setStats] = useState<ArticleStat[]>([]);
  const [loading, setLoading] = useState(true);

  const [articleDialogOpen, setArticleDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  const [articleForm, setArticleForm] = useState(emptyArticleForm);
  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);
  const [savingArticle, setSavingArticle] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: "",
    description: "",
    color: "#3b82f6",
    is_active: true,
  });
  const [editingCategory, setEditingCategory] = useState<NewsCategory | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [articlesRes, categoriesRes, statsRes] = await Promise.all([
      supabase.from("news_articles").select("*, category:news_categories(*)").order("created_at", { ascending: false }),
      supabase.from("news_categories").select("*").order("display_order"),
      supabase.from("news_article_stats").select("*"),
    ]);
    if (!articlesRes.error) setArticles((articlesRes.data ?? []) as NewsArticle[]);
    if (!categoriesRes.error) setCategories((categoriesRes.data ?? []) as NewsCategory[]);
    if (!statsRes.error) setStats((statsRes.data ?? []) as ArticleStat[]);
    setLoading(false);
  };

  const statsById = new Map(stats.map((s) => [s.article_id, s]));

  // -------------- Article CRUD --------------
  const buildPayload = () => {
    const slug = articleForm.slug || slugify(articleForm.title);
    const tags = articleForm.tags.split(",").map((t) => t.trim()).filter(Boolean);
    return {
      title: articleForm.title,
      slug,
      excerpt: articleForm.excerpt || null,
      content: articleForm.content,
      featured_image: articleForm.featured_image || null,
      category_id: articleForm.category_id || null,
      status: articleForm.status,
      scheduled_publish_at:
        articleForm.status === "scheduled" && articleForm.scheduled_publish_at
          ? new Date(articleForm.scheduled_publish_at).toISOString()
          : null,
      notify_on_publish: articleForm.notify_on_publish,
      is_featured: articleForm.is_featured,
      tags,
      meta_title: articleForm.meta_title || null,
      meta_description: articleForm.meta_description || null,
    };
  };

  const handleSaveArticle = async (notify = false) => {
    if (!articleForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (articleForm.status === "scheduled" && !articleForm.scheduled_publish_at) {
      toast.error("Pick a publish time for scheduled articles");
      return;
    }
    setSavingArticle(true);
    const payload = buildPayload();
    let articleId: string | undefined = editingArticle?.id;

    if (editingArticle) {
      const { error } = await supabase.from("news_articles").update(payload).eq("id", editingArticle.id);
      if (error) {
        toast.error("Failed to update article");
        setSavingArticle(false);
        return;
      }
    } else {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("news_articles")
        .insert([{ ...payload, author_id: user.user?.id ?? null }])
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Failed to create article");
        setSavingArticle(false);
        return;
      }
      articleId = data.id;
    }

    toast.success(editingArticle ? "Article updated" : "Article created");

    if (notify && articleId && articleForm.status === "published" && articleForm.notify_on_publish) {
      void supabase.functions
        .invoke("news-notify-subscribers", { body: { article_id: articleId } })
        .then(({ error }) => {
          if (error) toast.error("Notification queue failed");
          else toast.success("Subscribers notified");
        });
    }

    setSavingArticle(false);
    setArticleDialogOpen(false);
    resetArticleForm();
    fetchData();
  };

  // Debounced autosave for drafts
  useEffect(() => {
    if (!editingArticle || articleForm.status !== "draft" || !articleDialogOpen) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setAutosaveStatus("saving");
    autosaveTimer.current = setTimeout(async () => {
      const payload = buildPayload();
      const { error } = await supabase.from("news_articles").update(payload).eq("id", editingArticle.id);
      setAutosaveStatus(error ? "idle" : "saved");
    }, 1500);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleForm, articleDialogOpen, editingArticle]);

  const handleDeleteArticle = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    const { error } = await supabase.from("news_articles").delete().eq("id", id);
    if (error) toast.error("Failed to delete article");
    else {
      toast.success("Article deleted");
      fetchData();
    }
  };

  const toggleFeatured = async (article: NewsArticle) => {
    const { error } = await supabase
      .from("news_articles")
      .update({ is_featured: !article.is_featured })
      .eq("id", article.id);
    if (!error) {
      toast.success(article.is_featured ? "Removed from featured" : "Added to featured");
      fetchData();
    }
  };

  const quickPublish = async (article: NewsArticle) => {
    const next = article.status === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("news_articles")
      .update({ status: next, scheduled_publish_at: null })
      .eq("id", article.id);
    if (!error) {
      toast.success(next === "published" ? "Article published" : "Article unpublished");
      if (next === "published" && article.notify_on_publish) {
        void supabase.functions.invoke("news-notify-subscribers", { body: { article_id: article.id } });
      }
      fetchData();
    }
  };

  // Cover image upload
  const uploadCover = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only images allowed");
      return;
    }
    setUploadingCover(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `news/covers/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      cacheControl: "31536000",
    });
    if (error) {
      toast.error("Upload failed");
      setUploadingCover(false);
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setArticleForm((p) => ({ ...p, featured_image: data.publicUrl }));
    setUploadingCover(false);
    toast.success("Cover image set");
  };

  // -------------- Category CRUD --------------
  const handleSaveCategory = async () => {
    const slug = categoryForm.slug || slugify(categoryForm.name);
    if (editingCategory) {
      const { error } = await supabase.from("news_categories").update({ ...categoryForm, slug }).eq("id", editingCategory.id);
      if (error) toast.error("Failed to update category");
      else {
        toast.success("Category updated");
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from("news_categories")
        .insert([{ ...categoryForm, slug, display_order: categories.length }]);
      if (error) toast.error("Failed to create category");
      else {
        toast.success("Category created");
        fetchData();
      }
    }
    setCategoryDialogOpen(false);
    resetCategoryForm();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    const { error } = await supabase.from("news_categories").delete().eq("id", id);
    if (error) toast.error("Failed to delete category");
    else {
      toast.success("Category deleted");
      fetchData();
    }
  };

  // -------------- Helpers --------------
  const resetArticleForm = () => {
    setArticleForm(emptyArticleForm);
    setEditingArticle(null);
    setAutosaveStatus("idle");
  };
  const resetCategoryForm = () => {
    setCategoryForm({ name: "", slug: "", description: "", color: "#3b82f6", is_active: true });
    setEditingCategory(null);
  };

  const openEditArticle = (article: NewsArticle) => {
    setEditingArticle(article);
    setArticleForm({
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt || "",
      content: article.content,
      featured_image: article.featured_image || "",
      category_id: article.category_id || "",
      status: article.status || (article.is_published ? "published" : "draft"),
      scheduled_publish_at: article.scheduled_publish_at
        ? new Date(article.scheduled_publish_at).toISOString().slice(0, 16)
        : "",
      notify_on_publish: article.notify_on_publish ?? true,
      is_featured: article.is_featured,
      tags: article.tags?.join(", ") || "",
      meta_title: article.meta_title || "",
      meta_description: article.meta_description || "",
    });
    setArticleDialogOpen(true);
    setAutosaveStatus("idle");
  };

  const openEditCategory = (category: NewsCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      color: category.color,
      is_active: category.is_active,
    });
    setCategoryDialogOpen(true);
  };

  const openInNewTab = (slug: string, preview = false) => {
    const url = preview ? `/news/${slug}?preview=1` : `/news/${slug}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">News & Articles</h2>
          <p className="text-muted-foreground">Author rich stories with drafts, scheduling, and analytics.</p>
        </div>
      </div>

      <Tabs defaultValue="articles">
        <TabsList>
          <TabsTrigger value="articles">Articles</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* ============== ARTICLES ============== */}
        <TabsContent value="articles" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={<FileText className="h-6 w-6 text-primary" />} label="Total" value={articles.length} />
            <KpiCard
              icon={<Eye className="h-6 w-6 text-green-500" />}
              label="Published"
              value={articles.filter((a) => a.status === "published").length}
            />
            <KpiCard
              icon={<Calendar className="h-6 w-6 text-amber-500" />}
              label="Scheduled"
              value={articles.filter((a) => a.status === "scheduled").length}
            />
            <KpiCard
              icon={<TrendingUp className="h-6 w-6 text-blue-500" />}
              label="All-time views"
              value={articles.reduce((sum, a) => sum + a.view_count, 0)}
            />
          </div>

          <div className="flex justify-end">
            <Dialog
              open={articleDialogOpen}
              onOpenChange={(open) => {
                setArticleDialogOpen(open);
                if (!open) resetArticleForm();
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> New Article
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between gap-4">
                    <span>{editingArticle ? "Edit Article" : "Create New Article"}</span>
                    {editingArticle && articleForm.status === "draft" && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {autosaveStatus === "saving" && <>Saving draft…</>}
                        {autosaveStatus === "saved" && <>Draft saved</>}
                      </span>
                    )}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={articleForm.title}
                        onChange={(e) =>
                          setArticleForm((p) => ({
                            ...p,
                            title: e.target.value,
                            slug: editingArticle ? p.slug : slugify(e.target.value),
                          }))
                        }
                        placeholder="Article title"
                      />
                    </div>
                    <div>
                      <Label>Slug</Label>
                      <Input
                        value={articleForm.slug}
                        onChange={(e) => setArticleForm({ ...articleForm, slug: e.target.value })}
                        placeholder="auto-from-title"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Excerpt</Label>
                    <Textarea
                      value={articleForm.excerpt}
                      onChange={(e) => setArticleForm({ ...articleForm, excerpt: e.target.value })}
                      placeholder="Brief one- or two-sentence summary…"
                      rows={2}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Cover image</Label>
                      <label className="text-xs text-muted-foreground inline-flex items-center gap-1 cursor-pointer hover:text-foreground">
                        {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingCover}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadCover(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <div className="flex items-start gap-3">
                      <Input
                        value={articleForm.featured_image}
                        onChange={(e) => setArticleForm({ ...articleForm, featured_image: e.target.value })}
                        placeholder="https://… or upload above"
                        className="flex-1"
                      />
                      {articleForm.featured_image && (
                        <img
                          src={articleForm.featured_image}
                          alt=""
                          className="h-12 w-20 object-cover rounded border"
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <Label>Body (Markdown)</Label>
                    <MarkdownEditor
                      value={articleForm.content}
                      onChange={(v) => setArticleForm({ ...articleForm, content: v })}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Category</Label>
                      <Select
                        value={articleForm.category_id}
                        onValueChange={(v) => setArticleForm({ ...articleForm, category_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Tags (comma-separated)</Label>
                      <Input
                        value={articleForm.tags}
                        onChange={(e) => setArticleForm({ ...articleForm, tags: e.target.value })}
                        placeholder="news, update, feature"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Meta title (SEO)</Label>
                      <Input
                        value={articleForm.meta_title}
                        onChange={(e) => setArticleForm({ ...articleForm, meta_title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Meta description (SEO)</Label>
                      <Input
                        value={articleForm.meta_description}
                        onChange={(e) => setArticleForm({ ...articleForm, meta_description: e.target.value })}
                      />
                    </div>
                  </div>

                  <Card className="bg-muted/30">
                    <CardContent className="p-4 space-y-3">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label>Status</Label>
                          <Select
                            value={articleForm.status}
                            onValueChange={(v: ArticleStatus) => setArticleForm({ ...articleForm, status: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="scheduled">Scheduled</SelectItem>
                              <SelectItem value="published">Published</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {articleForm.status === "scheduled" && (
                          <div>
                            <Label>Publish at</Label>
                            <Input
                              type="datetime-local"
                              value={articleForm.scheduled_publish_at}
                              onChange={(e) =>
                                setArticleForm({ ...articleForm, scheduled_publish_at: e.target.value })
                              }
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={articleForm.is_featured}
                            onCheckedChange={(c) => setArticleForm({ ...articleForm, is_featured: c })}
                          />
                          <Label>Featured</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={articleForm.notify_on_publish}
                            onCheckedChange={(c) => setArticleForm({ ...articleForm, notify_on_publish: c })}
                          />
                          <Label>Notify subscribers on publish</Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex flex-wrap gap-2 justify-end">
                    {editingArticle && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openInNewTab(articleForm.slug || editingArticle.slug, true)}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" /> Open preview
                      </Button>
                    )}
                    <Button
                      onClick={() => handleSaveArticle(false)}
                      disabled={savingArticle}
                      variant={articleForm.status === "published" ? "outline" : "default"}
                    >
                      {savingArticle && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingArticle ? "Save" : "Create"}
                    </Button>
                    {articleForm.status === "published" && articleForm.notify_on_publish && (
                      <Button onClick={() => handleSaveArticle(true)} disabled={savingArticle}>
                        <Send className="h-4 w-4 mr-1" /> Save & notify
                      </Button>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Engagement</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
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
                  articles.map((article) => {
                    const stat = statsById.get(article.id);
                    return (
                      <TableRow key={article.id}>
                        <TableCell>
                          <div className="flex items-start gap-3">
                            {article.featured_image ? (
                              <img
                                src={article.featured_image}
                                alt=""
                                className="h-10 w-14 object-cover rounded flex-shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-14 rounded bg-muted flex-shrink-0 flex items-center justify-center">
                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-medium line-clamp-1">{article.title}</p>
                              {article.is_featured && (
                                <Badge variant="secondary" className="mt-1 text-[10px]">
                                  Featured
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {article.category ? (
                            <Badge style={{ backgroundColor: article.category.color }} className="text-white">
                              {article.category.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">Uncategorized</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={article.status} scheduledAt={article.scheduled_publish_at} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Eye className="h-3 w-3" /> {article.view_count}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Heart className="h-3 w-3" /> {stat?.like_count ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" /> {stat?.comment_count ?? 0}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">
                          {format(new Date(article.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Open"
                              onClick={() => openInNewTab(article.slug, article.status !== "published")}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title={article.status === "published" ? "Unpublish" : "Publish now"}
                              onClick={() => quickPublish(article)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Feature" onClick={() => toggleFeatured(article)}>
                              <TrendingUp className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Edit" onClick={() => openEditArticle(article)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Delete"
                              onClick={() => handleDeleteArticle(article.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ============== CATEGORIES ============== */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            <Dialog
              open={categoryDialogOpen}
              onOpenChange={(open) => {
                setCategoryDialogOpen(open);
                if (!open) resetCategoryForm();
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> New Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCategory ? "Edit Category" : "Create Category"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      placeholder="Company News"
                    />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input
                      value={categoryForm.slug}
                      onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                      placeholder="Auto-generated"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={categoryForm.color}
                        onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        value={categoryForm.color}
                        onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={categoryForm.is_active}
                      onCheckedChange={(c) => setCategoryForm({ ...categoryForm, is_active: c })}
                    />
                    <Label>Active</Label>
                  </div>
                  <Button onClick={handleSaveCategory} className="w-full">
                    {editingCategory ? "Update" : "Create"} Category
                  </Button>
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
                    <Badge variant={category.is_active ? "default" : "secondary"}>
                      {category.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{category.description || "No description"}</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {articles.filter((a) => a.category_id === category.id).length} articles
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

        {/* ============== ANALYTICS ============== */}
        <TabsContent value="analytics">
          <NewsAnalyticsPanel articles={articles.map((a) => ({ id: a.id, title: a.title, view_count: a.view_count }))} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const KpiCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const StatusBadge = ({ status, scheduledAt }: { status: ArticleStatus; scheduledAt: string | null }) => {
  if (status === "published") return <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30">Published</Badge>;
  if (status === "scheduled")
    return (
      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
        Scheduled{scheduledAt ? ` · ${format(new Date(scheduledAt), "MMM d HH:mm")}` : ""}
      </Badge>
    );
  return <Badge variant="outline">Draft</Badge>;
};
