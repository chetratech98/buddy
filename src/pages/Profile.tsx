import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Camera, Save, Loader2, Target, Eye, ExternalLink,
  Check, AlertCircle, Globe, LogOut, CreditCard, TrendingUp, CheckCircle2, Rocket,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/PageShell";
import { WordPressSettings } from "@/components/WordPressSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

// ─────────────────────────────────────────────────────────────────────────────
// Billing & Subscription (merged from the former standalone Billing page)
// ─────────────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  popular?: boolean;
}

// Kept in sync with the landing page pricing (src/components/Pricing.tsx)
const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    monthlyPrice: 1499,
    annualPrice: 14999,
    features: [
      "15 blog posts per month",
      "Monthly business intelligence update",
      "5 keywords",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    monthlyPrice: 2999,
    annualPrice: 29999,
    popular: true,
    features: [
      "1 AI blog post per day",
      "Weekly business intelligence update",
      "10 keywords",
      "SERP Analysis",
      "Detailed Dashboards",
    ],
  },
];

const discountPercent = (monthlyPrice: number, annualPrice: number) =>
  Math.round(((monthlyPrice * 12 - annualPrice) / (monthlyPrice * 12)) * 100);

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
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null);
  const [orgGoals,    setOrgGoals]    = useState("");
  const [orgVision,   setOrgVision]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [autoPublishEnabled, setAutoPublishEnabled] = useState(false);
  const [autoPublishSaving, setAutoPublishSaving] = useState(false);

  // Billing & subscription state
  const [billingLoading, setBillingLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("active");
  const [quotaInfo, setQuotaInfo] = useState({ used: 0, total: 30 });
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const sessionResult = searchParams.get("session");

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchSubscriptionInfo = async () => {
    if (!user) { setBillingLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_tier, subscription_status, posts_used_this_month, posts_quota_monthly")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      if (data) {
        setCurrentPlan(data.subscription_tier || "free");
        setSubscriptionStatus(data.subscription_status || "active");
        setQuotaInfo({
          used: data.posts_used_this_month || 0,
          total: data.posts_quota_monthly || 30,
        });
      }
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionInfo();
  }, [user]);

  // Handle return from Stripe checkout
  useEffect(() => {
    if (sessionResult === "success") {
      toast({
        title: "Payment successful!",
        description: "Your plan has been activated. It may take a few seconds to reflect.",
      });
      // Poll for up to 10 seconds for the webhook to update the plan
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await fetchSubscriptionInfo();
        if (attempts >= 5) clearInterval(poll);
      }, 2000);
      // Clean up URL param
      navigate("/profile", { replace: true });
    } else if (sessionResult === "cancelled") {
      toast({
        title: "Checkout cancelled",
        description: "No changes were made to your plan.",
      });
      navigate("/profile", { replace: true });
    }
  }, [sessionResult]);

  const handleUpgrade = async (planId: string) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to upgrade.", variant: "destructive" });
      return;
    }
    if (planId === currentPlan) {
      toast({ title: "Already subscribed", description: "You are already on this plan." });
      return;
    }

    setProcessingPlan(planId);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { planId, billingInterval },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("No checkout URL returned");

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (e) {
      toast({
        title: "Checkout failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      setProcessingPlan(null);
    }
  };

  const handleManageBilling = async () => {
    if (!user) return;
    setOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {});
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("No portal URL returned");
      window.location.href = data.url;
    } catch (e) {
      toast({
        title: "Could not open billing portal",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      setOpeningPortal(false);
    }
  };

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, org_goals, org_vision, auto_publish_enabled")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!error && data) {
      setDisplayName(data.display_name ?? "");
      setAvatarUrl(data.avatar_url ?? null);
      setOrgGoals(data.org_goals ?? "");
      setOrgVision(data.org_vision ?? "");
      setAutoPublishEnabled(Boolean(data.auto_publish_enabled));
    }
    setLoading(false);
  };

  const handleToggleAutoPublish = async (next: boolean) => {
    if (!user) return;
    setAutoPublishSaving(true);
    const previous = autoPublishEnabled;
    setAutoPublishEnabled(next); // optimistic
    const { error } = await supabase
      .from("profiles")
      .update({ auto_publish_enabled: next })
      .eq("user_id", user.id);

    if (error) {
      setAutoPublishEnabled(previous);
      toast({ title: "Couldn't update auto-publish", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: next ? "Auto-publish enabled" : "Auto-publish disabled",
        description: next
          ? "Daily AI-generated posts will publish automatically to your connected platforms."
          : "Daily AI-generated posts will land as drafts for you to review and publish.",
      });
    }
    setAutoPublishSaving(false);
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
      <PageShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
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

      <div className="mt-8 space-y-3">
        <button onClick={handleSave} disabled={saving} className="w-full btn-primary">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? "Saving…" : "Save Profile & Personalization"}
        </button>
        <button
          onClick={async () => { await signOut(); navigate("/"); }}
          className="w-full btn-outline flex items-center justify-center gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>

      {/* Billing & Subscription */}
      <div className="mt-10">
        <h2 className="text-2xl font-bold mb-2">Billing &amp; Subscription</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Manage your plan, usage, and payment method.
        </p>

        {billingLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <>
            {/* Current usage */}
            <Card className="mb-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="text-primary" />
                    Current Usage
                  </CardTitle>
                  {currentPlan !== "free" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManageBilling}
                      disabled={openingPortal}
                    >
                      {openingPortal ? (
                        <><Loader2 className="animate-spin mr-2" size={14} />Opening...</>
                      ) : (
                        <><CreditCard size={14} className="mr-2" />Manage Billing</>
                      )}
                    </Button>
                  )}
                </div>
                <CardDescription>
                  You are on the{" "}
                  <strong className="capitalize">{currentPlan}</strong> plan
                  {subscriptionStatus === "past_due" && (
                    <Badge variant="destructive" className="ml-2">Payment Failed</Badge>
                  )}
                  {subscriptionStatus === "canceled" && (
                    <Badge variant="outline" className="ml-2">Canceled</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {subscriptionStatus === "past_due" && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Your payment failed. Please update your payment method to keep access.{" "}
                      <button onClick={handleManageBilling} className="underline font-medium">Update payment method</button>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Posts this month</span>
                    <span className="font-medium">
                      {quotaInfo.used} / {quotaInfo.total}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        (quotaInfo.used / quotaInfo.total) * 100 >= 90 ? "bg-destructive" :
                        (quotaInfo.used / quotaInfo.total) * 100 >= 70 ? "bg-yellow-500" : "bg-primary"
                      }`}
                      style={{ width: `${Math.min((quotaInfo.used / quotaInfo.total) * 100, 100)}%` }}
                    />
                  </div>
                  {(quotaInfo.used / quotaInfo.total) * 100 >= 80 && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        You have used {((quotaInfo.used / quotaInfo.total) * 100).toFixed(0)}% of your monthly quota.
                        Upgrade to continue creating content.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Plan selection */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-muted rounded-full p-1">
                <button
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${billingInterval === "month" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setBillingInterval("month")}
                >
                  Monthly
                </button>
                <button
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${billingInterval === "year" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setBillingInterval("year")}
                >
                  Yearly <Badge variant="secondary" className="ml-1 text-xs">
                    Save up to {Math.max(...PLANS.map(p => discountPercent(p.monthlyPrice, p.annualPrice)))}%
                  </Badge>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {PLANS.map((plan) => {
                const isCurrentPlan = currentPlan === plan.id;
                const isProcessing = processingPlan === plan.id;
                const price = billingInterval === "year" ? plan.annualPrice : plan.monthlyPrice;
                const discount = discountPercent(plan.monthlyPrice, plan.annualPrice);

                return (
                  <Card
                    key={plan.id}
                    className={`relative ${plan.popular ? "border-primary shadow-lg scale-105" : ""} ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary">Most Popular</Badge>
                      </div>
                    )}
                    {isCurrentPlan && (
                      <div className="absolute -top-3 right-4">
                        <Badge variant="outline" className="bg-background flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-primary" /> Current Plan
                        </Badge>
                      </div>
                    )}

                    <CardHeader className="text-center pb-4">
                      <CardTitle className="text-2xl">{plan.name}</CardTitle>
                      <div className="mt-4">
                        <span className="text-4xl font-bold">₹{price.toLocaleString("en-IN")}</span>
                        <span className="text-muted-foreground">/{billingInterval === "year" ? "yr" : "mo"}</span>
                        {billingInterval === "year" && (
                          <p className="text-xs font-semibold mt-1" style={{ color: "hsl(142 71% 35%)" }}>
                            Save {discount}% vs monthly
                          </p>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      <ul className="space-y-3">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <Check size={18} className="flex-shrink-0 mt-0.5 text-primary" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        className="w-full"
                        variant={plan.popular ? "default" : "outline"}
                        disabled={isCurrentPlan || isProcessing || !user}
                        onClick={() => handleUpgrade(plan.id)}
                      >
                        {isProcessing ? (
                          <><Loader2 className="animate-spin mr-2" size={16} />Redirecting to checkout...</>
                        ) : isCurrentPlan ? (
                          "Current Plan"
                        ) : !user ? (
                          "Sign In to Subscribe"
                        ) : (
                          `Upgrade to ${plan.name}`
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Stripe security note */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="text-primary" />
                  Secure Payments
                </CardTitle>
                <CardDescription>Powered by Stripe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertDescription>
                    All payments are processed securely through{" "}
                    <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="font-medium underline inline-flex items-center gap-1">
                      Stripe <ExternalLink size={12} />
                    </a>
                    . Your card details never touch our servers. Subscriptions can be cancelled anytime from the billing portal.
                  </AlertDescription>
                </Alert>
                {currentPlan !== "free" && (
                  <Button variant="outline" onClick={handleManageBilling} disabled={openingPortal} className="w-full sm:w-auto">
                    {openingPortal ? <Loader2 className="animate-spin mr-2" size={16} /> : <ExternalLink size={14} className="mr-2" />}
                    View Invoices & Manage Subscription
                  </Button>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Platform integrations */}
      <div className="mt-10">
        <h2 className="text-2xl font-bold mb-2">Publishing Integrations</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Connect your publishing platforms to auto-publish scheduled posts.
        </p>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Rocket size={18} /> Auto-Publish Daily Posts
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    {autoPublishEnabled
                      ? "Each day's AI-generated post publishes automatically to your connected platforms below."
                      : "Each day's AI-generated post lands as a draft in Posts for you to review and publish yourself."}
                  </CardDescription>
                </div>
                <Switch
                  checked={autoPublishEnabled}
                  onCheckedChange={handleToggleAutoPublish}
                  disabled={autoPublishSaving}
                  aria-label="Toggle auto-publish"
                />
              </div>
            </CardHeader>
          </Card>
          <WordPressSettings />
          {user && <MediumSettings userId={user.id} />}
        </div>
      </div>
    </PageShell>
  );
};

export default Profile;
