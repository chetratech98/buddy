import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, TrendingUp, Calendar, Clock, CheckCircle2, Loader2,
  ArrowUp, ArrowDown, Minus, RefreshCw, BarChart3,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { scoreContent } from "@/lib/seo-scorer";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PostStats {
  total: number;
  published: number;
  drafts: number;
  scheduled: number;
  review: number;
  avgWordCount: number;
  avgSeoScore: number;
  thisMonthCount: number;
}

interface ActivityData {
  date: string;
  posts: number;
}

const STATUS_COLORS = {
  published: "#10b981",
  draft:     "#6b7280",
  scheduled: "#3b82f6",
  review:    "#f59e0b",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[.*?\]\(.*?\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, " ")
    .replace(/[*_~>|]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types for rankings
// ─────────────────────────────────────────────────────────────────────────────

interface RankingRow {
  postId: string;
  postTitle: string;
  keyword: string;
  position: number | null;
  changeFromLast: number | null;
  checkedAt: string;
  sourceUrl: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const Analytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [range,   setRange]   = useState<7 | 30>(30);
  const [activeTab, setActiveTab] = useState<"overview" | "rankings">("overview");

  const [stats, setStats] = useState<PostStats>({
    total: 0, published: 0, drafts: 0, scheduled: 0, review: 0,
    avgWordCount: 0, avgSeoScore: 0, thisMonthCount: 0,
  });
  const [activityData,   setActivityData]   = useState<ActivityData[]>([]);
  const [activityData30, setActivityData30] = useState<ActivityData[]>([]);
  const [recentPosts,    setRecentPosts]    = useState<{ id: string; title: string; status: string; created_at: string; wordCount: number; seoScore: number }[]>([]);

  // Rankings state
  const [rankings,        setRankings]        = useState<RankingRow[]>([]);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [rankCheckLoading, setRankCheckLoading] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [user]);

  const fetchRankings = useCallback(async () => {
    if (!user) return;
    setRankingsLoading(true);
    try {
      // Get most recent ranking per post+keyword pair
      const { data, error } = await supabase
        .from("post_rankings")
        .select("post_id, keyword, position, change_from_last, checked_at, source_url")
        .eq("user_id", user.id)
        .order("checked_at", { ascending: false })
        .limit(100);

      if (error || !data) throw error;

      // Deduplicate: keep most recent per post_id+keyword
      const seen = new Set<string>();
      const deduped = data.filter((r) => {
        const key = `${r.post_id}_${r.keyword}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Fetch post titles for the post_ids
      const postIds = [...new Set(deduped.map((r) => r.post_id))];
      const { data: posts } = await supabase
        .from("blog_posts")
        .select("id, title")
        .in("id", postIds);

      const titleMap = new Map((posts ?? []).map((p) => [p.id, p.title ?? "Untitled"]));

      setRankings(deduped.map((r) => ({
        postId:        r.post_id,
        postTitle:     titleMap.get(r.post_id) ?? "Untitled",
        keyword:       r.keyword,
        position:      r.position,
        changeFromLast: r.change_from_last,
        checkedAt:     r.checked_at,
        sourceUrl:     r.source_url,
      })));
    } catch (err) {
      console.error("Rankings fetch error:", err);
    } finally {
      setRankingsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === "rankings") fetchRankings();
  }, [activeTab, fetchRankings]);

  const handleRunRankCheck = async () => {
    if (!user) return;
    setRankCheckLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("rank-tracker", {
        body: { user_id: user.id },
      });
      if (error) throw error;
      await fetchRankings();
      // Show result summary
      const r = data as { processed?: number; ranked?: number; improved?: number; dropped?: number };
      const msg = `Checked ${r.processed ?? 0} posts: ${r.ranked ?? 0} ranked, ${r.improved ?? 0} improved, ${r.dropped ?? 0} dropped`;
      alert(msg); // simple feedback
    } catch (e) {
      console.error("Rank check error:", e);
      alert("Rank check failed — check that SERP_API_KEY is configured.");
    } finally {
      setRankCheckLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!user) {
      // ── Demo data ──────────────────────────────────────────────────────────
      setStats({
        total: 24, published: 12, drafts: 8, scheduled: 3, review: 1,
        avgWordCount: 1850, avgSeoScore: 72, thisMonthCount: 7,
      });
      setActivityData(
        Array.from({ length: 7 }, (_, i) => ({
          date:  format(subDays(new Date(), 6 - i), "MMM dd"),
          posts: Math.floor(Math.random() * 4) + 1,
        }))
      );
      setActivityData30(
        Array.from({ length: 30 }, (_, i) => ({
          date:  format(subDays(new Date(), 29 - i), "MMM dd"),
          posts: Math.floor(Math.random() * 4),
        }))
      );
      setRecentPosts([
        { title: "SEO Best Practices Guide",        status: "published", created_at: new Date().toISOString(), wordCount: 2200, seoScore: 81 },
        { title: "Content Marketing Strategy 2026", status: "draft",     created_at: new Date().toISOString(), wordCount: 1400, seoScore: 64 },
        { title: "Social Media Trends 2026",        status: "scheduled", created_at: new Date().toISOString(), wordCount: 1850, seoScore: 73 },
      ]);
      setLoading(false);
      return;
    }

    try {
      const { data: posts, error } = await supabase
        .from("blog_posts")
        .select("status, created_at, title, content, keywords, seo_description")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error || !posts) throw error ?? new Error("No data");

      // ── Aggregate stats ────────────────────────────────────────────────────
      const now       = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      let totalWords = 0;
      let totalSeo   = 0;
      const scoredPosts = posts.map((p) => {
        const wc  = p.content ? countWords(p.content) : 0;
        const seo = p.content
          ? scoreContent({
              title:          p.title ?? "",
              content:        p.content,
              keywords:       Array.isArray(p.keywords) ? p.keywords : [],
              seoDescription: p.seo_description ?? "",
            }).total
          : 0;
        totalWords += wc;
        totalSeo   += seo;
        return { ...p, wordCount: wc, seoScore: seo };
      });

      const n = posts.length || 1;
      setStats({
        total:         posts.length,
        published:     posts.filter((p) => p.status === "published").length,
        drafts:        posts.filter((p) => p.status === "draft").length,
        scheduled:     posts.filter((p) => p.status === "scheduled").length,
        review:        posts.filter((p) => p.status === "review").length,
        avgWordCount:  Math.round(totalWords / n),
        avgSeoScore:   Math.round(totalSeo   / n),
        thisMonthCount: posts.filter((p) => new Date(p.created_at) >= monthStart).length,
      });

      // ── 7-day activity ─────────────────────────────────────────────────────
      setActivityData(
        Array.from({ length: 7 }, (_, i) => {
          const date    = subDays(now, 6 - i);
          const dateStr = format(startOfDay(date), "yyyy-MM-dd");
          return {
            date:  format(date, "MMM dd"),
            posts: posts.filter((p) =>
              format(startOfDay(new Date(p.created_at)), "yyyy-MM-dd") === dateStr
            ).length,
          };
        })
      );

      // ── 30-day activity ────────────────────────────────────────────────────
      setActivityData30(
        Array.from({ length: 30 }, (_, i) => {
          const date    = subDays(now, 29 - i);
          const dateStr = format(startOfDay(date), "yyyy-MM-dd");
          return {
            date:  format(date, "MMM dd"),
            posts: posts.filter((p) =>
              format(startOfDay(new Date(p.created_at)), "yyyy-MM-dd") === dateStr
            ).length,
          };
        })
      );

      // ── Recent posts (top 8) ───────────────────────────────────────────────
      setRecentPosts(
        scoredPosts.slice(0, 8).map((p) => ({
          id:         p.id,
          title:      p.title ?? "Untitled",
          status:     p.status ?? "draft",
          created_at: p.created_at,
          wordCount:  p.wordCount,
          seoScore:   p.seoScore,
        }))
      );
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const statusDistribution = [
    { name: "Published", value: stats.published, color: STATUS_COLORS.published },
    { name: "Drafts",    value: stats.drafts,    color: STATUS_COLORS.draft    },
    { name: "Scheduled", value: stats.scheduled, color: STATUS_COLORS.scheduled },
    { name: "Review",    value: stats.review,    color: STATUS_COLORS.review   },
  ].filter((item) => item.value > 0);

  const activeActivity = range === 7 ? activityData : activityData30;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <PageShell showSignOut>
      <div className="space-y-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Real metrics from your content library</p>
          </div>
          {/* Tab switcher */}
          <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
            {(["overview", "rankings"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "overview" ? (
                  <span className="flex items-center gap-1.5"><BarChart3 size={14} /> Overview</span>
                ) : (
                  <span className="flex items-center gap-1.5"><TrendingUp size={14} /> Rankings</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Rankings Tab ── */}
        {activeTab === "rankings" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Keyword Rankings</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Google position for each published post's primary keyword. Updated by the daily rank-tracker.
                </p>
              </div>
              <button
                onClick={handleRunRankCheck}
                disabled={rankCheckLoading}
                className="flex items-center gap-2 text-sm bg-primary text-primary-foreground px-4 py-2.5 rounded-xl hover:brightness-110 transition-all font-medium shadow-sm disabled:opacity-60"
              >
                {rankCheckLoading ? (
                  <><Loader2 size={14} className="animate-spin" /> Checking…</>
                ) : (
                  <><RefreshCw size={14} /> Check Rankings Now</>
                )}
              </button>
            </div>

            {rankingsLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-primary" size={28} />
              </div>
            ) : rankings.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <TrendingUp className="mx-auto h-12 w-12 mb-4 text-muted-foreground/30" />
                  <h3 className="font-semibold text-lg mb-2">No ranking data yet</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Click "Check Rankings Now" to check where your published posts appear in Google.
                    Requires published posts with keywords and SERP_API_KEY configured.
                  </p>
                  <button
                    onClick={handleRunRankCheck}
                    disabled={rankCheckLoading}
                    className="btn-primary inline-flex"
                  >
                    {rankCheckLoading ? <Loader2 size={14} className="animate-spin mr-2" /> : <RefreshCw size={14} className="mr-2" />}
                    Check Rankings Now
                  </button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          <th className="px-5 py-3 text-left">Post</th>
                          <th className="px-5 py-3 text-left">Keyword</th>
                          <th className="px-5 py-3 text-center">Position</th>
                          <th className="px-5 py-3 text-center">Change</th>
                          <th className="px-5 py-3 text-left">Last Checked</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {rankings.map((r, i) => {
                          const pos = r.position;
                          const posColor =
                            pos === null           ? "text-muted-foreground" :
                            pos <= 3               ? "text-green-600 font-bold" :
                            pos <= 10              ? "text-blue-600 font-semibold" :
                            pos <= 20              ? "text-yellow-600" : "text-orange-600";

                          const change = r.changeFromLast;
                          return (
                            <tr key={i} className="hover:bg-muted/20 transition-colors">
                              <td className="px-5 py-3">
                                <button
                                  onClick={() => navigate(`/posts/${r.postId}/edit`)}
                                  className="text-left font-medium hover:text-primary transition-colors line-clamp-1 max-w-[240px]"
                                >
                                  {r.postTitle}
                                </button>
                              </td>
                              <td className="px-5 py-3 text-muted-foreground">{r.keyword}</td>
                              <td className="px-5 py-3 text-center">
                                {pos !== null ? (
                                  <span className={`tabular-nums ${posColor}`}>
                                    #{pos}
                                    {pos <= 10 && (
                                      <span className="ml-1 text-[10px] text-muted-foreground">top 10</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">Not found</span>
                                )}
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center justify-center gap-1">
                                  {change === null ? (
                                    <Minus size={13} className="text-muted-foreground" />
                                  ) : change < 0 ? (
                                    <><ArrowUp size={13} className="text-green-500" /><span className="text-green-500 text-xs font-medium">{Math.abs(change)}</span></>
                                  ) : change > 0 ? (
                                    <><ArrowDown size={13} className="text-red-500" /><span className="text-red-500 text-xs font-medium">{change}</span></>
                                  ) : (
                                    <Minus size={13} className="text-muted-foreground" />
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-3 text-xs text-muted-foreground">
                                {format(new Date(r.checkedAt), "MMM dd, HH:mm")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Overview Tab ── */}
        {activeTab === "overview" && (<>

        {/* ── Top stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">{stats.thisMonthCount} this month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Published</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.published}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Word Count</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgWordCount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {stats.avgWordCount >= 2000 ? "Excellent length" : stats.avgWordCount >= 1500 ? "Good length" : "Aim for 2000+"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg SEO Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                stats.avgSeoScore >= 85 ? "text-green-600" :
                stats.avgSeoScore >= 70 ? "text-blue-600" :
                stats.avgSeoScore >= 55 ? "text-yellow-600" : "text-orange-600"
              }`}>
                {stats.avgSeoScore}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.avgSeoScore >= 85 ? "Grade A" :
                 stats.avgSeoScore >= 70 ? "Grade B" :
                 stats.avgSeoScore >= 55 ? "Grade C" : "Needs work"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Activity chart ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Publishing Activity</CardTitle>
              <CardDescription>Posts created per day</CardDescription>
            </div>
            <div className="flex gap-1">
              {([7, 30] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    range === r
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}d
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              {range === 7 ? (
                <BarChart data={activeActivity}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="posts" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={activeActivity}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="posts"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ── Status distribution + secondary stats ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
              <CardDescription>Posts by current status</CardDescription>
            </CardHeader>
            <CardContent>
              {statusDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={95}
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                  No posts yet
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status Summary</CardTitle>
              <CardDescription>Breakdown of your content pipeline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {[
                { label: "Drafts in progress",  value: stats.drafts,    color: "bg-gray-400",  icon: FileText },
                { label: "In review",            value: stats.review,    color: "bg-amber-400", icon: Clock },
                { label: "Scheduled to publish", value: stats.scheduled, color: "bg-blue-500",  icon: Calendar },
                { label: "Published & live",     value: stats.published, color: "bg-green-500", icon: CheckCircle2 },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${color} shrink-0`} />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="font-bold text-sm">{value}</span>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t mt-4 flex justify-between text-sm">
                <span className="text-muted-foreground">Total posts</span>
                <span className="font-bold">{stats.total}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Recent posts table ── */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Posts</CardTitle>
            <CardDescription>Your latest content with SEO metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {recentPosts.length > 0 ? (
              <div className="space-y-2">
                {recentPosts.map((post, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <button onClick={() => navigate(`/posts/${post.id}/edit`)} className="font-medium text-sm truncate block w-full text-left hover:text-primary transition-colors">{post.title || "Untitled"}</button>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(post.created_at), "MMM dd, yyyy")}
                        {post.wordCount > 0 && (
                          <> · <span className={post.wordCount >= 2000 ? "text-green-600" : "text-muted-foreground"}>{post.wordCount.toLocaleString()} words</span></>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {post.seoScore > 0 && (
                        <span className={`text-xs font-bold tabular-nums ${
                          post.seoScore >= 85 ? "text-green-600" :
                          post.seoScore >= 70 ? "text-blue-600" :
                          post.seoScore >= 55 ? "text-yellow-600" : "text-orange-600"
                        }`}>
                          SEO {post.seoScore}
                        </span>
                      )}
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        post.status === "published" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        post.status === "scheduled" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        post.status === "review"    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                        "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                      }`}>
                        {post.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">No posts yet. Create your first post to see analytics.</p>
                <button onClick={() => navigate("/create-post")} className="mt-4 btn-primary inline-flex">
                  Create Post
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: FileText,  label: "Create New Post",  desc: "Generate AI-powered blog content",    path: "/create-post"  },
            { icon: TrendingUp,label: "SEO Analysis",     desc: "Analyze keywords and competitors",    path: "/seo-analysis" },
            { icon: Calendar,  label: "Content Plan",     desc: "Generate a 30-day content calendar",  path: "/content-plan" },
          ].map(({ icon: Icon, label, desc, path }) => (
            <Card
              key={path}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => navigate(path)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-5 w-5" /> {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        </>)}
      </div>
    </PageShell>
  );
};

export default Analytics;
