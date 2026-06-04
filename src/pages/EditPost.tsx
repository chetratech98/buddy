import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Trash2, ChevronDown, ChevronUp, Info,
  TrendingUp, Zap, Sparkles, Search, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/PageShell";
import { ContentEditor } from "@/components/cms/ContentEditor";
import { PublishPanel, PostStatus } from "@/components/cms/PublishPanel";
import {
  scoreContent, scoreColor, scoreBg, SeoScoreBreakdown,
} from "@/lib/seo-scorer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─────────────────────────────────────────────────────────────────────────────
// SEO Score Panel (reused from CreatePost pattern)
// ─────────────────────────────────────────────────────────────────────────────

function SeoScorePanel({ score }: { score: SeoScoreBreakdown }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = scoreColor(score.total);
  const bgClass    = scoreBg(score.total);

  const dimensions = [
    { label: "Word Count",       s: score.wordCount        },
    { label: "Keyword Density",  s: score.keywordDensity   },
    { label: "Headings",         s: score.headingStructure },
    { label: "Readability",      s: score.readability      },
    { label: "Meta Description", s: score.metaDescription  },
    { label: "FAQ Section",      s: score.faqPresence      },
    { label: "Title Quality",    s: score.titleQuality     },
    { label: "Semantic Depth",   s: score.semanticRichness },
  ] as const;

  return (
    <div className={`card-elevated border rounded-xl overflow-hidden ${bgClass}`}>
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
        <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
          <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/20" />
          <circle cx="24" cy="24" r="20" fill="none" strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 20}`}
            strokeDashoffset={`${2 * Math.PI * 20 * (1 - score.total / 100)}`}
            className={colorClass}
            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
          />
        </svg>
      </div>

      <div className="px-4 pb-2 space-y-2">
        {dimensions.slice(0, expanded ? 8 : 4).map(({ label, s }) => (
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

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-muted/20"
      >
        {expanded ? <><ChevronUp size={12} /> Less</> : <><ChevronDown size={12} /> All dimensions</>}
      </button>

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
// Content Gap types
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_CLASSES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
  high:     "bg-orange-500/10 text-orange-500 border-orange-500/20",
  medium:   "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  low:      "bg-muted/50 text-muted-foreground border-border",
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
// EditPost page
// ─────────────────────────────────────────────────────────────────────────────

const EditPost = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Post fields
  const [title,           setTitle]           = useState("");
  const [excerpt,         setExcerpt]         = useState("");
  const [content,         setContent]         = useState("");
  const [postKeywords,    setPostKeywords]     = useState<string[]>([]);
  const [status,          setStatus]          = useState<PostStatus>("draft");
  const [category,        setCategory]        = useState("");
  const [tags,            setTags]            = useState<string[]>([]);
  const [seoTitle,        setSeoTitle]        = useState("");
  const [seoDescription,  setSeoDescription]  = useState("");
  const [scheduledAt,     setScheduledAt]     = useState<Date | null>(null);
  const [platformWordpress, setPlatformWordpress] = useState(false);
  const [platformMedium,    setPlatformMedium]    = useState(false);

  // Live SEO score
  const [seoScore, setSeoScore] = useState<SeoScoreBreakdown | null>(null);

  // Content gap
  const [contentGapResult,  setContentGapResult]  = useState<ContentGapResult | null>(null);
  const [contentGapLoading, setContentGapLoading] = useState(false);
  const [contentGapOpen,    setContentGapOpen]    = useState(false);

  // ── Load post ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !user) return;

    supabase
      .from("blog_posts")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast({ title: "Post not found", variant: "destructive" });
          navigate("/posts");
          return;
        }
        setTitle(data.title ?? "");
        setExcerpt(data.excerpt ?? "");
        setContent(data.content ?? "");
        setPostKeywords(Array.isArray(data.keywords) ? data.keywords : []);
        setStatus((data.status ?? "draft") as PostStatus);
        setCategory(data.category ?? "");
        setTags(Array.isArray(data.tags) ? data.tags : []);
        setSeoTitle(data.seo_title ?? "");
        setSeoDescription(data.seo_description ?? "");
        setScheduledAt(data.scheduled_at ? new Date(data.scheduled_at) : null);
        setPlatformWordpress(data.platform_wordpress ?? false);
        setPlatformMedium(data.platform_medium ?? false);
        setLoading(false);
      });
  }, [id, user]);

  // ── Live SEO score ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!title && !content) { setSeoScore(null); return; }
    setSeoScore(scoreContent({ title, content, keywords: postKeywords, seoDescription }));
  }, [title, content, postKeywords, seoDescription]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async (saveStatus: PostStatus) => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "Missing content", description: "Title and content are required.", variant: "destructive" });
      return;
    }
    setSaving(true);

    // Calculate final score + word count to persist
    const finalScore = scoreContent({ title, content, keywords: postKeywords, seoDescription });
    const wordCount  = content
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#*_~>|`]/g, " ")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2).length;

    const { error } = await supabase
      .from("blog_posts")
      .update({
        title,
        excerpt,
        content,
        keywords:           postKeywords,
        status:             saveStatus,
        category,
        tags,
        seo_title:          seoTitle,
        seo_description:    seoDescription,
        scheduled_at:       scheduledAt?.toISOString() ?? null,
        published_at:       saveStatus === "published" ? new Date().toISOString() : undefined,
        platform_wordpress: platformWordpress,
        platform_medium:    platformMedium,
        seo_score:          finalScore.total,
        word_count:         wordCount,
      })
      .eq("id", id!)
      .eq("user_id", user!.id);

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

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase
      .from("blog_posts")
      .delete()
      .eq("id", id!)
      .eq("user_id", user!.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      setDeleting(false);
    } else {
      toast({ title: "Post deleted" });
      navigate("/posts");
    }
  };

  // ── Content gap ──────────────────────────────────────────────────────────
  const handleContentGap = async () => {
    if (!content.trim()) return;
    setContentGapLoading(true);
    setContentGapOpen(true);
    setContentGapResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("content-gap", {
        body: { content, keyword: postKeywords[0] ?? "" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setContentGapResult(data);
    } catch (e) {
      toast({ title: "Gap analysis failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
      setContentGapOpen(false);
    } finally {
      setContentGapLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <PageShell backTo="/posts" backLabel="Back to posts" wide>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Edit Post</h1>
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80 transition-colors px-3 py-2 rounded-lg hover:bg-destructive/8"
        >
          <Trash2 size={15} /> Delete
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* ── Main editor ── */}
        <div className="space-y-5">
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
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/8 text-primary rounded-full text-xs font-medium">
                    {kw}
                    <button
                      onClick={() => setPostKeywords(postKeywords.filter((_, j) => j !== i))}
                      className="hover:text-destructive"
                      aria-label={`Remove ${kw}`}
                    >
                      <Trash2 size={11} />
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
                      ? `${contentGapResult.summary.totalGaps} gaps · ${contentGapResult.summary.criticalGaps} critical`
                      : "Find topics competitors cover that you're missing"}
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
                <div className="px-5 py-3 bg-muted/20 flex flex-wrap gap-4 text-xs">
                  <span><span className="font-semibold text-foreground">{contentGapResult.summary.totalGaps}</span> total gaps</span>
                  <span><span className="font-semibold text-red-500">{contentGapResult.summary.criticalGaps}</span> critical</span>
                  <span><span className="font-semibold text-foreground">+{contentGapResult.summary.estimatedWordsToAdd.toLocaleString()}</span> words suggested</span>
                </div>
                {contentGapResult.summary.topRecommendation && (
                  <div className="px-5 py-3 flex gap-3 bg-yellow-500/5 border-b border-yellow-500/10">
                    <Sparkles size={14} className="text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground/80">{contentGapResult.summary.topRecommendation}</p>
                  </div>
                )}
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
                      <p className="text-xs text-muted-foreground">
                        Covered by <span className="font-medium text-foreground">{gap.competitorCount}</span> competitor{gap.competitorCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
          {seoScore && <SeoScorePanel score={seoScore} />}

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

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" /> Delete post?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">"{title}"</span> will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
};

export default EditPost;
