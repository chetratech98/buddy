import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Globe, Sparkles, Loader2, Tag, TrendingUp, Target, Layers, AlertTriangle, Search, ArrowRight, Pencil, Check, X, Plus, Users, Radar, Flame, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { PageShell } from "@/components/PageShell";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";


interface EnrichedKeyword {
  term: string;
  intent: string;
  difficulty: string;
  priority: string;
  cluster: string;
}

interface EnrichedLongTail {
  term: string;
  intent: string;
  difficulty: string;
  searchContext: string;
}

interface TopicCluster {
  pillar: string;
  supporting: string[];
}

interface IdealCustomerProfile {
  name: string;
  role: string;
  companySize?: string;
  description: string;
  painPoints: string[];
  goals: string[];
  buyingTriggers: string[];
  preferredChannels: string[];
}

interface AnalysisResult {
  niche: string;
  subNiches?: string[];
  description: string;
  keywords: EnrichedKeyword[] | string[];
  longTailKeywords: EnrichedLongTail[] | string[];
  topicClusters?: TopicCluster[];
  competitorKeywordGaps?: string[];
  idealCustomerProfiles?: IdealCustomerProfile[];
  flatKeywords?: string[];
  flatLongTail?: string[];
  // Business onboarding fields, auto-extracted from the site
  primaryICP?: string;
  offers?: string[];
  regions?: string[];
  topServices?: string[];
  mainCta?: string;
  trustAssets?: string[];
}

interface BusinessProfile {
  icp: string;
  offers: string[];
  regions: string[];
  topServices: string[];
  mainCta: string;
  trustAssets: string[];
}

const emptyBusinessProfile: BusinessProfile = {
  icp: "",
  offers: [],
  regions: [],
  topServices: [],
  mainCta: "",
  trustAssets: [],
};

const intentColors: Record<string, string> = {
  informational: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  navigational: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  commercial: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  transactional: "bg-chart-4/15 text-chart-4 border-chart-4/30",
};

const difficultyConfig: Record<string, { color: string; value: number }> = {
  low: { color: "text-green-500", value: 30 },
  medium: { color: "text-yellow-500", value: 60 },
  high: { color: "text-red-500", value: 90 },
};

const priorityColors: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  low: "bg-muted text-muted-foreground border-border",
};

interface TagListFieldProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

const TagListField = ({ label, values, onChange, placeholder }: TagListFieldProps) => {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) {
      onChange([...values, v]);
      setDraft("");
    }
  };

  const remove = (idx: number) => onChange(values.filter((_, i) => i !== idx));

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map((v, i) => (
            <Badge key={i} variant="secondary" className="text-xs flex items-center gap-1">
              {v}
              <button onClick={() => remove(i)} className="hover:text-destructive">
                <X size={10} />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="text-sm flex-1"
        />
        <button onClick={add} className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1">
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
};

const ReadOnlyTagRow = ({ label, values }: { label: string; values: string[] }) => (
  <div>
    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
    {values.length > 0 ? (
      <div className="flex flex-wrap gap-2 mt-1.5">
        {values.map((v, i) => (
          <Badge key={i} variant="outline" className="text-xs">{v}</Badge>
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground mt-1">Not set</p>
    )}
  </div>
);

const GetStarted = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  // Inline editing state for niche & keywords
  const [editingNiche, setEditingNiche] = useState(false);
  const [editNiche, setEditNiche] = useState("");
  const [editKeywords, setEditKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [savingNiche, setSavingNiche] = useState(false);

  // Onboarding: business profile (ICP, offers, regions, top services, main CTA, trust assets)
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(emptyBusinessProfile);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editProfile, setEditProfile] = useState<BusinessProfile>(emptyBusinessProfile);
  const [savingProfile, setSavingProfile] = useState(false);

  const startNicheEdit = () => {
    setEditNiche(result?.niche || "");
    const kws = result?.keywords || [];
    const flat = kws.map((k: any) => (typeof k === "string" ? k : k.term));
    setEditKeywords(flat);
    setNewKeyword("");
    setEditingNiche(true);
  };

  const cancelNicheEdit = () => setEditingNiche(false);

  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (kw && !editKeywords.includes(kw)) {
      setEditKeywords([...editKeywords, kw]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (idx: number) => {
    setEditKeywords(editKeywords.filter((_, i) => i !== idx));
  };

  const saveNicheEdit = useCallback(async () => {
    if (!user) return;
    
    setSavingNiche(true);
    const updatedResult = { ...result, niche: editNiche, keywords: editKeywords };
    
    const { error } = await supabase
      .from("profiles")
      .update({ niche: editNiche, keywords: editKeywords } as any)
      .eq("user_id", user.id);
      
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
      setSavingNiche(false);
      return;
    }
    
    setSavingNiche(false);
    toast({ title: "Saved" });
    setEditingNiche(false);
    setResult(updatedResult);
  }, [user, editNiche, editKeywords, toast, result]);

  const startProfileEdit = () => {
    setEditProfile(businessProfile);
    setEditingProfile(true);
  };

  const cancelProfileEdit = () => setEditingProfile(false);

  const saveProfileEdit = useCallback(async () => {
    if (!user) return;

    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        icp: editProfile.icp,
        offers: editProfile.offers,
        regions: editProfile.regions,
        top_services: editProfile.topServices,
        main_cta: editProfile.mainCta,
        trust_assets: editProfile.trustAssets,
      } as any)
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
      setSavingProfile(false);
      return;
    }

    setSavingProfile(false);
    toast({ title: "Business profile saved" });
    setEditingProfile(false);
    setBusinessProfile(editProfile);
  }, [user, editProfile, toast]);

  // Load the onboarding business profile — independent of the AI site
  // analysis result, so it's always available on this page.
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("icp, offers, regions, top_services, main_cta, trust_assets")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBusinessProfile({
            icp: data.icp || "",
            offers: data.offers || [],
            regions: data.regions || [],
            topServices: data.top_services || [],
            mainCta: data.main_cta || "",
            trustAssets: data.trust_assets || [],
          });
        }
      });
  }, [user]);

  useEffect(() => {
    // First: try sessionStorage for the full enriched result (from the current session)
    const cached = sessionStorage.getItem("siteAnalysis");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.website_url) setUrl(parsed.website_url);
        if (parsed.niche || parsed.keywords?.length) {
          setResult(parsed);
          setSaved(true);
          return; // rich data found — skip DB load
        }
      } catch {}
    }

    // Fallback: load minimal data from DB for authenticated users
    if (user) {
      supabase
        .from("profiles")
        .select("website_url, niche, keywords")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.website_url) {
            setUrl(data.website_url);
            setResult({
              niche: data.niche || "",
              description: "",
              keywords: data.keywords || [],
              longTailKeywords: [],
            });
            setSaved(true);
          }
        });
    }
  }, [user]);

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </PageShell>
    );
  }

  const handleAnalyze = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setAnalyzing(true);
    setResult(null);
    setSaved(false);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-site", {
        body: { url: trimmed },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: "Analysis failed", description: data.error, variant: "destructive" });
      } else if (data?.success && data.data) {
        const analysisData = { ...data.data, website_url: trimmed };
        setResult(analysisData);
        sessionStorage.setItem("siteAnalysis", JSON.stringify(analysisData));
        setSaved(true);

        // Save to database (authentication required)
        if (user) {
          const { error: updateErr } = await supabase
            .from("profiles")
            .update({
              website_url: trimmed,
              niche: data.data.niche,
              // Save primary keywords only — long-tail stays separate for content plan quality
              keywords: data.data.flatKeywords || [],
            } as any)
            .eq("user_id", user.id);

          if (updateErr) {
            toast({ title: "Analysis complete", description: "Database save failed.", variant: "destructive" });
          } else {
            setSaved(true);
            toast({ title: "Analysis saved", description: "Your niche and keywords have been saved." });
          }

          // Pre-fill the business profile from what was auto-extracted — but
          // never clobber a field the user already filled in manually. Saved
          // as a separate update so it can't take down the save above.
          const mergedProfile: BusinessProfile = {
            icp: businessProfile.icp || (data.data.primaryICP || ""),
            offers: businessProfile.offers.length ? businessProfile.offers : (data.data.offers || []),
            regions: businessProfile.regions.length ? businessProfile.regions : (data.data.regions || []),
            topServices: businessProfile.topServices.length ? businessProfile.topServices : (data.data.topServices || []),
            mainCta: businessProfile.mainCta || (data.data.mainCta || ""),
            trustAssets: businessProfile.trustAssets.length ? businessProfile.trustAssets : (data.data.trustAssets || []),
          };

          const { error: profileErr } = await supabase
            .from("profiles")
            .update({
              icp: mergedProfile.icp,
              offers: mergedProfile.offers,
              regions: mergedProfile.regions,
              top_services: mergedProfile.topServices,
              main_cta: mergedProfile.mainCta,
              trust_assets: mergedProfile.trustAssets,
            } as any)
            .eq("user_id", user.id);

          // Show the extraction immediately regardless of persistence —
          // if the save failed (e.g. a pending migration), the values are
          // still visible here and can be saved manually once it's applied.
          setBusinessProfile(mergedProfile);
          if (profileErr) {
            console.error("Failed to save extracted business profile:", profileErr.message);
          }
        } else {
          toast({ title: "Analysis complete", description: "Next step unlocked. Continue to SERP Analysis." });
        }
      } else {
        toast({ title: "Unexpected response", description: "Please try again.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const isEnrichedKeywords = result?.keywords?.length && typeof result.keywords[0] !== "string";
  const isEnrichedLongTail = result?.longTailKeywords?.length && typeof result.longTailKeywords[0] !== "string";

  return (
    <PageShell>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-4xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-10">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <Globe className="text-primary" size={28} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Analyze Your Website
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-lg mx-auto">
              Deep-dive SEO analysis with keyword intent mapping, topic clusters, and competitive gap detection.
            </p>
          </div>

          {/* Input */}
          <div className="flex flex-col sm:flex-row gap-3 mb-10 max-w-2xl mx-auto">
            <Input
              type="url"
              placeholder="https://yourwebsite.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 h-12 text-base rounded-xl border-border bg-card"
              onKeyDown={(e) => e.key === "Enter" && !analyzing && handleAnalyze()}
              disabled={analyzing}
            />
            <Button
              onClick={handleAnalyze}
              disabled={analyzing || !url.trim()}
              className="h-12 px-8 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-all"
            >
              {analyzing ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Sparkles size={18} className="mr-2" />}
              {analyzing ? "Analyzing…" : "Analyze My Site"}
            </Button>
          </div>

          {/* Business Profile onboarding */}
          {user && (
            <Card className="border-border mb-10">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Briefcase size={18} className="text-primary" />
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Business Profile</span>
                  </div>
                  {!editingProfile && (
                    <button onClick={startProfileEdit} className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Pencil size={12} /> Edit
                    </button>
                  )}
                </div>

                {editingProfile ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Ideal Customer Profile (ICP)</label>
                      <Textarea
                        value={editProfile.icp}
                        onChange={(e) => setEditProfile({ ...editProfile, icp: e.target.value })}
                        placeholder="Describe who your ideal customer is — role, company size, pain points…"
                        className="text-sm"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Main CTA</label>
                      <Input
                        value={editProfile.mainCta}
                        onChange={(e) => setEditProfile({ ...editProfile, mainCta: e.target.value })}
                        placeholder="e.g., Book a Free Demo"
                        className="text-sm"
                      />
                    </div>

                    <TagListField
                      label="Offers"
                      values={editProfile.offers}
                      onChange={(v) => setEditProfile({ ...editProfile, offers: v })}
                      placeholder="Add an offer…"
                    />
                    <TagListField
                      label="Regions Served"
                      values={editProfile.regions}
                      onChange={(v) => setEditProfile({ ...editProfile, regions: v })}
                      placeholder="Add a region…"
                    />
                    <TagListField
                      label="Top Services"
                      values={editProfile.topServices}
                      onChange={(v) => setEditProfile({ ...editProfile, topServices: v })}
                      placeholder="Add a service…"
                    />
                    <TagListField
                      label="Trust Assets"
                      values={editProfile.trustAssets}
                      onChange={(v) => setEditProfile({ ...editProfile, trustAssets: v })}
                      placeholder="e.g., ISO 27001 certified, 500+ 5-star reviews…"
                    />

                    <div className="flex gap-2 justify-end">
                      <button onClick={cancelProfileEdit} className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1">
                        <X size={12} /> Cancel
                      </button>
                      <button onClick={saveProfileEdit} disabled={savingProfile} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-1 disabled:opacity-50">
                        <Check size={12} /> {savingProfile ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ideal Customer Profile (ICP)</span>
                      <p className="text-sm text-foreground/80 mt-1 leading-relaxed">{businessProfile.icp || "Not set"}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Main CTA</span>
                      <p className="text-sm text-foreground/80 mt-1">{businessProfile.mainCta || "Not set"}</p>
                    </div>
                    <ReadOnlyTagRow label="Offers" values={businessProfile.offers} />
                    <ReadOnlyTagRow label="Regions Served" values={businessProfile.regions} />
                    <ReadOnlyTagRow label="Top Services" values={businessProfile.topServices} />
                    <ReadOnlyTagRow label="Trust Assets" values={businessProfile.trustAssets} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Niche Overview */}
              <Card className="border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={18} className="text-primary" />
                      <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Detected Niche</span>
                    </div>
                    {!editingNiche && (
                      <button onClick={startNicheEdit} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                  </div>

                  {editingNiche ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Niche</label>
                        <Input
                          value={editNiche}
                          onChange={(e) => setEditNiche(e.target.value)}
                          placeholder="e.g., Digital Marketing"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Keywords</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {editKeywords.map((kw, i) => (
                            <Badge key={i} variant="secondary" className="text-xs flex items-center gap-1">
                              {kw}
                              <button onClick={() => removeKeyword(i)} className="hover:text-destructive">
                                <X size={10} />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                            placeholder="Add keyword…"
                            className="text-sm flex-1"
                          />
                          <button onClick={addKeyword} className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1">
                            <Plus size={12} /> Add
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={cancelNicheEdit} className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1">
                          <X size={12} /> Cancel
                        </button>
                        <button onClick={saveNicheEdit} disabled={savingNiche} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-1 disabled:opacity-50">
                          <Check size={12} /> {savingNiche ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-1">
                        <p className="text-2xl font-bold text-foreground">{result.niche}</p>
                        {result.description && (
                          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{result.description}</p>
                        )}
                      </div>
                      {result.subNiches && result.subNiches.length > 0 && (
                        <div className="md:border-l md:border-border md:pl-6">
                          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Sub-Niches</span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {result.subNiches.map((sn, i) => (
                              <Badge key={i} variant="outline" className="text-sm">{sn}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tabbed Results */}
              {isEnrichedKeywords ? (
                <Tabs defaultValue="keywords" className="w-full">
                  <TabsList className="grid w-full grid-cols-5 mb-4">
                    <TabsTrigger value="keywords" className="gap-1.5"><Tag size={14} /> Keywords</TabsTrigger>
                    <TabsTrigger value="longtail" className="gap-1.5"><Search size={14} /> Long-Tail</TabsTrigger>
                    <TabsTrigger value="clusters" className="gap-1.5"><Layers size={14} /> Clusters</TabsTrigger>
                    <TabsTrigger value="gaps" className="gap-1.5"><Target size={14} /> Gaps</TabsTrigger>
                    <TabsTrigger value="icp" className="gap-1.5"><Users size={14} /> ICP</TabsTrigger>
                  </TabsList>

                  {/* Keywords Tab */}
                  <TabsContent value="keywords">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Tag size={18} className="text-primary" />
                          Target Keywords
                          <Badge variant="secondary" className="ml-auto">{(result.keywords as EnrichedKeyword[]).length} keywords</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {(result.keywords as EnrichedKeyword[]).map((kw, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border"
                            >
                              <span className="font-medium text-foreground flex-1">{kw.term}</span>
                              <Badge variant="outline" className={`text-xs border ${intentColors[kw.intent] || "bg-muted text-muted-foreground"}`}>
                                {kw.intent}
                              </Badge>
                              <div className="flex items-center gap-2 w-28">
                                <Progress value={difficultyConfig[kw.difficulty]?.value || 50} className="h-1.5 flex-1" />
                                <span className={`text-xs font-medium ${difficultyConfig[kw.difficulty]?.color || "text-muted-foreground"}`}>
                                  {kw.difficulty}
                                </span>
                              </div>
                              <Badge variant="outline" className={`text-xs border ${priorityColors[kw.priority] || ""}`}>
                                {kw.priority}
                              </Badge>
                            </motion.div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Long-tail Tab */}
                  <TabsContent value="longtail">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Search size={18} className="text-primary" />
                          Long-Tail Keywords
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {isEnrichedLongTail ? (
                            (result.longTailKeywords as EnrichedLongTail[]).map((kw, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="p-3 rounded-lg bg-muted/50 border border-border"
                              >
                                <div className="flex items-center gap-3 mb-1">
                                  <span className="font-medium text-foreground flex-1">{kw.term}</span>
                                  <Badge variant="outline" className={`text-xs border ${intentColors[kw.intent] || ""}`}>
                                    {kw.intent}
                                  </Badge>
                                  <span className={`text-xs font-medium ${difficultyConfig[kw.difficulty]?.color || "text-muted-foreground"}`}>
                                    {kw.difficulty}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">{kw.searchContext}</p>
                              </motion.div>
                            ))
                          ) : (
                            (result.longTailKeywords as string[]).map((kw, i) => (
                              <Badge key={i} variant="outline" className="text-sm px-3 py-1">{kw}</Badge>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Topic Clusters Tab */}
                  <TabsContent value="clusters">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Layers size={18} className="text-primary" />
                          Topic Clusters
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {result.topicClusters && result.topicClusters.length > 0 ? (
                          <div className="grid gap-4 md:grid-cols-2">
                            {result.topicClusters.map((cluster, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.1 }}
                                className="p-4 rounded-xl border border-border bg-muted/30"
                              >
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-2 h-2 rounded-full bg-primary" />
                                  <h4 className="font-semibold text-foreground">{cluster.pillar}</h4>
                                </div>
                                <div className="space-y-1.5 pl-4">
                                  {cluster.supporting.map((s, j) => (
                                    <div key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <ArrowRight size={12} className="text-primary/60" />
                                      <span>{s}</span>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No topic clusters available. Re-run analysis for enriched results.</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Competitor Gaps Tab */}
                  <TabsContent value="gaps">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Target size={18} className="text-primary" />
                          Competitor Keyword Gaps
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {result.competitorKeywordGaps && result.competitorKeywordGaps.length > 0 ? (
                          <div className="space-y-2">
                            {result.competitorKeywordGaps.map((gap, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                              >
                                <AlertTriangle size={16} className="text-destructive shrink-0" />
                                <span className="text-foreground text-sm">{gap}</span>
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No gap data available. Re-run analysis for enriched results.</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Ideal Customer Profiles Tab */}
                  <TabsContent value="icp">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Users size={18} className="text-primary" />
                          Ideal Customer Profiles
                          {result.idealCustomerProfiles && result.idealCustomerProfiles.length > 0 && (
                            <Badge variant="secondary" className="ml-auto">{result.idealCustomerProfiles.length} profiles</Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {result.idealCustomerProfiles && result.idealCustomerProfiles.length > 0 ? (
                          <div className="grid gap-4 md:grid-cols-2">
                            {result.idealCustomerProfiles.map((icp, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                className="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-3"
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-semibold text-foreground leading-tight">{icp.name}</h4>
                                    <Badge variant="outline" className="text-[10px] shrink-0">#{i + 1}</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {icp.role}
                                    {icp.companySize ? ` · ${icp.companySize}` : ""}
                                  </p>
                                </div>

                                {icp.description && (
                                  <p className="text-sm text-foreground/80 leading-relaxed">{icp.description}</p>
                                )}

                                {icp.painPoints?.length > 0 && (
                                  <div>
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                      <AlertTriangle size={11} /> Pain Points
                                    </span>
                                    <ul className="mt-1.5 space-y-1">
                                      {icp.painPoints.map((p, j) => (
                                        <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                          <span className="text-destructive mt-0.5">•</span> {p}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {icp.goals?.length > 0 && (
                                  <div>
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                      <Target size={11} /> Goals
                                    </span>
                                    <ul className="mt-1.5 space-y-1">
                                      {icp.goals.map((g, j) => (
                                        <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                          <span className="text-primary mt-0.5">•</span> {g}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {icp.buyingTriggers?.length > 0 && (
                                  <div>
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                      <Flame size={11} /> Buying Triggers
                                    </span>
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                      {icp.buyingTriggers.map((t, j) => (
                                        <Badge key={j} variant="outline" className="text-[10px]">{t}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {icp.preferredChannels?.length > 0 && (
                                  <div>
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                      <Radar size={11} /> Preferred Channels
                                    </span>
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                      {icp.preferredChannels.map((c, j) => (
                                        <Badge key={j} variant="secondary" className="text-[10px]">{c}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No ICP data available. Re-run analysis for enriched results.</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              ) : (
                /* Fallback: flat keyword display for cached/old data */
                <Card>
                  <CardContent className="pt-6 space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Tag size={18} className="text-primary" />
                        <h3 className="font-semibold text-foreground text-lg">Keywords</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(result.keywords as any[]).map((kw, i) => (
                          <Badge key={i} variant="secondary" className="text-sm px-3 py-1">
                            {typeof kw === 'string' ? kw : kw.term}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <Sparkles size={14} className="inline mr-1" />
                      Click "Analyze My Site" again for enriched results with intent mapping, difficulty scores, and topic clusters.
                    </p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {result && (
            <Card className="border-border mt-8">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase size={18} className="text-primary" />
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Extracted from Crawled Pages</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <ReadOnlyTagRow label="Offers" values={businessProfile.offers.slice(0, 4)} />
                  <ReadOnlyTagRow label="Regions Served" values={businessProfile.regions.slice(0, 4)} />
                  <ReadOnlyTagRow label="Top Services" values={businessProfile.topServices.slice(0, 4)} />
                  <ReadOnlyTagRow label="Trust Assets" values={businessProfile.trustAssets.slice(0, 4)} />
                </div>
              </CardContent>
            </Card>
          )}

          {result && (
            <div className="mt-8 flex justify-end">
              <Button
                onClick={() => navigate("/seo-analysis")}
                className="h-11 px-6 rounded-xl"
              >
                Continue to SERP Analysis
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </div>
          )}
        </motion.div>
    </PageShell>
  );
};

export default GetStarted;
