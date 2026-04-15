import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Camera, Save, Loader2, Target, Eye, ExternalLink,
  Check, AlertCircle, Globe,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/PageShell";
import { WordPressSettings } from "@/components/WordPressSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// Medium Integration Panel
// ─────────────────────────────────────────────────────────────────────────────

function MediumSettings({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [token,    setToken]    = useState("");
  const [authorId, setAuthorId] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("medium_integration_token, medium_author_id")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setToken(data.medium_integration_token ?? "");
          setAuthorId(data.medium_author_id ?? "");
        }
        setLoading(false);
      });
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ medium_integration_token: token.trim(), medium_author_id: authorId.trim() })
      .eq("user_id", userId);

    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Medium settings saved" });
      setTestResult(null);
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!token) {
      toast({ title: "Missing token", description: "Enter your integration token first.", variant: "destructive" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("https://api.medium.com/v1/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const id = data?.data?.id ?? "";
        if (id && !authorId) setAuthorId(id);
        setTestResult({ success: true, message: `Connected as ${data?.data?.name ?? "unknown"} (ID: ${id})` });
        toast({ title: "Medium connected!" });
      } else {
        setTestResult({ success: false, message: `Auth failed: HTTP ${res.status}` });
        toast({ title: "Connection failed", variant: "destructive" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setTestResult({ success: false, message: msg });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return (
    <Card>
      <CardContent className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin" />
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe size={18} /> Medium Integration
        </CardTitle>
        <CardDescription>
          Connect your Medium account to publish posts directly from Buddy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>How to get a Medium Integration Token:</strong>
            <ol className="mt-2 ml-4 list-decimal space-y-1 text-sm">
              <li>Go to Medium → Settings → Security and apps</li>
              <li>Scroll to "Integration tokens" and generate a new token</li>
              <li>Paste it below and click "Test Connection" — your Author ID will be filled automatically</li>
            </ol>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label htmlFor="medium_token">Integration Token</Label>
            <Input
              id="medium_token"
              type="password"
              placeholder="Paste your Medium integration token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="medium_author_id">Author ID</Label>
            <Input
              id="medium_author_id"
              type="text"
              placeholder="Auto-filled when you test connection"
              value={authorId}
              onChange={(e) => setAuthorId(e.target.value)}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your Medium user ID — filled automatically when you test the connection.
            </p>
          </div>
        </div>

        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            {testResult.success ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>{testResult.message}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing || !token}>
            {testing ? <><Loader2 size={14} className="animate-spin mr-2" />Testing…</> : "Test Connection"}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? <><Loader2 size={14} className="animate-spin mr-2" />Saving…</> : "Save Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null);
  const [orgGoals,    setOrgGoals]    = useState("");
  const [orgVision,   setOrgVision]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, org_goals, org_vision")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!error && data) {
      setDisplayName(data.display_name ?? "");
      setAvatarUrl(data.avatar_url ?? null);
      setOrgGoals(data.org_goals ?? "");
      setOrgVision(data.org_vision ?? "");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, org_goals: orgGoals, org_vision: orgVision })
      .eq("user_id", user!.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated", description: "Your profile and personalization settings have been saved." });
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: newUrl })
      .eq("user_id", user.id);

    if (updateError) {
      toast({ title: "Error", description: updateError.message, variant: "destructive" });
    } else {
      setAvatarUrl(newUrl);
      toast({ title: "Avatar updated" });
    }
    setUploading(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <PageShell showSignOut>
      <h1 className="text-3xl font-bold mb-8">Your Profile</h1>

      {/* Basic info */}
      <div className="card-elevated p-8 space-y-8">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-primary/8 flex items-center justify-center overflow-hidden border-2 border-border">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-primary">
                  {displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"}
                </span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:brightness-110 transition-all"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </div>
          <p className="text-xs text-muted-foreground">Click the camera icon to change your avatar</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <div className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl text-muted-foreground text-sm">
            {user?.email}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your display name"
            className="input-base"
          />
        </div>
      </div>

      {/* Personalization */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Target size={22} className="text-primary" /> Personalization
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Define your organization's goals and vision. These shape your AI-generated content.
        </p>
        <div className="card-elevated p-8 space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Target size={16} className="text-primary" /> Organization Goals
            </label>
            <textarea
              value={orgGoals}
              onChange={(e) => setOrgGoals(e.target.value)}
              placeholder="e.g., Become the leading fire safety provider in South India, increase online leads by 50%..."
              rows={4}
              className="input-base resize-none"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Eye size={16} className="text-primary" /> Organization Vision
            </label>
            <textarea
              value={orgVision}
              onChange={(e) => setOrgVision(e.target.value)}
              placeholder="e.g., To create a safer world through accessible, high-quality fire protection services..."
              rows={4}
              className="input-base resize-none"
            />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <button onClick={handleSave} disabled={saving} className="w-full btn-primary">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? "Saving…" : "Save Profile & Personalization"}
        </button>
      </div>

      {/* Platform integrations */}
      <div className="mt-10">
        <h2 className="text-2xl font-bold mb-2">Publishing Integrations</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Connect your publishing platforms to auto-publish scheduled posts.
        </p>
        <div className="space-y-4">
          <WordPressSettings />
          {user && <MediumSettings userId={user.id} />}
        </div>
      </div>
    </PageShell>
  );
};

export default Profile;
