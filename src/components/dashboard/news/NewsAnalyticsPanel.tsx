import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Heart, MessageSquare, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ViewRow {
  article_id: string;
  viewed_at: string;
}

interface Stat {
  article_id: string;
  like_count: number;
  comment_count: number;
  views_30d: number;
}

interface ArticleLite {
  id: string;
  title: string;
  view_count: number;
}

/**
 * 30-day views chart + top-articles leaderboard derived from
 * `news_article_views` and the `news_article_stats` view.
 */
const NewsAnalyticsPanel = ({ articles }: { articles: ArticleLite[] }) => {
  const [views, setViews] = useState<ViewRow[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [viewsRes, statsRes] = await Promise.all([
        supabase.from("news_article_views").select("article_id, viewed_at").gte("viewed_at", since),
        supabase.from("news_article_stats").select("*"),
      ]);
      setViews((viewsRes.data ?? []) as ViewRow[]);
      setStats((statsRes.data ?? []) as Stat[]);
      setLoading(false);
    })();
  }, []);

  const byArticle = new Map(stats.map((s) => [s.article_id, s]));
  const articleById = new Map(articles.map((a) => [a.id, a]));

  // Build 30-day series
  const days: { date: string; views: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, views: 0 });
  }
  const idx = new Map(days.map((d, i) => [d.date, i]));
  for (const v of views) {
    const k = v.viewed_at.slice(0, 10);
    const i = idx.get(k);
    if (i !== undefined) days[i].views += 1;
  }

  const totalViews30 = days.reduce((n, d) => n + d.views, 0);
  const totalLikes = stats.reduce((n, s) => n + s.like_count, 0);
  const totalComments = stats.reduce((n, s) => n + s.comment_count, 0);

  const topArticles = [...stats]
    .sort((a, b) => b.views_30d - a.views_30d)
    .slice(0, 5)
    .map((s) => ({
      stat: s,
      article: articleById.get(s.article_id),
    }))
    .filter((r) => r.article);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat icon={<Eye className="h-5 w-5 text-primary" />} label="Views (30d)" value={totalViews30} />
        <Stat
          icon={<TrendingUp className="h-5 w-5 text-accent" />}
          label="All-time views"
          value={articles.reduce((n, a) => n + a.view_count, 0)}
        />
        <Stat icon={<Heart className="h-5 w-5 text-red-500" />} label="Likes" value={totalLikes} />
        <Stat icon={<MessageSquare className="h-5 w-5 text-blue-500" />} label="Comments" value={totalComments} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Views over the last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={days}>
                  <defs>
                    <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => format(new Date(v), "MMM d")}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                    labelFormatter={(v) => format(new Date(v as string), "EEE, MMM d")}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="hsl(var(--primary))"
                    fill="url(#viewsGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top articles (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {topArticles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No views yet.</p>
          ) : (
            <ul className="divide-y">
              {topArticles.map(({ stat, article }) => (
                <li key={stat.article_id} className="flex items-center justify-between py-3">
                  <span className="font-medium truncate pr-3">{article!.title}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="gap-1">
                      <Eye className="h-3 w-3" /> {stat.views_30d}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Heart className="h-3 w-3" /> {stat.like_count}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <MessageSquare className="h-3 w-3" /> {stat.comment_count}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
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

export default NewsAnalyticsPanel;
