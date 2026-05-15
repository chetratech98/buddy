import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Sparkles, Loader2, Trash2, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, TrendingUp, Search, ExternalLink,
  Info, Zap, Lightbulb, Target, XCircle, Layers, FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { PageShell } from "@/components/PageShell";
import { ContentEditor } from "@/components/cms/ContentEditor";
import { PublishPanel, PostStatus } from "@/components/cms/PublishPanel";
import { TemplateSelector } from "@/components/TemplateSelector";
import { ContentQualityMetrics } from "@/components/ContentQualityMetrics";
import { ContentTemplate } from "@/lib/templates";
import {
  scoreContent,
  scoreColor,
  scoreBg,
  SeoScoreBreakdown,
} from "@/lib/seo-scorer";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DuplicateWarning = {
  riskLevel: "duplicate" | "high" | "moderate" | "safe";
  riskLabel: string;
  recommendation: string;
  maxSimilarity: number;
  topMatch?: { title: string; percentage: number };
};

type ContentGapResult = {
  gaps: Array<{
    topic: string;
    priority: "critical" | "high" | "medium" | "low";
    reason: string;
    suggestedHeading: string;
    suggestedContent: string;
    competitorCount: number;
  }>;
  summary: {
    totalGaps: number;
    criticalGaps: number;
    estimatedWordsToAdd: number;
    topRecommendation: string;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// SEO Score Panel (sidebar component)
// ─────────────────────────────────────────────────────────────────────────────

function SeoScorePanel({ score }: { score: SeoScoreBreakdown }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = scoreColor(score.total);
  const bgClass    = scoreBg(score.total);

  const dimensions = [
    { label: "Word Count",       s: score.wordCount,        note: score.wordCount.note },
    { label: "Keyword Density",  s: score.keywordDensity,   note: score.keywordDensity.note },
    { label: "Headings",         s: score.headingStructure, note: score.headingStructure.note },
    { label: "Readability",      s: score.readability,      note: score.readability.note },
    { label: "Meta Description", s: score.metaDescription,  note: score.metaDescription.note },
    { label: "FAQ Section",      s: score.faqPresence,      note: score.faqPresence.note },
    { label: "Title Quality",    s: score.titleQuality,     note: score.titleQuality.note },
    { label: "Semantic Depth",   s: score.semanticRichness, note: score.semanticRichness.note },
  ] as const;

  return (
    <div className={`card-elevated border rounded-xl overflow-hidden ${bgClass}`}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`text-3xl font-black tabular-nums leading-none ${colorClass}`}>
            {score.total}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">SEO Score</p>
            <p className={`text-sm font-bold ${colorClass}`}>Grade {score.grade}</p>
          </div>
        </div>
        {/* Circular progress ring */}
        <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
          <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor"
            strokeWidth="4" className="text-muted/20" />
          <circle
            cx="24" cy="24" r="20" fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 20}`}
            strokeDashoffset={`${2 * Math.PI * 20 * (1 - score.total / 100)}`}
            className={colorClass}
            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
          />
        </svg>
      </div>

      {/* Dimension bars */}
      <div className="px-4 pb-2 space-y-2">
        {dimensions.slice(0, expanded ? dimensions.length : 4).map(({ label, s }) => (
          <div key={label}>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-xs font-medium tabular-nums">{s.score}/{s.max}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  s.score / s.max >= 0.8 ? "bg-green-500" :
                  s.score / s.max >= 0.6 ? "bg-blue-500" :
                  s.score / s.max >= 0.4 ? "bg-yellow-500" :
                  s.score / s.max >= 0.2 ? "bg-orange-500" : "bg-red-500"
                }`}
                style={{ width: `${(s.score / s.max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Toggle expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-muted/20"
      >
        {expanded ? <><ChevronUp size={12} /> Less</> : <><ChevronDown size={12} /> All dimensions</>}
      </button>

      {/* Suggestions */}
      {score.suggestions.length > 0 && (
        <div className="px-4 pb-4 pt-2 border-t border-muted/20 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Suggestions</p>
          {score.suggestions.map((s, i) => (
            <div key={i} className="flex gap-2 text-xs text-muted-foreground">
              <Info size={12} className="shrink-0 mt-0.5 text-yellow-500" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Priority badge colors
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_CLASSES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
  high:     "bg-orange-500/10 text-orange-500 border-orange-500/20",
  medium:   "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  low:      "bg-muted/50 text-muted-foreground border-border",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const CreatePost = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Prompt step
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState("professional");
  const [targetWordCount, setTargetWordCount] = useState(1500);
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState<"prompt" | "edit">("prompt");

  // Content intelligence preview
  const [contentIntelligence, setContentIntelligence] = useState<any>(null);
  const [loadingIntelligence, setLoadingIntelligence] = useState(false);
  const [showIntelligencePreview, setShowIntelligencePreview] = useState(false);

  // Edit step — post fields
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [postKeywords, setPostKeywords] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [competitorUrls, setCompetitorUrls] = useState<string[]>([]);

  // CMS fields
  const [status, setStatus] = useState<PostStatus>("draft");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [platformWordpress, setPlatformWordpress] = useState(false);
  const [platformMedium, setPlatformMedium] = useState(false);

  // Live SEO score
  const [seoScore, setSeoScore] = useState<SeoScoreBreakdown | null>(null);

  // Duplicate detection
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  const duplicateDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Content gap analysis
  const [contentGapResult, setContentGapResult] = useState<ContentGapResult | null>(null);
  const [contentGapLoading, setContentGapLoading] = useState(false);
  const [contentGapOpen, setContentGapOpen] = useState(false);

  // ── Profile prefill ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("niche, keywords")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.keywords?.length) setKeywords(data.keywords.join(", "));
        if (data?.niche && !topic) setTopic(`Write about ${data.niche}`);
      });
  }, [user]);

  // ── Live SEO score recalculation ──────────────────────────────────────────
  useEffect(() => {
    if (step !== "edit") return;
    if (!title && !content) { setSeoScore(null); return; }
    const score = scoreContent({
      title,
      content,
      keywords: postKeywords,
      seoDescription,
    });
    setSeoScore(score);
  }, [title, content, postKeywords, seoDescription, step]);

  // ── Duplicate detection (debounced, fires when topic + keywords are set) ──
  useEffect(() => {
    if (!user) return;
    if (duplicateDebounce.current) clearTimeout(duplicateDebounce.current);

    if (!topic.trim() || topic.trim().length < 10) {
      setDuplicateWarning(null);
      return;
    }

    duplicateDebounce.current = setTimeout(async () => {
      setDuplicateChecking(true);
      try {
        const { data, error } = await supabase.functions.invoke("check-duplicate", {
          body: {
            title:   topic.trim(),
            topic:   topic.trim(),
            keyword: keywords.split(",")[0]?.trim() ?? "",
          },
        });
        if (error || !data) throw error ?? new Error("No response");
        if (data.riskLevel && data.riskLevel !== "safe") {
          setDuplicateWarning({
            riskLevel:      data.riskLevel,
            riskLabel:      data.riskLabel,
            recommendation: data.recommendation,
            maxSimilarity:  data.maxSimilarity,
            topMatch:       data.topMatches?.[0]
              ? { title: data.topMatches[0].title, percentage: data.topMatches[0].percentage }
              : undefined,
          });
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        // silently skip — duplicate check is non-blocking
        setDuplicateWarning(null);
      } finally {
        setDuplicateChecking(false);
      }
    }, 1500);

    return () => {
      if (duplicateDebounce.current) clearTimeout(duplicateDebounce.current);
    };
  }, [topic, keywords, user]);

  // ── Fetch Content Intelligence ─────────────────────────────────────────────
  const fetchContentIntelligence = async () => {
    if (!keywords.trim() && !topic.trim()) {
      toast({ title: "Enter a keyword", description: "Add a keyword to get content intelligence.", variant: "destructive" });
      return;
    }
    
    const primaryKeyword = keywords.trim() ? keywords.split(",")[0].trim() : topic.slice(0, 100);
    setLoadingIntelligence(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("content-intelligence", {
        body: {
          keyword: primaryKeyword,
          userId: user?.id,
          includeOutline: true,
          includeHeadings: true,
          includeFAQ: true,
        },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setContentIntelligence(data);
      setShowIntelligencePreview(true);
      toast({ 
        title: "Content Intelligence Ready", 
        description: `Analyzed "${primaryKeyword}" with ${data.outline?.sections?.length || 0} recommended sections.` 
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to fetch content intelligence.";
      toast({ title: "Intelligence fetch failed", description: message, variant: "destructive" });
    } finally {
      setLoadingIntelligence(false);
    }
  };

  // ── Generate blog post ─────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({ title: "Enter a topic", description: "Please describe what you want to write about.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      type GenerationBody = {
        topic: string;
        keywords: string;
        tone: string;
        targetWordCount?: number;
        template?: { name: string; structure: string[]; promptTemplate: string };
      };
      const generationBody: GenerationBody = { topic, keywords, tone, targetWordCount };
      if (selectedTemplate) {
        generationBody.template = {
          name:           selectedTemplate.name,
          structure:      selectedTemplate.structure,
          promptTemplate: selectedTemplate.promptTemplate,
        };
      }

      const { data, error } = await supabase.functions.invoke("generate-blog", {
        body: generationBody,
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setTitle(data.title || "");
      setExcerpt(data.excerpt || "");
      setContent(data.content || "");
      setPostKeywords(data.keywords || []);
      setSeoTitle((data.title || "").slice(0, 60));
      setSeoDescription((data.excerpt || "").slice(0, 160));
      setCompetitorUrls(data.competitorUrlsAnalyzed || []);
      setStep("edit");
    } catch (e) {
      const message = e instanceof Error ? e.message : "An unexpected error occurred.";
      toast({ title: "Generation failed", description: message, variant: "destructive" });
    }
    setGenerating(false);
  };

  // ── Content gap analysis ───────────────────────────────────────────────────
  const handleContentGap = async () => {
    if (!content.trim()) return;
    setContentGapLoading(true);
    setContentGapOpen(true);
    setContentGapResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("content-gap", {
        body: {
          content,
          keyword: postKeywords[0] ?? keywords.split(",")[0]?.trim() ?? "",
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setContentGapResult(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gap analysis failed";
      toast({ title: "Content gap analysis failed", description: message, variant: "destructive" });
      setContentGapOpen(false);
    } finally {
      setContentGapLoading(false);
    }
  };

  // ── Save post ──────────────────────────────────────────────────────────────
  const handleSave = async (saveStatus: PostStatus) => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "Missing content", description: "Title and content are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const postData = {
      user_id:            user!.id,
      title,
      content,
      excerpt,
      keywords:           postKeywords,
      status:             saveStatus,
      category,
      tags,
      seo_title:          seoTitle,
      seo_description:    seoDescription,
      scheduled_at:       scheduledAt?.toISOString() || null,
      published_at:       saveStatus === "published" ? new Date().toISOString() : null,
      platform_wordpress: platformWordpress,
      platform_medium:    platformMedium,
      platform_status:    {},
    };
    const { error } = await supabase.from("blog_posts").insert([postData]);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      const messages: Record<string, string> = {
        draft:     "Draft saved",
        review:    "Sent for review",
        scheduled: `Scheduled for ${scheduledAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(scheduledAt) : "later"}`,
        published: "Post published!",
      };
      toast({ title: messages[saveStatus] || "Saved" });
      navigate("/posts");
    }
    setSaving(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <PageShell
      backTo={step === "edit" ? undefined : "/"}
      backLabel={step === "edit" ? "Back to prompt" : "Back to dashboard"}
      wide
    >
      {step === "prompt" ? (
        <>
          <h1 className="text-3xl font-bold mb-2">Create a Blog Post</h1>
          <p className="text-muted-foreground mb-8">Describe your topic and let AI generate SEO-optimized content for you.</p>

          <div className="card-elevated p-8 space-y-8">
            {/* Template Selector */}
            <div className="pb-6 border-b">
              <TemplateSelector
                onSelectTemplate={setSelectedTemplate}
                selectedTemplateId={selectedTemplate?.id}
              />
            </div>

            {/* Topic */}
            <div>
              <label className="block text-sm font-medium mb-2">Topic *</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., 10 tips for improving website load speed in 2026"
                rows={3}
                className="input-base resize-none"
              />
              {selectedTemplate && (
                <p className="text-xs text-muted-foreground mt-2">
                  Using template: <span className="font-medium">{selectedTemplate.name}</span> ({selectedTemplate.structure.length} sections, ~{selectedTemplate.estimatedWords} words)
                </p>
              )}

              {/* Duplicate warning */}
              {duplicateChecking && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" /> Checking for duplicate topics…
                </div>
              )}
              {!duplicateChecking && duplicateWarning && (
                <div className={`mt-3 flex gap-3 p-3 rounded-lg border text-sm ${
                  duplicateWarning.riskLevel === "duplicate"
                    ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
                    : "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400"
                }`}>
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{duplicateWarning.riskLabel} — {duplicateWarning.maxSimilarity * 100 | 0}% similar</p>
                    {duplicateWarning.topMatch && (
                      <p className="text-xs mt-0.5 opacity-80">
                        Closest match: "{duplicateWarning.topMatch.title}" ({duplicateWarning.topMatch.percentage}%)
                      </p>
                    )}
                    <p className="text-xs mt-1 opacity-80">{duplicateWarning.recommendation}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-sm font-medium mb-2">Target Keywords (optional)</label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g., website speed, performance optimization, Core Web Vitals"
                className="input-base"
              />
            </div>

            {/* Tone */}
            <div>
              <label className="block text-sm font-medium mb-2">Tone</label>
              <div className="flex flex-wrap gap-2">
                {["professional", "casual", "technical", "friendly"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 ${
                      tone === t
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Word Count */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Target Word Count: <span className="text-primary font-semibold">{targetWordCount}</span> words
              </label>
              <input
                type="range"
                min="500"
                max="3000"
                step="500"
                value={targetWordCount}
                onChange={(e) => setTargetWordCount(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>500 (Short)</span>
                <span>1500 (Medium)</span>
                <span>3000 (Long)</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {targetWordCount <= 800 && "Quick reads, social posts"}
                {targetWordCount > 800 && targetWordCount <= 1500 && "Standard blog posts"}
                {targetWordCount > 1500 && targetWordCount <= 2500 && "In-depth guides, SEO-optimized"}
                {targetWordCount > 2500 && "Comprehensive tutorials, pillar content"}
              </p>
            </div>

            {/* Content Intelligence Preview */}
            <div className="space-y-3">
              <button 
                onClick={fetchContentIntelligence} 
                disabled={loadingIntelligence || (!keywords.trim() && !topic.trim())}
                className="w-full btn-secondary flex items-center justify-center gap-2"
              >
                {loadingIntelligence ? (
                  <><Loader2 size={18} className="animate-spin" /> Analyzing SERP data…</>
                ) : (
                  <><Lightbulb size={18} /> Get Content Intelligence</>
                )}
              </button>
              
              {contentIntelligence && showIntelligencePreview && (
                <div className="card-elevated p-6 space-y-4 border-2 border-primary/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Target size={18} className="text-primary" />
                        Content Intelligence
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        AI-powered insights from SERP analysis
                      </p>
                    </div>
                    <button 
                      onClick={() => setShowIntelligencePreview(false)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Close intelligence preview"
                    >
                      <XCircle size={20} />
                    </button>
                  </div>

                  {/* Search Intent */}
                  {contentIntelligence.searchIntent && (
                    <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
                      <TrendingUp size={16} className="text-primary" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-muted-foreground">Search Intent</p>
                        <p className="text-sm font-semibold">
                          {contentIntelligence.searchIntent.primary} 
                          <span className="text-xs text-muted-foreground ml-2">
                            ({contentIntelligence.searchIntent.confidence}% confidence)
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Content Benchmark */}
                  {contentIntelligence.optimization && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">Target Words</p>
                        <p className="text-lg font-bold text-primary">
                          {contentIntelligence.optimization.targetWordCount}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">H2 Sections</p>
                        <p className="text-lg font-bold text-primary">
                          {contentIntelligence.optimization.recommendedH2Count}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">Content Type</p>
                        <p className="text-sm font-semibold mt-1">
                          {contentIntelligence.contentBenchmark?.dominantContentType || 'guide'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Outline Preview */}
                  {contentIntelligence.outline?.sections && (
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Layers size={14} />
                        Recommended Outline ({contentIntelligence.outline.sections.length} sections)
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {contentIntelligence.outline.sections.slice(0, 8).map((section: any, idx: number) => (
                          <div 
                            key={idx} 
                            className={`p-2 rounded border text-sm ${
                              section.priority === 'must-have' 
                                ? 'bg-primary/5 border-primary/20' 
                                : 'bg-muted/20 border-border'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{section.heading}</span>
                              <span className="text-xs text-muted-foreground">
                                ~{section.estimatedWords}w
                              </span>
                            </div>
                            {section.priority === 'must-have' && (
                              <span className="text-xs text-primary">⭐ Required</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Heading Patterns (Phase 2) */}
                  {contentIntelligence.headingPatterns && contentIntelligence.headingPatterns.commonHeadings && contentIntelligence.headingPatterns.commonHeadings.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <TrendingUp size={14} className="text-blue-500" />
                        Common Competitor Headings
                      </p>
                      <div className="space-y-1 text-xs">
                        {contentIntelligence.headingPatterns.commonHeadings.slice(0, 5).map((pattern: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-900">
                            <span className="font-medium">{pattern.heading}</span>
                            <span className="text-blue-600 dark:text-blue-400">{pattern.percentage}%</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Avg H2s: {contentIntelligence.headingPatterns.avgH2Count} | Avg H3s: {contentIntelligence.headingPatterns.avgH3Count}
                      </p>
                    </div>
                  )}

                  {/* FAQ Questions with AI Answers (Phase 2 Enhanced) */}
                  {contentIntelligence.faq && contentIntelligence.faq.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <FileText size={14} />
                        FAQ Questions ({contentIntelligence.faq.length})
                      </p>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {contentIntelligence.faq.slice(0, 5).map((faq: any, idx: number) => (
                          <div key={idx} className="p-2 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-900">
                            <div className="flex items-start gap-2 mb-1">
                              <CheckCircle2 size={12} className="shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
                              <p className="text-xs font-semibold text-green-900 dark:text-green-100">{faq.question}</p>
                            </div>
                            {faq.answer && (
                              <p className="text-xs text-green-700 dark:text-green-300 pl-5">
                                {faq.answer.substring(0, 150)}{faq.answer.length > 150 ? '...' : ''}
                              </p>
                            )}
                            <div className="flex items-center gap-2 pl-5 mt-1">
                              <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                                {faq.source === 'PAA' ? 'People Also Ask' : faq.source === 'competitor' ? 'Competitor' : 'AI Generated'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        AI-powered answers optimized for featured snippets
                      </p>
                    </div>
                  )}

                  {/* Content Gaps */}
                  {contentIntelligence.contentGaps && contentIntelligence.contentGaps.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Zap size={14} className="text-yellow-500" />
                        Quick Wins
                      </p>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {contentIntelligence.contentGaps.slice(0, 2).map((gap: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2">
                            <Sparkles size={12} className="shrink-0 mt-0.5 text-yellow-500" />
                            <span>{gap}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Schema Markup (Phase 2) */}
                  {contentIntelligence.schema && contentIntelligence.schema.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Info size={14} className="text-purple-500" />
                        Schema Markup ({contentIntelligence.schema.length} types)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {contentIntelligence.schema.map((schema: any, idx: number) => (
                          <span key={idx} className="px-2 py-1 text-xs bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-900">
                            {schema.type}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Rich results enabled for better SERP visibility
                      </p>
                    </div>
                  )}

                  {/* Semantic Entities (Phase 2 Enhanced) */}
                  {contentIntelligence.semanticEntities && (
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Sparkles size={14} className="text-indigo-500" />
                        Semantic Entities
                      </p>
                      <div className="space-y-2">
                        {contentIntelligence.semanticEntities.required && contentIntelligence.semanticEntities.required.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Required Keywords</p>
                            <div className="flex flex-wrap gap-1">
                              {contentIntelligence.semanticEntities.required.slice(0, 8).map((entity: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 rounded font-medium">
                                  {entity}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {contentIntelligence.semanticEntities.recommended && contentIntelligence.semanticEntities.recommended.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Recommended</p>
                            <div className="flex flex-wrap gap-1">
                              {contentIntelligence.semanticEntities.recommended.slice(0, 10).map((entity: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 text-xs bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded">
                                  {entity}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {contentIntelligence.semanticEntities.densityRecommendations && (
                          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/20 rounded border border-indigo-200 dark:border-indigo-900">
                            <p className="text-xs text-indigo-900 dark:text-indigo-100">
                              <span className="font-semibold">Entity Density:</span> {(contentIntelligence.semanticEntities.densityRecommendations.current * 100).toFixed(1)}%
                              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                                contentIntelligence.semanticEntities.densityRecommendations.status === 'good' 
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              }`}>
                                {contentIntelligence.semanticEntities.densityRecommendations.status === 'good' ? '✓ Optimal' : '⚠ Low'}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button onClick={handleGenerate} disabled={generating} className="w-full btn-primary">
              {generating ? (
                <><Loader2 size={18} className="animate-spin" /> Generating your blog post…</>
              ) : (
                <><Sparkles size={18} /> Generate Blog Post</>
              )}
            </button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* ── Main editor ── */}
          <div className="space-y-5">
            {/* Competitor sources badge */}
            {competitorUrls.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-blue-500/8 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400">
                <Search size={13} className="shrink-0" />
                <span className="font-medium">Researched {competitorUrls.length} competitor pages:</span>
                {competitorUrls.slice(0, 3).map((url) => {
                  try {
                    return (
                      <span key={url} className="opacity-70">
                        {new URL(url).hostname}
                      </span>
                    );
                  } catch {
                    return null;
                  }
                })}
                {competitorUrls.length > 3 && (
                  <span className="opacity-70">+{competitorUrls.length - 3} more</span>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-base text-xl font-bold"
                placeholder="Post title…"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Excerpt</label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
                className="input-base resize-none text-sm"
                placeholder="Brief summary of the post…"
              />
            </div>

            {postKeywords.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">Keywords</label>
                <div className="flex flex-wrap gap-2">
                  {postKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/8 text-primary rounded-full text-xs font-medium"
                    >
                      {kw}
                      <button
                        onClick={() => setPostKeywords(postKeywords.filter((_, j) => j !== i))}
                        className="hover:text-destructive"
                        title="Remove keyword"
                        aria-label={`Remove ${kw}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Content</label>
              <ContentEditor content={content} onChange={setContent} />
            </div>

            {/* ── Content Gap Analysis ── */}
            <div className="card-elevated rounded-xl overflow-hidden border">
              <button
                onClick={() => contentGapOpen ? setContentGapOpen(false) : handleContentGap()}
                disabled={contentGapLoading}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <TrendingUp size={15} className="text-purple-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">Content Gap Analysis</p>
                    <p className="text-xs text-muted-foreground">
                      {contentGapResult
                        ? `${contentGapResult.summary.totalGaps} gaps found · ${contentGapResult.summary.criticalGaps} critical`
                        : "Find topics your competitors cover that you're missing"}
                    </p>
                  </div>
                </div>
                {contentGapLoading ? (
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                ) : contentGapOpen ? (
                  <ChevronUp size={16} className="text-muted-foreground" />
                ) : (
                  <Zap size={16} className="text-purple-500" />
                )}
              </button>

              {contentGapOpen && contentGapResult && (
                <div className="border-t">
                  {/* Summary bar */}
                  <div className="px-5 py-3 bg-muted/20 flex flex-wrap gap-4 text-xs">
                    <span><span className="font-semibold text-foreground">{contentGapResult.summary.totalGaps}</span> total gaps</span>
                    <span><span className="font-semibold text-red-500">{contentGapResult.summary.criticalGaps}</span> critical</span>
                    <span><span className="font-semibold text-foreground">+{contentGapResult.summary.estimatedWordsToAdd.toLocaleString()}</span> words suggested</span>
                  </div>

                  {/* Top recommendation */}
                  {contentGapResult.summary.topRecommendation && (
                    <div className="px-5 py-3 flex gap-3 bg-yellow-500/5 border-b border-yellow-500/10">
                      <Sparkles size={14} className="text-yellow-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground/80">{contentGapResult.summary.topRecommendation}</p>
                    </div>
                  )}

                  {/* Gaps list */}
                  <div className="divide-y max-h-96 overflow-y-auto">
                    {contentGapResult.gaps.map((gap, i) => (
                      <div key={i} className="px-5 py-4 space-y-1.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium leading-snug">{gap.topic}</p>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${PRIORITY_CLASSES[gap.priority] ?? PRIORITY_CLASSES.low}`}>
                            {gap.priority}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{gap.reason}</p>
                        {gap.suggestedHeading && (
                          <p className="text-xs font-mono text-blue-500 bg-blue-500/8 px-2 py-1 rounded">
                            {gap.suggestedHeading}
                          </p>
                        )}
                        {gap.suggestedContent && (
                          <p className="text-xs text-muted-foreground italic">{gap.suggestedContent}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Covered by <span className="font-medium text-foreground">{gap.competitorCount}</span> competitor{gap.competitorCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {contentGapOpen && contentGapLoading && (
                <div className="border-t px-5 py-8 flex flex-col items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 size={20} className="animate-spin" />
                  <span>Scraping competitors and analyzing gaps…</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
            {/* Content Quality Metrics */}
            {content && (
              <ContentQualityMetrics
                wordCount={content.split(/\s+/).filter(w => w.length > 0).length}
                targetWordCount={targetWordCount}
                hasFAQ={content.toLowerCase().includes('faq') || content.toLowerCase().includes('frequently asked')}
                keywords={postKeywords}
              />
            )}
            
            {/* Live SEO score */}
            {seoScore && <SeoScorePanel score={seoScore} />}

            {/* Publish panel */}
            <PublishPanel
              status={status}
              onStatusChange={setStatus}
              scheduledAt={scheduledAt}
              onScheduledAtChange={setScheduledAt}
              platformWordpress={platformWordpress}
              onPlatformWordpressChange={setPlatformWordpress}
              platformMedium={platformMedium}
              onPlatformMediumChange={setPlatformMedium}
              onSave={handleSave}
              saving={saving}
              category={category}
              onCategoryChange={setCategory}
              tags={tags}
              onTagsChange={setTags}
              seoTitle={seoTitle}
              onSeoTitleChange={setSeoTitle}
              seoDescription={seoDescription}
              onSeoDescriptionChange={setSeoDescription}
            />
          </div>
        </div>
      )}
    </PageShell>
  );
};

export default CreatePost;
