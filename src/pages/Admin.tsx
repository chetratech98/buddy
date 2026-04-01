import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, FileText, Calendar, BarChart, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/PageShell";

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

const Admin = () => {
  const { user } = useAuth();
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

  const fetchAdminData = async () => {
    try {
      setLoading(true);

      // Fetch profiles with subscription data
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;
      setProfiles(profilesData || []);

      // Fetch blog posts (without join for now to avoid type errors)
      const { data: postsData, error: postsError } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (postsError) throw postsError;
      setBlogPosts(postsData || []);

      // Fetch content plans
      const { data: plansData, error: plansError} = await supabase
        .from("content_plans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (plansError) throw plansError;
      setContentPlans(plansData || []);

      // Fetch SERP analyses
      const { data: serpData, error: serpError } = await supabase
        .from("serp_analyses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (serpError) throw serpError;
      setSerpAnalyses(serpData || []);

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
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-gray-400">Manage users, content, and system analytics</p>
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
          <TabsList className="grid w-full grid-cols-5 bg-gray-800/50">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="posts">Blog Posts</TabsTrigger>
            <TabsTrigger value="plans">Content Plans</TabsTrigger>
            <TabsTrigger value="seo">SEO Analysis</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
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
                        const author = profiles.find(p => p.user_id === post.user_id);
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
                          <TableCell>{profiles.find(p => p.user_id === plan.user_id)?.display_name || "Unknown"}</TableCell>
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
                          <TableCell>{profiles.find(p => p.user_id === analysis.user_id)?.display_name || "Unknown"}</TableCell>
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
        </Tabs>
      </div>
    </PageShell>
  );
};

export default Admin;
