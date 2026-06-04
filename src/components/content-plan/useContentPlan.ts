import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ContentItem } from "./types";

export function useContentPlan() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [niche, setNiche] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [longTailKeywords, setLongTailKeywords] = useState<string[]>([]);
  const [tone, setTone] = useState("professional");
  const [plan, setPlan] = useState<ContentItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [serpInsights, setSerpInsights] = useState<any>(null);
  const [contentIntelligence, setContentIntelligence] = useState<any>(null);
  const [orgGoals, setOrgGoals] = useState("");
  const [orgVision, setOrgVision] = useState("");
  const [generationProgress, setGenerationProgress] = useState(0);
  const days = 30;

  // Debounced auto-save ref
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Try to load from session storage first (for non-logged-in users)
    const storedAnalysis = sessionStorage.getItem('siteAnalysis');
    if (storedAnalysis) {
      try {
        const data = JSON.parse(storedAnalysis);
        if (data.niche) setNiche(data.niche);
        if (data.keywords?.length || data.flatKeywords?.length) {
          const allKeywords = [...(data.flatKeywords || []), ...(data.keywords || [])]
            .map((k: any) => typeof k === 'string' ? k : k.term)
            .filter(Boolean);
          setKeywords(allKeywords);
        }
        if (data.longTailKeywords?.length || data.flatLongTail?.length) {
          const allLongTail = [...(data.flatLongTail || []), ...(data.longTailKeywords || [])]
            .map((k: any) => typeof k === 'string' ? k : k.term)
            .filter(Boolean);
          setLongTailKeywords(allLongTail);
        }
      } catch (e) {
        console.error('Failed to parse stored analysis:', e);
      }
    }
    
    // CRITICAL FIX: Load SERP analysis from sessionStorage (for non-logged-in users)
    const storedSerpAnalysis = sessionStorage.getItem('serpAnalysis');
    if (storedSerpAnalysis) {
      try {
        const serpData = JSON.parse(storedSerpAnalysis);
        console.log('[content-plan] Loading SERP analysis from sessionStorage:', serpData);
        setSerpInsights(serpData);
        
        // Extract long-tail keywords from SERP analysis
        if (serpData?.keywords) {
          const relatedKws = serpData.keywords
            .flatMap((k: any) => k.relatedKeywords || [])
            .filter((kw: string, i: number, arr: string[]) => arr.indexOf(kw) === i)
            .slice(0, 10);
          if (relatedKws.length) {
            setLongTailKeywords((prev) => {
              const combined = [...new Set([...prev, ...relatedKws])];
              return combined.slice(0, 20);
            });
          }
        }
      } catch (e) {
        console.error('Failed to parse stored SERP analysis:', e);
      }
    }
    
    // If user is logged in, load from database (overrides session storage)
    if (!user) {
      setProfileLoading(false);
      return;
    }
    
    const controller = new AbortController();

    Promise.all([
      supabase
        .from("profiles")
        .select("niche, keywords, org_goals, org_vision")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("serp_analyses" as any)
        .select("analysis, keywords")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("content_plans" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([profileRes, serpRes, planRes]) => {
      if (controller.signal.aborted) return;

      if (profileRes.data?.niche != null) setNiche(profileRes.data.niche ?? "");
      if (profileRes.data?.keywords?.length) setKeywords(profileRes.data.keywords);
      if ((profileRes.data as any)?.org_goals != null) setOrgGoals((profileRes.data as any).org_goals ?? "");
      if ((profileRes.data as any)?.org_vision != null) setOrgVision((profileRes.data as any).org_vision ?? "");

      if (serpRes.data) {
        setSerpInsights((serpRes.data as any).analysis);
        const analysis = (serpRes.data as any).analysis;
        if (analysis?.keywords) {
          const relatedKws = analysis.keywords
            .flatMap((k: any) => k.relatedKeywords || [])
            .filter((kw: string, i: number, arr: string[]) => arr.indexOf(kw) === i)
            .slice(0, 10);
          if (relatedKws.length) setLongTailKeywords(relatedKws);
        }
      }

      if (planRes.data) {
        const saved = planRes.data as any;
        setSavedPlanId(saved.id);
        setPlan(saved.items || []);
        if (saved.tone) setTone(saved.tone);
        if (!profileRes.data?.niche && saved.niche) setNiche(saved.niche);
        if (!profileRes.data?.keywords?.length && saved.keywords?.length) setKeywords(saved.keywords);
        if (saved.long_tail_keywords?.length) setLongTailKeywords(saved.long_tail_keywords);
      }

      setProfileLoading(false);
    });

    return () => controller.abort();
  }, [user]);

  const savePlanData = useCallback(
    async (planItems: ContentItem[], planId: string | null): Promise<string | null> => {
      if (!user || planItems.length === 0) return planId;
      const payload = {
        user_id: user.id,
        niche,
        keywords,
        long_tail_keywords: longTailKeywords,
        days,
        tone,
        items: planItems,
      };
      if (planId) {
        const { error } = await supabase
          .from("content_plans" as any)
          .update(payload as any)
          .eq("id", planId);
        if (error) throw error;
        return planId;
      } else {
        const { data, error } = await supabase
          .from("content_plans" as any)
          .insert(payload as any)
          .select("id")
          .single();
        if (error) throw error;
        return (data as any)?.id || null;
      }
    },
    [user, niche, keywords, longTailKeywords, tone, days]
  );

  const debouncedAutoSave = useCallback(
    (updatedPlan: ContentItem[]) => {
      if (!savedPlanId) return;
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(async () => {
        try {
          await savePlanData(updatedPlan, savedPlanId);
        } catch {
          // silent fail for auto-save
        }
      }, 1500);
    },
    [savedPlanId, savePlanData]
  );

  const generate = useCallback(async () => {
    if (!niche) {
      toast({ title: "No niche set", description: "Please enter a niche first.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setGenerationProgress(0);

    // Simulate progress steps
    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => Math.min(prev + Math.random() * 12, 90));
    }, 800);

    try {
      // Step 1: Fetch content intelligence for primary keywords
      let intelligenceData: any = null;
      try {
        setGenerationProgress(10);
        const primaryKeyword = keywords[0] || niche;
        const { data: intelligence, error: intError } = await supabase.functions.invoke("content-intelligence", {
          body: {
            keyword: primaryKeyword,
            userId: user?.id,
            includeOutline: true,
            includeHeadings: true,
            includeFAQ: true,
          },
        });
        
        if (!intError && intelligence) {
          intelligenceData = intelligence;
          setContentIntelligence(intelligence);
          
          // Extract long-tail keywords from FAQ questions and entities
          const faqKeywords = intelligence.faq?.questions?.map((q: any) => q.question).slice(0, 5) || [];
          const entityKeywords = intelligence.entities?.required?.slice(0, 5) || [];
          const newLongTail = [...new Set([...longTailKeywords, ...faqKeywords, ...entityKeywords])];
          setLongTailKeywords(newLongTail.slice(0, 15));
        }
      } catch (e) {
        console.log('[content-plan] Content intelligence fetch failed, continuing with SERP data:', e);
      }
      
      // Step 2: Re-fetch latest SERP analysis to ensure fresh data
      setGenerationProgress(30);
      let freshSerpInsights = serpInsights;
      
      // Try database first (for logged-in users)
      if (user) {
        try {
          const { data: freshSerp } = await supabase
            .from("serp_analyses" as any)
            .select("analysis, keywords")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (freshSerp) {
            freshSerpInsights = (freshSerp as any).analysis;
            setSerpInsights(freshSerpInsights);
            console.log('[content-plan] Loaded SERP insights from database');
            // Also update long-tail keywords from fresh SERP
            const analysis = (freshSerp as any).analysis;
            if (analysis?.keywords) {
              const relatedKws = analysis.keywords
                .flatMap((k: any) => k.relatedKeywords || [])
                .filter((kw: string, i: number, arr: string[]) => arr.indexOf(kw) === i)
                .slice(0, 10);
              if (relatedKws.length) setLongTailKeywords((prev) => [...new Set([...prev, ...relatedKws])].slice(0, 15));
            }
          }
        } catch (e) {
          console.log('[content-plan] Database SERP fetch failed, trying sessionStorage:', e);
        }
      }
      
      // Fallback to sessionStorage (for non-logged-in users or if database fetch failed)
      if (!freshSerpInsights) {
        try {
          const storedSerpAnalysis = sessionStorage.getItem('serpAnalysis');
          if (storedSerpAnalysis) {
            const serpData = JSON.parse(storedSerpAnalysis);
            freshSerpInsights = serpData;
            setSerpInsights(serpData);
            console.log('[content-plan] Loaded SERP insights from sessionStorage');
            
            // Extract long-tail keywords from SERP analysis
            if (serpData?.keywords) {
              const relatedKws = serpData.keywords
                .flatMap((k: any) => k.relatedKeywords || [])
                .filter((kw: string, i: number, arr: string[]) => arr.indexOf(kw) === i)
                .slice(0, 10);
              if (relatedKws.length) {
                setLongTailKeywords((prev) => [...new Set([...prev, ...relatedKws])].slice(0, 15));
              }
            }
          }
        } catch (e) {
          console.error('[content-plan] Failed to load SERP from sessionStorage:', e);
        }
      }

      setGenerationProgress(50);
      const allKeywords = [...keywords, ...longTailKeywords];
      const { data, error } = await supabase.functions.invoke("generate-content-plan", {
        body: {
          niche,
          keywords: allKeywords,
          longTailKeywords,
          days,
          tone,
          serpInsights: freshSerpInsights || undefined,
          contentIntelligence: intelligenceData || undefined,
          orgGoals: orgGoals || undefined,
          orgVision: orgVision || undefined,
        },
      });

      // Surface the exact error so user can see what failed
      if (error) throw new Error(error.message || JSON.stringify(error));
      if (data?.error) throw new Error(data.error);

      clearInterval(progressInterval);
      setGenerationProgress(100);

      const newPlan: ContentItem[] = data.plan || [];
      if (newPlan.length === 0) throw new Error("AI returned an empty plan. Please try again.");

      setPlan(newPlan);

      // Save to DB only when logged in
      if (user) {
        const id = await savePlanData(newPlan, savedPlanId);
        setSavedPlanId(id);
      }

      toast({
        title: `✅ Real content plan ready!`,
        description: `${newPlan.length} posts from live Google data (${data.meta?.dataSource ?? "AI"}).`,
      });
    } catch (e: any) {
      clearInterval(progressInterval);
      const msg = e?.message || "Failed to generate content plan. Please try again.";
      console.error("[content-plan] generation error:", msg);
      // Always show the real error — never silently fall back to demo
      toast({
        title: "Generation failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
      setTimeout(() => setGenerationProgress(0), 1000);
    }
  }, [niche, keywords, longTailKeywords, days, tone, serpInsights, orgGoals, orgVision, savedPlanId, savePlanData, toast, user]);

  const savePlan = useCallback(async () => {
    if (!user || plan.length === 0) return;
    setSaving(true);
    try {
      const id = await savePlanData(plan, savedPlanId);
      setSavedPlanId(id);
      toast({ title: "Plan saved!", description: "Your content plan has been stored." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [user, plan, savedPlanId, savePlanData, toast]);

  const updateItem = useCallback(
    (idx: number, updates: Partial<ContentItem>) => {
      const updated = plan.map((item, i) => (i === idx ? { ...item, ...updates } : item));
      setPlan(updated);
      debouncedAutoSave(updated);
    },
    [plan, debouncedAutoSave]
  );

  const removeItem = useCallback(
    (idx: number) => {
      const updated = plan.filter((_, i) => i !== idx);
      setPlan(updated);
      debouncedAutoSave(updated);
    },
    [plan, debouncedAutoSave]
  );

  const generateBrief = useCallback(
    async (idx: number) => {
      const item = plan[idx];
      if (!item) return;

      // Mark as generating
      const withFlag = plan.map((p, i) =>
        i === idx ? { ...p, brief_generating: true } : p
      );
      setPlan(withFlag);

      try {
        const { data, error } = await supabase.functions.invoke("generate-writing-brief", {
          body: {
            title: item.title,
            type: item.type,
            keyword: item.keyword,
            long_tail_keyword: item.long_tail_keyword,
            description: item.description,
            niche,
            tone,
          },
        });

        if (error) throw new Error(error.message || "Brief generation failed");
        if (data?.error) throw new Error(data.error);

        const brief: string = data?.writing_brief ?? "";
        if (!brief) throw new Error("AI returned an empty brief. Please try again.");

        const updated = plan.map((p, i) =>
          i === idx ? { ...p, writing_brief: brief, brief_generating: false } : p
        );
        setPlan(updated);
        debouncedAutoSave(updated);

        toast({ title: "✅ Writing brief ready!", description: `Brief generated for Day ${item.day}.` });
      } catch (e: any) {
        // Clear generating flag on error
        const reset = plan.map((p, i) =>
          i === idx ? { ...p, brief_generating: false } : p
        );
        setPlan(reset);
        toast({
          title: "Brief generation failed",
          description: e.message || "Please try again.",
          variant: "destructive",
        });
      }
    },
    [plan, niche, tone, debouncedAutoSave, toast]
  );

  return {
    user,
    signOut,
    authLoading,
    profileLoading,
    niche,
    setNiche,
    keywords,
    setKeywords,
    longTailKeywords,
    tone,
    setTone,
    plan,
    generating,
    generationProgress,
    saving,
    savedPlanId,
    serpInsights,
    contentIntelligence,
    orgGoals,
    orgVision,
    setOrgGoals,
    setOrgVision,
    generate,
    savePlan,
    updateItem,
    removeItem,
    generateBrief,
    navigate,
  };
}
