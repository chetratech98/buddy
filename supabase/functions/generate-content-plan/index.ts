/**
 * generate-content-plan
 *
 * REAL DATA PIPELINE (no hallucination):
 *   1. For each primary keyword (up to 5), query SerpApi:
 *      - organic_results   → real competitor titles & domains
 *      - related_questions → "People Also Ask" (actual user questions)
 *      - related_searches  → real long-tail keyword ideas
 *      - ads_count         → commercial intent signal
 *      - total_results     → volume proxy
 *   2. Build a rich data context from that live Google data
 *   3. GPT generates a 30-day plan using ONLY real discovered topics
 *   4. QA pass validates structure and ensures no duplicates
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// ─────────────────────────────────────────────────────────────────────────────
// SerpApi: fetch live Google data for one keyword
// Returns: top competitors, People Also Ask, related searches, intent signals
// ─────────────────────────────────────────────────────────────────────────────
interface SerpKeywordData {
  keyword: string;
  totalResults: number;
  adsCount: number;
  competitors: Array<{ position: number; title: string; domain: string }>;
  peopleAlsoAsk: string[];      // real questions users type into Google
  relatedSearches: string[];    // real related queries from Google
  serpFeatures: string[];       // featured_snippet, video_carousel, etc.
  intent: "informational" | "commercial" | "transactional" | "navigational";
}

async function fetchSerpData(keyword: string, apiKey: string): Promise<SerpKeywordData | null> {
  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("q",       keyword);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("engine",  "google");
    url.searchParams.set("num",     "10");
    url.searchParams.set("gl",      "us");
    url.searchParams.set("hl",      "en");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
    if (!res.ok) {
      console.warn(`[serp] ${keyword}: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();

    // Competitors: top organic titles
    const competitors = (data.organic_results ?? []).slice(0, 8).map((r: any) => ({
      position: r.position ?? 0,
      title:    (r.title ?? "").slice(0, 120),
      domain:   (() => { try { return new URL(r.link ?? "").hostname.replace(/^www\./, ""); } catch { return ""; } })(),
    }));

    // People Also Ask: real user questions
    const peopleAlsoAsk: string[] = (data.related_questions ?? [])
      .slice(0, 8)
      .map((q: any) => (q.question ?? "").trim())
      .filter(Boolean);

    // Related searches: real long-tail variations
    const relatedSearches: string[] = (data.related_searches ?? [])
      .slice(0, 10)
      .map((s: any) => (s.query ?? "").trim())
      .filter(Boolean);

    // SERP features present
    const serpFeatures: string[] = [];
    if (data.answer_box)          serpFeatures.push("featured_snippet");
    if (data.knowledge_graph)     serpFeatures.push("knowledge_graph");
    if (data.related_questions?.length) serpFeatures.push("people_also_ask");
    if (data.inline_videos?.length)     serpFeatures.push("video_carousel");
    if (data.top_stories?.length)       serpFeatures.push("top_stories");
    if (data.shopping_results?.length)  serpFeatures.push("shopping");

    // Ads count
    const adsCount = (data.ads ?? []).length;

    // Total results (volume proxy)
    const totalResults = parseInt(
      (data.search_information?.total_results ?? "0").toString().replace(/,/g, ""),
      10
    ) || 0;

    // Infer intent
    const kw = keyword.toLowerCase();
    let intent: SerpKeywordData["intent"] = "informational";
    if (/\b(buy|price|cost|cheap|deal|order|purchase|shop)\b/.test(kw)) intent = "transactional";
    else if (/\b(best|top|review|vs|compare|alternative)\b/.test(kw) || adsCount >= 3) intent = "commercial";
    else if (/^how to |^what is |^why |^guide|tutorial|tips/.test(kw)) intent = "informational";

    return { keyword, totalResults, adsCount, competitors, peopleAlsoAsk, relatedSearches, serpFeatures, intent };
  } catch (err) {
    console.warn(`[serp] ${keyword} failed:`, err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the SERP intelligence context string for GPT
// ─────────────────────────────────────────────────────────────────────────────
function buildSerpContext(serpResults: SerpKeywordData[]): string {
  if (!serpResults.length) return "";

  let ctx = "\n\n=== LIVE GOOGLE SERP INTELLIGENCE ===\n";
  ctx += "These are real data points from current Google results. Base the content plan on these real topics, questions, and gaps.\n\n";

  for (const d of serpResults) {
    ctx += `## Keyword: "${d.keyword}"\n`;
    ctx += `- Search Intent: ${d.intent}\n`;
    ctx += `- Commercial Signal: ${d.adsCount} ads → ${d.adsCount >= 4 ? "high buyer intent" : d.adsCount >= 2 ? "moderate commercial" : "informational focus"}\n`;
    ctx += `- Volume Proxy: ${d.totalResults.toLocaleString()} results\n`;

    if (d.serpFeatures.length) {
      ctx += `- SERP Features: ${d.serpFeatures.join(", ")}\n`;
      if (d.serpFeatures.includes("featured_snippet"))
        ctx += `  → OPPORTUNITY: Write a concise definition paragraph + structured list to target the featured snippet\n`;
      if (d.serpFeatures.includes("people_also_ask"))
        ctx += `  → OPPORTUNITY: Include an FAQ section answering the People Also Ask questions below\n`;
      if (d.serpFeatures.includes("video_carousel"))
        ctx += `  → Note: Video carousels are present — consider a "how to" format to compete\n`;
    }

    if (d.competitors.length) {
      ctx += `- Top Competitors (real titles ranking now):\n`;
      d.competitors.slice(0, 5).forEach((c) => {
        ctx += `  ${c.position}. "${c.title}" — ${c.domain}\n`;
      });
    }

    if (d.peopleAlsoAsk.length) {
      ctx += `- People Also Ask (REAL user questions — use these as blog post titles or H2 headings):\n`;
      d.peopleAlsoAsk.forEach((q) => ctx += `  • ${q}\n`);
    }

    if (d.relatedSearches.length) {
      ctx += `- Related Searches (REAL long-tail variations — use as keyword targets):\n`;
      d.relatedSearches.forEach((s) => ctx += `  • ${s}\n`);
    }

    ctx += "\n";
  }

  // Overall content gap note
  const allPAA = serpResults.flatMap((d) => d.peopleAlsoAsk);
  const allRelated = serpResults.flatMap((d) => d.relatedSearches);
  ctx += `## Content Gaps Identified\n`;
  ctx += `${allPAA.length} unanswered user questions found across all keywords.\n`;
  ctx += `${allRelated.length} related search variations to target.\n`;
  ctx += `Create blog posts that directly answer the People Also Ask questions — these are proven content gaps with real search demand.\n`;

  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ── Auth (optional — app runs with auth bypassed) ────────────────────────
    // No hard auth block; anyone with the anon key can call this function.
    // DB saves are handled client-side only when a session exists.

    // ── Input validation ─────────────────────────────────────────────────────
    const body = await req.json();
    const niche          = typeof body.niche === "string" ? body.niche.trim().slice(0, 200) : "";
    const keywords: string[] = Array.isArray(body.keywords)
      ? body.keywords.slice(0, 20).map((k: any) => String(k).slice(0, 100)).filter(Boolean)
      : [];
    const longTailKeywords: string[] = Array.isArray(body.longTailKeywords)
      ? body.longTailKeywords.slice(0, 20).map((k: any) => String(k).slice(0, 200)).filter(Boolean)
      : [];
    const days     = typeof body.days === "number" && body.days >= 1 && body.days <= 90 ? Math.floor(body.days) : 30;
    const tone     = typeof body.tone === "string" ? body.tone.trim().slice(0, 50) : "professional";
    const orgGoals = typeof body.orgGoals === "string" ? body.orgGoals.trim().slice(0, 1000) : "";
    const orgVision = typeof body.orgVision === "string" ? body.orgVision.trim().slice(0, 1000) : "";

    if (!niche) return json({ error: "Niche is required" }, 400);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SERP_API_KEY   = Deno.env.get("SERP_API_KEY");

    if (!OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY is not configured in Supabase secrets" }, 500);

    // ── Step 1: Live SerpApi research ────────────────────────────────────────
    let serpContext = "";
    let serpDataSummary = "";

    if (SERP_API_KEY && keywords.length > 0) {
      console.log(`[content-plan] Fetching live SERP data for ${Math.min(keywords.length, 5)} keywords...`);
      const keywordsToCheck = keywords.slice(0, 5); // respect rate limits

      // Sequential requests (SerpApi free tier rate limit)
      const serpResults: SerpKeywordData[] = [];
      for (const kw of keywordsToCheck) {
        const result = await fetchSerpData(kw, SERP_API_KEY);
        if (result) serpResults.push(result);
        if (keywordsToCheck.indexOf(kw) < keywordsToCheck.length - 1) {
          await new Promise((r) => setTimeout(r, 600)); // 600ms between requests
        }
      }

      console.log(`[content-plan] Got SERP data for ${serpResults.length}/${keywordsToCheck.length} keywords`);
      serpContext = buildSerpContext(serpResults);

      // Build summary for logging
      const totalPAA = serpResults.reduce((n, d) => n + d.peopleAlsoAsk.length, 0);
      const totalRelated = serpResults.reduce((n, d) => n + d.relatedSearches.length, 0);
      serpDataSummary = `${serpResults.length} keywords researched, ${totalPAA} PAA questions, ${totalRelated} related searches`;
      console.log(`[content-plan] SERP summary: ${serpDataSummary}`);
    } else if (body.serpBriefs?.length) {
      // Preferred: use cluster briefs from the serp-layer auto-blog pipeline
      console.log("[content-plan] Using serp-layer auto-blog briefs");

      // Support both the new nested format and the old flat format
      const isNestedFormat = body.serpBriefs[0]?.keyword_cluster !== undefined;

      if (isNestedFormat) {
        // New nested format from the 8-module pipeline
        const briefs: Array<{
          keyword_cluster:        { primary_keyword: string; secondary_keywords: string[]; serp_cluster_id: string };
          serp_summary:           { dominant_intent: string; shared_patterns: string[] };
          content_recommendation: {
            article_type:           string;
            suggested_title_angles: string[];
            recommended_outline:    string[];
            must_cover_topics:      string[];
            faq_questions:          string[];
            content_gaps_to_win:    string[];
          };
          scoring:  { opportunity_score: number; difficulty_proxy: number; business_relevance: number };
          action:   { decision: string; reason: string };
          _meta?:   { notes_for_planner?: string; dominant_page_types?: string[]; common_headings?: string[] };
        }> = body.serpBriefs;

        // Only use actionable clusters (exclude skip)
        const actionable = briefs.filter((b) => b.action.decision !== "skip");

        serpContext = "\n\n=== AUTO BLOG SERP PIPELINE BRIEFS ===\n";
        serpContext += "Live SERP intelligence with pre-built article outlines and content gaps. ";
        serpContext += "Use suggested_title_angles directly as post titles. Use recommended_outline as the article structure.\n\n";

        for (const b of actionable.slice(0, 12)) {
          const kc  = b.keyword_cluster;
          const ss  = b.serp_summary;
          const cr  = b.content_recommendation;
          const sc  = b.scoring;
          const act = b.action;

          serpContext += `## "${kc.primary_keyword}" [${act.decision} | opportunity: ${sc.opportunity_score}]\n`;
          serpContext += `- Intent: ${ss.dominant_intent} | Article type: ${cr.article_type}\n`;
          if (kc.secondary_keywords?.length)
            serpContext += `- Also targets: ${kc.secondary_keywords.slice(0, 4).join(", ")}\n`;
          if (ss.shared_patterns?.length)
            serpContext += `- Competitors use: ${ss.shared_patterns.join(", ")}\n`;
          if (cr.suggested_title_angles?.length)
            serpContext += `- TITLE OPTIONS (use these): ${cr.suggested_title_angles.slice(0, 3).join(" | ")}\n`;
          if (cr.must_cover_topics?.length)
            serpContext += `- Must cover: ${cr.must_cover_topics.slice(0, 4).join("; ")}\n`;
          if (cr.content_gaps_to_win?.length)
            serpContext += `- Content gaps to win: ${cr.content_gaps_to_win.slice(0, 3).join("; ")}\n`;
          if (cr.faq_questions?.length)
            serpContext += `- FAQ questions: ${cr.faq_questions.slice(0, 3).join(" | ")}\n`;
          if (b._meta?.notes_for_planner)
            serpContext += `- Note: ${b._meta.notes_for_planner}\n`;
          serpContext += "\n";
        }

        const allFAQ = actionable.flatMap((b) => b.content_recommendation.faq_questions ?? []);
        const writeNew = actionable.filter((b) => b.action.decision === "write_new_article").length;
        const refresh  = actionable.filter((b) => b.action.decision === "refresh_existing").length;
        serpContext += `## Pipeline Summary\n`;
        serpContext += `${actionable.length} actionable clusters: ${writeNew} new articles + ${refresh} refreshes. `;
        serpContext += `${allFAQ.length} real PAA questions identified.\n`;
        serpContext += `Use the suggested title angles and must_cover_topics to drive each article idea.\n`;

      } else {
        // Old flat format (backward compat)
        const briefs: Array<{
          primary_keyword:     string;
          secondary_keywords?: string[];
          dominant_intent?:    string;
          intent_confidence?:  number;
          dominant_page_types?:  string[];
          common_questions?:   string[];
          common_headings?:    string[];
          content_gaps?:       string[];
          recommended_page_type?: string;
          suggested_title_angles?: string[];
          notes_for_planner?:  string;
          priority_score?:     number;
        }> = body.serpBriefs;

        serpContext = "\n\n=== SERP CLUSTER BRIEFS ===\n";
        for (const b of briefs.slice(0, 10)) {
          serpContext += `## Cluster: "${b.primary_keyword}" (priority: ${b.priority_score ?? "?"})\n`;
          serpContext += `- Intent: ${b.dominant_intent ?? "unknown"}\n`;
          serpContext += `- Recommended page type: ${b.recommended_page_type ?? "guide"}\n`;
          if (b.secondary_keywords?.length)
            serpContext += `- Also targets: ${b.secondary_keywords.slice(0, 5).join(", ")}\n`;
          if (b.common_questions?.length)
            serpContext += `- PAA questions: ${b.common_questions.slice(0, 4).join(" | ")}\n`;
          if (b.content_gaps?.length)
            serpContext += `- Content gaps: ${b.content_gaps.slice(0, 3).join("; ")}\n`;
          if (b.suggested_title_angles?.length)
            serpContext += `- Suggested titles: ${b.suggested_title_angles.slice(0, 3).join(" | ")}\n`;
          serpContext += "\n";
        }
      }

    } else if (body.serpInsights?.keywords?.length) {
      // Fallback: use pre-existing SERP analysis from seo-analysis function
      console.log("[content-plan] Using pre-existing SERP insights (no SERP_API_KEY or no keywords)");
      const si = body.serpInsights;
      serpContext = "\n\n=== SERP COMPETITIVE INTELLIGENCE (from previous analysis) ===\n";
      for (const kw of si.keywords.slice(0, 8)) {
        serpContext += `## Keyword: "${kw.keyword}"\n`;
        serpContext += `- Intent: ${kw.searchIntent || "unknown"}\n`;
        serpContext += `- Difficulty: ${kw.difficulty || "unknown"}\n`;
        if (kw.relatedKeywords?.length) serpContext += `- Related: ${kw.relatedKeywords.slice(0, 6).join(", ")}\n`;
        serpContext += "\n";
      }
    } else {
      console.log("[content-plan] No SERP data available — generating from niche/keywords only");
    }

    // ── Step 2: Build the AI prompt with real data ────────────────────────────
    const orgContext = (orgGoals || orgVision)
      ? `\n\n=== ORGANIZATION CONTEXT ===\n${orgGoals ? `Goals: ${orgGoals}\n` : ""}${orgVision ? `Vision: ${orgVision}\n` : ""}`
      : "";

    const systemPrompt = `You are an expert SEO content strategist.

${serpContext
  ? `You have been given REAL live Google SERP data below. You MUST:
- Use People Also Ask questions as direct blog post topics (they are proven search demand)
- Use related searches as long_tail_keyword targets
- Create content that fills the gaps competitors haven't covered
- Match the content format to what is ranking (listicles if listicles rank, how-tos if how-tos rank)
- Do NOT invent topics that aren't supported by the research data`
  : `Generate a strategic ${days}-day content plan based on the niche and keywords provided.
Cover a range of content types and keyword variations.`}

Generate a JSON array of exactly ${days} items. Each item MUST have:
- "day": integer (1 to ${days})
- "title": compelling, SEO-optimized post title (ideally 50-60 characters)
- "type": one of "blog" | "listicle" | "how-to" | "case-study" | "opinion"
- "keyword": the primary keyword to target
- "long_tail_keyword": a unique 3-6 word long-tail phrase (different for every item)
- "description": 2 sentences: what the post covers AND the unique angle/value over competitors

RULES:
- Every title must be unique
- Every long_tail_keyword must be unique across the entire plan
- Distribute content types: roughly 30% how-to, 30% listicle, 20% blog, 10% case-study, 10% opinion
- Order: foundational content first (days 1-10), then intermediate (days 11-20), then advanced/opinion (days 21-30)
- Return ONLY a valid JSON array — no markdown fences, no explanations`;

    const userPrompt = `Create a ${days}-day content plan.

Niche: ${niche}
Primary keywords: ${keywords.join(", ")}
${longTailKeywords.length ? `Existing long-tail keywords: ${longTailKeywords.slice(0, 15).join(", ")}` : ""}
Tone: ${tone}
${orgContext}
${serpContext}`;

    // ── Step 3: Generate plan with GPT ────────────────────────────────────────
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.45,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "OpenAI rate limit reached. Please wait a moment and try again." }, 429);
      if (aiRes.status === 402) return json({ error: "OpenAI usage limit reached. Check your billing." }, 402);
      throw new Error(`OpenAI error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const raw    = aiData.choices?.[0]?.message?.content ?? "[]";
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

    let plan: any[];
    try {
      plan = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\[[\s\S]*\]/);
      plan = m ? JSON.parse(m[0]) : [];
    }

    if (!Array.isArray(plan) || plan.length === 0) {
      throw new Error("AI returned an empty plan. Please try again.");
    }

    // ── Step 4: QA / structure validation pass ────────────────────────────────
    const requiredFields = ["day", "title", "type", "keyword", "long_tail_keyword", "description"];
    const validTypes     = new Set(["blog", "listicle", "how-to", "case-study", "opinion"]);

    plan = plan
      .filter((item: any) => typeof item === "object" && item !== null)
      .map((item: any, idx: number) => ({
        day:              typeof item.day === "number" ? item.day : idx + 1,
        title:            String(item.title || `Post ${idx + 1}`).slice(0, 150),
        type:             validTypes.has(item.type) ? item.type : "blog",
        keyword:          String(item.keyword || keywords[0] || niche).slice(0, 100),
        long_tail_keyword: String(item.long_tail_keyword || item.keyword || "").slice(0, 200),
        description:      String(item.description || "").slice(0, 400),
      }))
      .slice(0, days);

    // Ensure unique long_tail_keywords
    const seenLTK = new Set<string>();
    plan = plan.map((item: any) => {
      let ltk = item.long_tail_keyword;
      if (seenLTK.has(ltk)) ltk = `${ltk} ${item.type}`;
      seenLTK.add(ltk);
      return { ...item, long_tail_keyword: ltk };
    });

    console.log(`[content-plan] ✅ Generated ${plan.length} items. ${serpDataSummary ? `SERP: ${serpDataSummary}` : "No SERP data used."}`);

    return json({
      plan,
      meta: {
        serpResearched: !!SERP_API_KEY && keywords.length > 0,
        itemCount:      plan.length,
        dataSource:     body.serpBriefs?.length ? "serp_briefs + openai" : SERP_API_KEY ? "live_serp + openai" : "openai_only",
        serpSummary:    serpDataSummary || null,
      },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[content-plan] Error:", msg);
    return json({ error: msg || "Failed to generate content plan" }, 500);
  }
});
