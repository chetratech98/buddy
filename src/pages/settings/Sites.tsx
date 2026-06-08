import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2, Plus, Globe, Trash2, Star, Lock, AlertCircle,
  Check, ExternalLink, Eye, EyeOff,
} from "lucide-react";

interface Site {
  id: string;
  name: string;
  wp_url: string;
  wp_username: string;
  is_default: boolean;
}

const Sites = () => {
  const { user, currentOrg } = useAuth();
  const { toast } = useToast();

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState("");
  const [wpUrl, setWpUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpPassword, setWpPassword] = useState("");

  const canManage = !currentOrg || currentOrg.userRole === "owner" || currentOrg.userRole === "admin";

  const fetchSites = async () => {
    setLoading(true);
    let query = supabase.from("wordpress_sites").select("id, name, wp_url, wp_username, is_default");
    if (currentOrg) {
      query = query.eq("org_id", currentOrg.id);
    } else {
      query = query.eq("user_id", user!.id).is("org_id", null);
    }
    const { data, error } = await query.order("is_default", { ascending: false });
    if (!error && data) setSites(data as Site[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchSites();
  }, [user, currentOrg]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wpUrl.match(/^https?:\/\/.+/)) {
      toast({ title: "Invalid URL", description: "URL must start with http:// or https://", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("save-site-credentials", {
        body: {
          orgId: currentOrg?.id ?? null,
          name: name.trim(),
          wpUrl: wpUrl.trim(),
          wpUsername: wpUsername.trim(),
          wpAppPassword: wpPassword.trim(),
          isDefault: sites.length === 0, // first site is default
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Site added!", description: `${name} connected successfully.` });
      setShowForm(false);
      setName(""); setWpUrl(""); setWpUsername(""); setWpPassword("");
      setTestResult(null);
      await fetchSites();
    } catch (e) {
      toast({ title: "Failed to save", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!wpUrl || !wpUsername || !wpPassword) {
      toast({ title: "Fill in all fields before testing", variant: "destructive" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await supabase.functions.invoke("test-wordpress-connection", {
        body: { wpUrl: wpUrl.trim(), wpUsername: wpUsername.trim(), wpAppPassword: wpPassword.trim() },
      });
      setTestResult({ success: data?.success ?? false, message: data?.message ?? "Unknown" });
    } catch (e) {
      setTestResult({ success: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async (siteId: string) => {
    if (!confirm("Remove this WordPress site?")) return;
    setDeletingId(siteId);
    const { error } = await supabase.from("wordpress_sites").delete().eq("id", siteId);
    if (error) {
      toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
    } else {
      setSites(prev => prev.filter(s => s.id !== siteId));
      toast({ title: "Site removed" });
    }
    setDeletingId(null);
  };

  const handleSetDefault = async (siteId: string) => {
    // Clear existing default, set new one
    const updates = sites.map(s =>
      supabase.from("wordpress_sites").update({ is_default: s.id === siteId }).eq("id", s.id)
    );
    await Promise.all(updates);
    setSites(prev => prev.map(s => ({ ...s, is_default: s.id === siteId })));
    toast({ title: "Default site updated" });
  };

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">WordPress Sites</h1>
            <p className="text-muted-foreground mt-1">
              {currentOrg ? currentOrg.name : "Your personal sites"}
            </p>
          </div>
          {canManage && !showForm && (
            <Button onClick={() => setShowForm(true)}>
              <Plus size={16} className="mr-2" /> Add Site
            </Button>
          )}
        </div>

        {/* Add site form */}
        {showForm && canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Add WordPress Site</CardTitle>
              <CardDescription>Credentials are encrypted before storage.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <Label>Site Name</Label>
                  <Input className="mt-1.5" placeholder="e.g. Client Blog" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div>
                  <Label>WordPress URL</Label>
                  <Input className="mt-1.5" type="url" placeholder="https://yoursite.com" value={wpUrl} onChange={e => setWpUrl(e.target.value)} required />
                </div>
                <div>
                  <Label>Username</Label>
                  <Input className="mt-1.5" placeholder="admin" value={wpUsername} onChange={e => setWpUsername(e.target.value)} required />
                </div>
                <div>
                  <Label>Application Password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                      value={wpPassword}
                      onChange={e => setWpPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Lock size={10} /> Stored AES-256 encrypted
                  </p>
                </div>

                {testResult && (
                  <Alert variant={testResult.success ? "default" : "destructive"}>
                    {testResult.success ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <AlertDescription>{testResult.message}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
                    {testing ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                    Test Connection
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                    Save Site
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setTestResult(null); }}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Sites list */}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : sites.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Globe size={40} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No WordPress sites connected yet.</p>
              {canManage && (
                <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>
                  <Plus size={16} className="mr-2" /> Add Your First Site
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sites.map(site => (
              <Card key={site.id}>
                <CardContent className="flex items-center justify-between p-4 gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{site.name}</p>
                      {site.is_default && <Badge variant="secondary" className="shrink-0 text-xs">Default</Badge>}
                    </div>
                    <a
                      href={site.wp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                    >
                      {site.wp_url} <ExternalLink size={10} />
                    </a>
                    <p className="text-xs text-muted-foreground">{site.wp_username}</p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0">
                      {!site.is_default && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Set as default"
                          onClick={() => handleSetDefault(site.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Star size={14} />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                        onClick={() => handleDelete(site.id)}
                        disabled={deletingId === site.id}
                      >
                        {deletingId === site.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default Sites;
