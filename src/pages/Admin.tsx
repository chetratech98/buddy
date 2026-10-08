import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, FileText, Calendar, BarChart, DollarSign, ShieldCheck, Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/PageShell";
import { AiSpendCard } from "@/components/admin/AiSpendCard";
import { ADMIN_ROLES, ROLE_LABELS, can, type AdminRole } from "@/lib/rbac";
import { logAdminAction } from "@/lib/audit";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  created_at: string;
  subscription_tier: string;
  subscription_status: string;
  posts_quota_monthly: number;
  posts_used_this_month: number;
  onboarding_completed: boolean;
  wp_url: string;
}

interface BlogPost {
  id: string;
  title: string;
  status: string;
  created_at: string;
  user_id: string;
  profiles: { display_name: string } | null;
}

interface ContentPlan {
  id: string;
  niche: string;
  keywords: string[];
  created_at: string;
  user_id: string;
  profiles: { display_name: string } | null;
}

interface SerpAnalysis {
  id: string;
  niche: string;
  keywords: string[];
  created_at: string;
  user_id: string;
  profiles: { display_name: string } | null;
}

interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  created_at: string;
  current_period_end: string | null;
  profiles: { display_name: string } | null;
}

interface AuditLog {
  id: string;
  actor_user_id: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: any;
  created_at: string;
}

interface DailyBlogRun {
  id: string;
  success: boolean;
  usersWithPlans: number;
  generated: number;
  skippedAlreadyPosted: number;
  skippedNotPublishDay: number;
  skippedNoItemForDay: number;
  skippedQuota: number;
  failed: number;
  heldDuplicate: number;
  created_at: string;
}

interface RankTrackerRun {
  id: string;
  user_id: string;
  posts_checked: number;
  keywords_checked: number;
  created_at: string;
}

const Admin = () => {
  const { user, profile: myProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPosts: 0,
    totalContentPlans: 0,
    totalSerpAnalyses: 0,
    activeSubscriptions: 0,
  });

  const [profiles, setProfiles] = useState<any[]>([]);
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [contentPlans, setContentPlans] = useState<any[]>([]);
  const [serpAnalyses, setSerpAnalyses] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dailyBlogRuns, setDailyBlogRuns] = useState<DailyBlogRun[]>([]);
  const [rankTrackerRuns, setRankTrackerRuns] = useState<RankTrackerRun[]>([]);
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null);

  const fetchAdminData = async () => {
    try {
      setLoading(true);

      // All 5 queries are independent — run them concurrently instead of
      // paying for 5 sequential round-trips.
      const [
        { data: profilesData, error: profilesError },
        { data: postsData, error: postsError },
        { data: plansData, error: plansError },
        { data: serpData, error: serpError },
        { data: auditData, error: auditError },
        { data: dailyBlogRunsData, error: dailyBlogRunsError },
        { data: rankTrackerRunsData, error: rankTrackerRunsError },
      ] = await Promise.all([
        // Profiles with subscription data — column-scoped to what the admin table actually renders
        supabase
          .from("profiles")
          .select("id, user_id, display_name, role, subscription_tier, subscription_status, posts_used_this_month, posts_quota_monthly, wp_url, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        // Blog posts (without join for now to avoid type errors)
        supabase
          .from("blog_posts")
          .select("id, title, status, created_at, user_id")
          .order("created_at", { ascending: false })
          .limit(100),
        // Content plans
        supabase
          .from("content_plans")
          .select("id, niche, keywords, created_at, user_id")
          .order("created_at", { ascending: false })
          .limit(100),
        // SERP analyses
        supabase
          .from("serp_analyses")
          .select("id, niche, keywords, created_at, user_id")
          .order("created_at", { ascending: false })
          .limit(100),
        // Recent audit log entries (RLS: any internal-staff role can read)
        supabase
          .from("audit_logs")
          .select("id, actor_user_id, actor_role, action, entity_type, entity_id, metadata, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
        // Automation health — daily-blog-generator cron run log
        supabase
          .from("daily_blog_generator_runs")
          .select("id, success, usersWithPlans, generated, skippedAlreadyPosted, skippedNotPublishDay, skippedNoItemForDay, skippedQuota, failed, heldDuplicate, created_at")
          .order("created_at", { ascending: false })
          .limit(30),
        // Automation health — rank-tracker cron run log (one row per user per tick)
        supabase
          .from("rank_tracker_runs")
          .select("id, user_id, posts_checked, keywords_checked, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (profilesError) throw profilesError;
      setProfiles(profilesData || []);

      if (postsError) throw postsError;
      setBlogPosts(postsData || []);

      if (plansError) throw plansError;
      setContentPlans(plansData || []);

      if (serpError) throw serpError;
      setSerpAnalyses(serpData || []);

      if (auditError) console.error("Error fetching audit logs:", auditError);
      setAuditLogs(auditData || []);

      if (dailyBlogRunsError) console.error("Error fetching daily blog generator runs:", dailyBlogRunsError);
      setDailyBlogRuns((dailyBlogRunsData as DailyBlogRun[]) || []);

      if (rankTrackerRunsError) console.error("Error fetching rank tracker runs:", rankTrackerRunsError);
      setRankTrackerRuns(rankTrackerRunsData || []);

      // Note: Subscriptions will be available after migration is applied
      // For now, extract subscription info from profiles table
      const activeProfiles = profilesData?.filter((p: any) => 
        p.subscription_status === 'active' && p.subscription_tier !== 'free'
      ) || [];

      // Calculate stats
      setStats({
        totalUsers: profilesData?.length || 0,
        totalPosts: postsData?.length || 0,
        totalContentPlans: plansData?.length || 0,
        totalSerpAnalyses: serpData?.length || 0,
        activeSubscriptions: activeProfiles.length,
      });

    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast({
        title: "Error loading admin data",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canManageRoles = can(myProfile?.role, "manage_roles");

  const changeRole = async (targetProfile: { id: string; user_id: string; display_name: string; role?: string }, newRole: string) => {
    if (!user || !canManageRoles) return;
    const previousRole = targetProfile.role || "user";
    if (newRole === previousRole) return;

    setChangingRoleFor(targetProfile.id);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", targetProfile.id);
      if (error) throw error;

      setProfiles((prev) => prev.map((p) => (p.id === targetProfile.id ? { ...p, role: newRole } : p)));

      await logAdminAction({
        actorUserId: user.id,
        actorRole: myProfile?.role || "unknown",
        action: "role_changed",
        entityType: "profile",
        entityId: targetProfile.user_id,
        metadata: { display_name: targetProfile.display_name, from: previousRole, to: newRole },
      });

      toast({ title: "Role updated", description: `${targetProfile.display_name || "User"} is now ${newRole}.` });
    } catch (error) {
      toast({
        title: "Failed to update role",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setChangingRoleFor(null);
    }
  };

  // O(1) author lookups instead of profiles.find(...) per row
  const profilesByUserId = useMemo(
    () => new Map(profiles.map((p) => [p.user_id, p])),
    [profiles]
  );

  // ── Automation health signals ────────────────────────────────────────────
  // daily-blog-generator processes at most one user per tick by design, so
  // "generated: 0" on any single run is completely normal once everyone due
  // today has already been handled — that is NOT a failure signal on its
  // own. What actually indicates trouble: the cron hasn't fired recently at
  // all (the literal "cron jobs got disabled" incident this ever caught
  // once already), or a full day's worth of ticks produced zero posts
  // despite users actually having active plans.
  const automationHealth = useMemo(() => {
    const now = Date.now();
    const HOUR = 60 * 60 * 1000;

    const latestRun = dailyBlogRuns[0] ?? null;
    const hoursSinceLastRun = latestRun ? (now - new Date(latestRun.created_at).getTime()) / HOUR : null;
    const dailyBlogStale = hoursSinceLastRun === null || hoursSinceLastRun > 26;

    const runsLast26h = dailyBlogRuns.filter((r) => (now - new Date(r.created_at).getTime()) / HOUR <= 26);
    const generatedLast26h = runsLast26h.reduce((sum, r) => sum + (r.generated || 0), 0);
    const failedLast26h = runsLast26h.reduce((sum, r) => sum + (r.failed || 0), 0);
    const heldDuplicateLast26h = runsLast26h.reduce((sum, r) => sum + (r.heldDuplicate || 0), 0);
    const dailyBlogIneffective = !dailyBlogStale && (latestRun?.usersWithPlans ?? 0) > 0 && generatedLast26h === 0;

    const latestRankRun = rankTrackerRuns[0] ?? null;
    const hoursSinceLastRankRun = latestRankRun ? (now - new Date(latestRankRun.created_at).getTime()) / HOUR : null;
    const rankTrackerStale = hoursSinceLastRankRun === null || hoursSinceLastRankRun > 50;

    return {
      latestRun, hoursSinceLastRun, dailyBlogStale, dailyBlogIneffective,
      generatedLast26h, failedLast26h, heldDuplicateLast26h,
      latestRankRun, hoursSinceLastRankRun, rankTrackerStale,
    };
  }, [dailyBlogRuns, rankTrackerRuns]);

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-gray-400">Manage users, content, and system analytics</p>
          </div>
          {myProfile?.role && (
            <Badge variant="outline" className="flex items-center gap-1.5 text-sm py-1.5 px-3 border-purple-500/40 text-purple-300">
              <ShieldCheck size={14} />
              Signed in as {ROLE_LABELS[myProfile.role as AdminRole] || myProfile.role}
            </Badge>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-400">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 border-blue-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                Blog Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-400">{stats.totalPosts}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-green-400" />
                Content Plans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">{stats.totalContentPlans}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 border-yellow-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart className="h-4 w-4 text-yellow-400" />
                SEO Analyses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-400">{stats.totalSerpAnalyses}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-pink-900/20 to-pink-800/20 border-pink-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-pink-400" />
                Active Subs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-pink-400">{stats.activeSubscriptions}</div>
            </CardContent>
          </Card>
        </div>

        {/* Data Tables */}
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-7 bg-gray-800/50">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="posts">Blog Posts</TabsTrigger>
            <TabsTrigger value="plans">Content Plans</TabsTrigger>
            <TabsTrigger value="seo">SEO Analysis</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="automation" className="relative">
              Automation
              {(automationHealth.dailyBlogStale || automationHealth.dailyBlogIneffective || automationHealth.rankTrackerStale) && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="bg-gray-900/50 border-gray-700">
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>Manage user accounts and subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Display Name</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Subscription</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Posts Used</TableHead>
                        <TableHead>Quota</TableHead>
                        <TableHead>WordPress</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell className="font-medium">{profile.display_name || "N/A"}</TableCell>
                          <TableCell className="font-mono text-xs">{profile.user_id.slice(0, 8)}...</TableCell>
                          <TableCell>
                            {canManageRoles ? (
                              <Select
                                value={profile.role || "user"}
                                disabled={changingRoleFor === profile.id}
                                onValueChange={(newRole) => changeRole(profile, newRole)}
                              >
                                <SelectTrigger className="h-8 w-[130px] text-xs bg-gray-800/50 border-gray-700">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  {ADMIN_ROLES.map((r) => (
                                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                {profile.role && profile.role !== "user" ? (ROLE_LABELS as any)[profile.role] || profile.role : "User"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={profile.subscription_tier === 'free' ? 'secondary' : 'default'}>
                              {profile.subscription_tier || 'free'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={profile.subscription_status === 'active' ? 'default' : 'destructive'}>
                              {profile.subscription_status || 'active'}
                            </Badge>
                          </TableCell>
                          <TableCell>{profile.posts_used_this_month || 0}</TableCell>
                          <TableCell>{profile.posts_quota_monthly || 5}</TableCell>
                          <TableCell>
                            {profile.wp_url ? (
                              <Badge variant="outline" className="text-green-400 border-green-400">Connected</Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-400 border-gray-400">Not Set</Badge>
                            )}
                          </TableCell>
                          <TableCell>{new Date(profile.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Blog Posts Tab */}
          <TabsContent value="posts">
            <Card className="bg-gray-900/50 border-gray-700">
              <CardHeader>
                <CardTitle>All Blog Posts</CardTitle>
                <CardDescription>View all user-generated blog posts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Post ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blogPosts.map((post) => {
                        const author = profilesByUserId.get(post.user_id);
                        return (
                          <TableRow key={post.id}>
                            <TableCell className="font-medium max-w-xs truncate">{post.title}</TableCell>
                            <TableCell>{author?.display_name || "Unknown"}</TableCell>
                            <TableCell>
                              <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                                {post.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(post.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="font-mono text-xs">{post.id.slice(0, 8)}...</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Plans Tab */}
          <TabsContent value="plans">
            <Card className="bg-gray-900/50 border-gray-700">
              <CardHeader>
                <CardTitle>Content Plans</CardTitle>
                <CardDescription>View all content planning requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Query</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Plan ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contentPlans.map((plan) => (
                        <TableRow key={plan.id}>
                          <TableCell className="font-medium max-w-md truncate">
                            {plan.niche} {plan.keywords?.length > 0 && `(${plan.keywords.slice(0, 3).join(', ')})`}
                          </TableCell>
                          <TableCell>{profilesByUserId.get(plan.user_id)?.display_name || "Unknown"}</TableCell>
                          <TableCell>{new Date(plan.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="font-mono text-xs">{plan.id.slice(0, 8)}...</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SEO Analysis Tab */}
          <TabsContent value="seo">
            <Card className="bg-gray-900/50 border-gray-700">
              <CardHeader>
                <CardTitle>SEO Analyses</CardTitle>
                <CardDescription>View all SERP analysis requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Keyword/Query</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Analysis ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serpAnalyses.map((analysis) => (
                        <TableRow key={analysis.id}>
                          <TableCell className="font-medium max-w-md truncate">
                            {analysis.niche} {analysis.keywords?.length > 0 && `(${analysis.keywords.slice(0, 3).join(', ')})`}
                          </TableCell>
                          <TableCell>{profilesByUserId.get(analysis.user_id)?.display_name || "Unknown"}</TableCell>
                          <TableCell>{new Date(analysis.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="font-mono text-xs">{analysis.id.slice(0, 8)}...</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions">
            <Card className="bg-gray-900/50 border-gray-700">
              <CardHeader>
                <CardTitle>Subscriptions</CardTitle>
                <CardDescription>View all active and inactive subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Period End</TableHead>
                        <TableHead>Subscription ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium">{sub.profiles?.display_name || "Unknown"}</TableCell>
                          <TableCell>
                            <Badge variant={sub.plan === 'free' ? 'secondary' : 'default'}>
                              {sub.plan}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={sub.status === 'active' ? 'default' : 'destructive'}>
                              {sub.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(sub.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "N/A"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{sub.id.slice(0, 8)}...</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Automation Health Tab */}
          <TabsContent value="automation" className="space-y-4">
            <AiSpendCard />
            {/* Health banners */}
            {automationHealth.dailyBlogStale && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>daily-blog-generator hasn't run in {automationHealth.hoursSinceLastRun === null ? "any recorded time" : `${Math.round(automationHealth.hoursSinceLastRun)} hours`}.</strong>{" "}
                  The cron job may be disabled or failing before it can log a run. Check pg_cron and the function logs.
                </AlertDescription>
              </Alert>
            )}
            {automationHealth.dailyBlogIneffective && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>The cron is running but generated 0 posts in the last 26 hours</strong>, despite {automationHealth.latestRun?.usersWithPlans} user(s) having an active content plan. Check for a systematic generate-blog failure or widespread quota exhaustion.
                </AlertDescription>
              </Alert>
            )}
            {automationHealth.rankTrackerStale && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>rank-tracker hasn't logged a run in {automationHealth.hoursSinceLastRankRun === null ? "any recorded time" : `${Math.round(automationHealth.hoursSinceLastRankRun)} hours`}.</strong>{" "}
                  Expected to run daily — check pg_cron and SERP_API_KEY.
                </AlertDescription>
              </Alert>
            )}
            {!automationHealth.dailyBlogStale && !automationHealth.dailyBlogIneffective && !automationHealth.rankTrackerStale && (
              <Alert className="border-green-500/30 bg-green-500/5">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-400">
                  Both automations are reporting recent, active runs.
                </AlertDescription>
              </Alert>
            )}

            <Card className="bg-gray-900/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-400" />
                  Daily Blog Generator
                </CardTitle>
                <CardDescription>
                  Last {automationHealth.generatedLast26h} post(s) generated, {automationHealth.failedLast26h} failure(s), {automationHealth.heldDuplicateLast26h} held for duplicate review — trailing 26h
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Run Time</TableHead>
                        <TableHead>Users w/ Plans</TableHead>
                        <TableHead>Generated</TableHead>
                        <TableHead>Already Posted</TableHead>
                        <TableHead>Not Publish Day</TableHead>
                        <TableHead>No Item</TableHead>
                        <TableHead>Quota Hit</TableHead>
                        <TableHead>Held (Dup)</TableHead>
                        <TableHead>Failed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyBlogRuns.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-gray-400 py-8">
                            No runs recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        dailyBlogRuns.map((run) => (
                          <TableRow key={run.id}>
                            <TableCell className="text-xs whitespace-nowrap">{new Date(run.created_at).toLocaleString()}</TableCell>
                            <TableCell>{run.usersWithPlans}</TableCell>
                            <TableCell>
                              <Badge variant={run.generated > 0 ? "default" : "secondary"}>{run.generated}</Badge>
                            </TableCell>
                            <TableCell className="text-gray-400">{run.skippedAlreadyPosted}</TableCell>
                            <TableCell className="text-gray-400">{run.skippedNotPublishDay ?? 0}</TableCell>
                            <TableCell className="text-gray-400">{run.skippedNoItemForDay}</TableCell>
                            <TableCell className="text-gray-400">{run.skippedQuota}</TableCell>
                            <TableCell className="text-gray-400">{run.heldDuplicate ?? 0}</TableCell>
                            <TableCell>
                              {run.failed > 0 ? <Badge variant="destructive">{run.failed}</Badge> : <span className="text-gray-400">0</span>}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-400" />
                  Rank Tracker
                </CardTitle>
                <CardDescription>
                  {automationHealth.latestRankRun
                    ? `Last check: ${new Date(automationHealth.latestRankRun.created_at).toLocaleString()}`
                    : "No runs recorded yet."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Run Time</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Posts Checked</TableHead>
                        <TableHead>Keywords Checked</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankTrackerRuns.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                            No runs recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rankTrackerRuns.slice(0, 20).map((run) => (
                          <TableRow key={run.id}>
                            <TableCell className="text-xs whitespace-nowrap">{new Date(run.created_at).toLocaleString()}</TableCell>
                            <TableCell>{profilesByUserId.get(run.user_id)?.display_name || run.user_id.slice(0, 8) + "..."}</TableCell>
                            <TableCell>{run.posts_checked}</TableCell>
                            <TableCell>{run.keywords_checked}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit">
            <Card className="bg-gray-900/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-purple-400" />
                  Audit Logs
                </CardTitle>
                <CardDescription>Every sensitive admin-portal action — who did what, when, on which entity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                            No admin actions logged yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-medium">
                              {profilesByUserId.get(log.actor_user_id)?.display_name || log.actor_user_id.slice(0, 8) + "..."}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {(ROLE_LABELS as any)[log.actor_role] || log.actor_role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{log.action}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {log.entity_type}
                              {log.entity_id && <span className="text-gray-500"> · {log.entity_id.slice(0, 8)}...</span>}
                            </TableCell>
                            <TableCell className="font-mono text-xs max-w-xs truncate text-gray-400">
                              {Object.keys(log.metadata || {}).length > 0 ? JSON.stringify(log.metadata) : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
};

export default Admin;
