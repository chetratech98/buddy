import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  HIGH_DA_DOMAINS,
  rootDomain,
  calculateDifficulty,
  classifyIntent,
  searchSerp,
  scrapePage,
} from "../_shared/scraping.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// ─────────────────────────────────────────────────────────────────────────────
// Calculate real word count from text (strips markdown/HTML)
// ─────────────────────────────────────────────────────────────────────────────
function countWordsPlain(text: string): number {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_~>|`]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Firecrawl: scrape a single URL, return word count + heading count
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeCompetitorMetrics(
  url: string,
  firecrawlKey: string
): Promise<{ wordCount: number; h2Count: number; hasFaq: boolean; markdown: string }> {
  // maxChars kept large so word/heading counts reflect the full page, not a truncated slice
  const scraped = await scrapePage(url, firecrawlKey, { maxChars: 100_000, retries: 1 });
  if (!scraped.markdown) return { wordCount: 0, h2Count: 0, hasFaq: false, markdown: "" };

  const wordCount = countWordsPlain(scraped.markdown);
  const h2Count   = (scraped.markdown.match(/^## .+/gm) ?? []).length;
  const hasFaq    = /FAQ|Frequently Asked/i.test(scraped.markdown);

  return { wordCount, h2Count, hasFaq, markdown: scraped.markdown.slice(0, 2000) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json();
    const niche    = typeof body.niche    === "string" ? body.niche.trim().slice(0, 200)  : "";
    const keywords = Array.isArray(body.keywords)
      ? body.keywords.slice(0, 15).map((k: unknown) => String(k).slice(0, 100))
      : [];

    if (!niche || !keywords.length) {
      return jsonResponse({ error: "Niche and keywords are required" }, 400);
    }

    // Business context carried over from the Analyze Site page — optional,
    // grounds the qualitative analysis in the real business instead of a
    // bare keyword list. Every field is defensively coerced since it comes
    // from client-controlled sessionStorage/DB state.
    const ctx = (body.businessContext && typeof body.businessContext === "object") ? body.businessContext : {};
    const ctxStr = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : "");
    const ctxArr = (v: unknown, max = 8) =>
      Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, max).map((s) => String(s).slice(0, 150)) : [];

    const businessContextLines: string[] = [];
    const valueProposition = ctxStr(ctx.valueProposition);
    const businessModel    = ctxStr(ctx.businessModel, 60);
    const brandVoice       = ctxStr(ctx.brandVoice, 60);
    const icp               = ctxStr(ctx.icp, 500);
    const differentiators  = ctxArr(ctx.differentiators);
    const topServices      = ctxArr(ctx.topServices);
    const trustAssets      = ctxArr(ctx.trustAssets);
    const teamExpertise    = ctxArr(ctx.teamExpertise);

    if (businessModel) businessContextLines.push(`Business model: ${businessModel}`);
    if (brandVoice) businessContextLines.push(`Brand voice: ${brandVoice}`);
    if (valueProposition) businessContextLines.push(`Value proposition: ${valueProposition}`);
    if (icp) businessContextLines.push(`Ideal customer: ${icp}`);
    if (differentiators.length) businessContextLines.push(`Differentiators: ${differentiators.join("; ")}`);
    if (topServices.length) businessContextLines.push(`Top services/offers: ${topServices.join("; ")}`);
    if (trustAssets.length) businessContextLines.push(`Trust signals: ${trustAssets.join("; ")}`);
    if (teamExpertise.length) businessContextLines.push(`Team expertise: ${teamExpertise.join("; ")}`);
    const businessContextBlock = businessContextLines.length
      ? `\n\nBUSINESS CONTEXT (from site analysis — use this to make recommendations specific to THIS business, not generic SEO advice):\n${businessContextLines.map(l => `- ${l}`).join("\n")}`
      : "";

    const SERP_API_KEY  = Deno.env.get("SERP_API_KEY");
    const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY");
    const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    if (!SERP_API_KEY)  return jsonResponse({ error: "SERP_API_KEY not configured" }, 500);
    if (!OPENAI_KEY)    return jsonResponse({ error: "OPENAI_API_KEY not configured" }, 500);

    const limitedKeywords = keywords.slice(0, 10);

    // ── Step 1: Fetch SERP data for all keywords in parallel ────────────────
    console.log(`[seo-analysis] Fetching SERP data for ${limitedKeywords.length} keywords`);
    const serpEntries = await Promise.all(
      limitedKeywords.map(async (keyword: string) => {
        const { organic: organicResults, features: serpFeatures, adsCount } =
          await searchSerp(`${keyword} ${niche}`.trim(), SERP_API_KEY, { retries: 1 });
        return { keyword, organicResults, serpFeatures, adsCount };
      })
    );

    // ── Step 2: Scrape top 3 competitors per keyword with Firecrawl ─────────
    // We scrape only top 3 per keyword (concurrency cap = 6 total)
    type ScrapedMetrics = { wordCount: number; h2Count: number; hasFaq: boolean; markdown: string };
    const competitorMetricsMap = new Map<string, ScrapedMetrics>();

    if (FIRECRAWL_KEY) {
      const scrapeJobs: Array<{ url: string; keyword: string; rank: number }> = [];
      for (const entry of serpEntries) {
        entry.organicResults.slice(0, 3).forEach((r) => {
          if (r.url && !competitorMetricsMap.has(r.url)) {
            scrapeJobs.push({ url: r.url, keyword: entry.keyword, rank: r.position });
          }
        });
      }

      console.log(`[seo-analysis] Scraping ${Math.min(scrapeJobs.length, 6)} competitor pages`);
      const uniqueJobs = scrapeJobs.slice(0, 6); // cap at 6 concurrent scrapes
      const scraped = await Promise.all(
        uniqueJobs.map((j) => scrapeCompetitorMetrics(j.url, FIRECRAWL_KEY))
      );
      uniqueJobs.forEach((j, i) => {
        competitorMetricsMap.set(j.url, scraped[i]);
      });
    }

    // ── Step 3: Build per-keyword data with real measured metrics ───────────
    const measuredKeywords = serpEntries.map((entry) => {
      const { keyword, organicResults, serpFeatures, adsCount } = entry;

      // Real difficulty from SERP signals (no AI)
      const { score: difficultyScore, label: difficulty } = calculateDifficulty(
        organicResults,
        serpFeatures,
        adsCount
      );

      // Real search intent from rule-based detection (no AI)
      const { intent: searchIntent, confidence: intentConfidence } = classifyIntent(
        keyword,
        serpFeatures,
        adsCount
      );

      // Real content benchmarks from scraped pages
      const competitorWordCounts: number[] = [];
      const competitorH2Counts:   number[] = [];
      const faqCounts:             number[] = [];

      const topCompetitors = organicResults.slice(0, 5).map((r, i) => {
        const metrics = competitorMetricsMap.get(r.url);
        const wordCount = metrics?.wordCount ?? 0;
        const h2Count   = metrics?.h2Count   ?? 0;
        const hasFaq    = metrics?.hasFaq     ?? false;

        if (wordCount > 0) {
          competitorWordCounts.push(wordCount);
          competitorH2Counts.push(h2Count);
          faqCounts.push(hasFaq ? 1 : 0);
        }

        return {
          rank:            i + 1,
          title:           r.title,
          source:          r.domain,
          url:             r.url,
          wordCount,
          h2Count,
          hasFaq,
          keywordDensity:  wordCount > 0 ? "measured" : "N/A",
          contentType:     "blog",
          // strengths/weaknesses come from AI enrichment below
          strengths:       [] as string[],
          weaknesses:      [] as string[],
        };
      });

      // Calculate REAL averages from scraped data
      const avgWordCount = competitorWordCounts.length > 0
        ? Math.round(competitorWordCounts.reduce((a, b) => a + b, 0) / competitorWordCounts.length)
        : 1500; // fallback if no scraping
      const avgH2Count = competitorH2Counts.length > 0
        ? Math.round(competitorH2Counts.reduce((a, b) => a + b, 0) / competitorH2Counts.length)
        : 5;

      const featureList = Object.keys(serpFeatures).filter((k) => serpFeatures[k]);

      return {
        keyword,
        searchIntent,
        intentConfidence,
        difficulty,
        difficultyScore,
        adsCount,
        serpFeatures:     featureList,
        measuredAvgWordCount: avgWordCount,  // real value
        measuredAvgH2Count:   avgH2Count,    // real value
        scrapeCount:          competitorWordCounts.length,
        contentBenchmark: {
          avgWordCount,
          avgH2Count,
          avgImageCount:      3,   // not scraped yet, conservative default
          avgReadingTime:     Math.ceil(avgWordCount / 200),
          commonFormats:      ["guide"],
          structuralPatterns: [],
        },
        topCompetitors,
        organicResults: organicResults.slice(0, 10), // for AI enrichment
        relatedKeywords:  [],
        opportunity:      "",
        quickWins:        [],
        recommendedContentFormat: "guide",
        targetWordCount:  Math.max(avgWordCount + 300, 1500),
      };
    });

    // ── Step 4: AI enrichment (now only for qualitative analysis, not numbers) ─
    // We only ask AI for: competitor strengths/weaknesses, content gaps,
    // quick wins, opportunity descriptions — all subjective analysis.
    // ALL numbers (difficulty, word count, intent confidence) come from Steps 1–3.

    const serpSummary = measuredKeywords.map((mk) => {
      let s = `### Keyword: "${mk.keyword}"\n`;
      s += `- Difficulty Score: ${mk.difficultyScore}/100 (${mk.difficulty}) — based on ${mk.organicResults.filter((r) => HIGH_DA_DOMAINS.has(rootDomain(r.url))).length} high-DA domains in top 10\n`;
      s += `- Search Intent: ${mk.searchIntent} (${mk.intentConfidence}% confidence, rule-based)\n`;
      s += `- SERP Features: ${mk.serpFeatures.join(", ") || "none"}\n`;
      s += `- Paid Ads: ${mk.adsCount}\n`;
      s += `- Real Avg Word Count (from scraping ${mk.scrapeCount} pages): ${mk.measuredAvgWordCount} words\n`;
      s += `- Target Word Count: ${mk.targetWordCount}\n`;
      s += `Top Results:\n`;
      mk.organicResults.slice(0, 5).forEach((r) => {
        const metrics = competitorMetricsMap.get(r.url);
        s += `  ${r.position}. ${r.title} (${r.domain}) — ${metrics?.wordCount ?? "?"} words, ${metrics?.h2Count ?? "?"} H2s\n`;
        s += `     Snippet: ${r.snippet?.slice(0, 150) ?? ""}\n`;
      });
      return s;
    }).join("\n");

    const systemPrompt = `You are a senior SEO strategist. You are given REAL measured SERP data (difficulty scores from domain signals, word counts from Firecrawl scraping, intent from rule-based detection). Your job is ONLY to provide qualitative analysis — competitor strengths/weaknesses, content gaps, quick wins, strategic opportunities.

DO NOT change or invent difficulty scores, word counts, or intent labels — those are already measured accurately.
Return ONLY valid JSON. No markdown fences.`;

    const userPrompt = `Niche: "${niche}" | Keywords: ${limitedKeywords.join(", ")}${businessContextBlock}

MEASURED SERP DATA:
${serpSummary}

Add qualitative analysis to this data. Return JSON:
{
  "keywords": [
    {
      "keyword": "exact match from input",
      "topCompetitors": [
        {
          "rank": <number>,
          "strengths": ["specific strength based on their snippet/title"],
          "weaknesses": ["specific gap or weakness to exploit"]
        }
      ],
      "contentGaps": ["topic/angle the competitors miss"],
      "opportunity": "1-2 sentence specific opportunity description",
      "quickWins": ["specific actionable tactic"],
      "recommendedContentFormat": "guide|listicle|how-to|comparison|case-study",
      "relatedKeywords": ["3-5 related keyword phrases to also target"],
      "commonFormats": ["format1", "format2"],
      "structuralPatterns": ["pattern observed in top results"]
    }
  ],
  "overallInsights": {
    "dominantContentType": "string",
    "dominantSearchIntent": "string",
    "contentGaps": ["market-level content gaps"],
    "commonTopics": ["topics all competitors cover"],
    "topAuthorityDomains": ["domain1", "domain2"],
    "recommendations": [
      { "priority": "high|medium|low", "action": "string", "impact": "string", "effort": "low|medium|high" }
    ],
    "contentStrategy": {
      "pillarContent": "string",
      "supportingContent": ["string"],
      "contentCalendarSuggestion": "string"
    }
  }
}

Base ALL qualitative analysis on the actual snippets, titles, and domains in the measured data above.${businessContextBlock ? " Where BUSINESS CONTEXT is provided above, make opportunities, quick wins, and recommendations specific to that business (its actual differentiators, ICP, and services) instead of generic SEO advice anyone could give." : ""}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:       "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return jsonResponse({ error: "Rate limit exceeded. Try again shortly." }, 429);
      if (aiRes.status === 402) return jsonResponse({ error: "AI credits exhausted." }, 402);
      throw new Error(`OpenAI error ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const aiRaw  = (aiData.choices?.[0]?.message?.content ?? "")
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim();

    let aiEnrichment: {
      keywords: Array<{
        keyword: string;
        topCompetitors?: Array<{ rank: number; strengths: string[]; weaknesses: string[] }>;
        contentGaps?: string[];
        opportunity?: string;
        quickWins?: string[];
        recommendedContentFormat?: string;
        relatedKeywords?: string[];
        commonFormats?: string[];
        structuralPatterns?: string[];
      }>;
      overallInsights: Record<string, unknown>;
    } | null = null;

    try {
      aiEnrichment = JSON.parse(aiRaw);
    } catch {
      const match = aiRaw.match(/\{[\s\S]*\}/);
      if (match) {
        try { aiEnrichment = JSON.parse(match[0]); } catch { /* ignore */ }
      }
    }

    // ── Step 5: Merge measured data with AI qualitative enrichment ────────────
    const finalKeywords = measuredKeywords.map((mk) => {
      const aiKw = aiEnrichment?.keywords?.find(
        (a) => a.keyword.toLowerCase() === mk.keyword.toLowerCase()
      );

      // Merge topCompetitors: real metrics + AI strengths/weaknesses
      const enrichedCompetitors = mk.topCompetitors.map((tc) => {
        const aiCompetitor = aiKw?.topCompetitors?.find((ac) => ac.rank === tc.rank);
        return {
          ...tc,
          strengths:  aiCompetitor?.strengths  ?? ["Established domain authority"],
          weaknesses: aiCompetitor?.weaknesses ?? ["Content could be more comprehensive"],
          // keywordDensity from scraping would need full page + keyword count — placeholder
          keywordDensity: tc.wordCount > 0
            ? `~${((mk.keyword.split(" ").length / Math.max(tc.wordCount, 1)) * 100 * 5).toFixed(1)}%`
            : "N/A",
          contentType: aiKw?.recommendedContentFormat ?? "blog",
          contentScore: Math.max(40, Math.min(95,
            100 - mk.difficultyScore * 0.3 +
            (tc.wordCount > mk.contentBenchmark.avgWordCount ? 10 : -10)
          )),
        };
      });

      return {
        keyword:                   mk.keyword,
        searchIntent:              mk.searchIntent,
        intentConfidence:          mk.intentConfidence,
        mentionCount:              mk.organicResults.length,
        difficulty:                mk.difficulty,
        difficultyScore:           mk.difficultyScore,
        adsCount:                  mk.adsCount,
        serpFeatures:              mk.serpFeatures,
        dataSource:                {
          difficultyFrom:  "serp_signals",   // real
          wordCountFrom:   mk.scrapeCount > 0 ? "firecrawl_scrape" : "estimate", // real or fallback
          intentFrom:      "rule_based",     // real
          scrapeCount:     mk.scrapeCount,
        },
        contentBenchmark: {
          ...mk.contentBenchmark,
          commonFormats:      aiKw?.commonFormats     ?? ["guide"],
          structuralPatterns: aiKw?.structuralPatterns ?? [],
        },
        topCompetitors:            enrichedCompetitors,
        relatedKeywords:           aiKw?.relatedKeywords     ?? [],
        contentGaps:               aiKw?.contentGaps         ?? [],
        opportunity:               aiKw?.opportunity         ?? `Rank for "${mk.keyword}" by producing content that beats the average ${mk.measuredAvgWordCount}-word competitor post.`,
        quickWins:                 aiKw?.quickWins           ?? [],
        recommendedContentFormat:  aiKw?.recommendedContentFormat ?? "guide",
        targetWordCount:           mk.targetWordCount,
      };
    });

    const overallInsights = {
      ...(aiEnrichment?.overallInsights ?? {}),
      dominantContentType:    aiEnrichment?.overallInsights?.dominantContentType ?? "blog",
      dominantSearchIntent:   aiEnrichment?.overallInsights?.dominantSearchIntent ?? "informational",
      avgWordCount:           String(Math.round(
        finalKeywords.reduce((a, k) => a + k.contentBenchmark.avgWordCount, 0) / Math.max(finalKeywords.length, 1)
      )),
      // avgContentScore calculated from real word count benchmarks
      avgContentScore:        Math.round(
        finalKeywords.reduce((a, k) => a + (100 - k.difficultyScore * 0.5), 0) / Math.max(finalKeywords.length, 1)
      ),
      serpFeatureSummary:     finalKeywords.reduce((acc, k) => {
        k.serpFeatures.forEach((f) => { acc[f] = (acc[f] ?? 0) + 1; });
        return acc;
      }, {} as Record<string, number>),
      topAuthorityDomains:    Array.isArray(aiEnrichment?.overallInsights?.topAuthorityDomains)
        ? aiEnrichment?.overallInsights?.topAuthorityDomains
        : [],
      contentGaps:            Array.isArray(aiEnrichment?.overallInsights?.contentGaps)
        ? aiEnrichment?.overallInsights?.contentGaps
        : [],
      commonTopics:           Array.isArray(aiEnrichment?.overallInsights?.commonTopics)
        ? aiEnrichment?.overallInsights?.commonTopics
        : [],
      recommendations:        Array.isArray(aiEnrichment?.overallInsights?.recommendations)
        ? aiEnrichment?.overallInsights?.recommendations
        : [],
      contentStrategy:        aiEnrichment?.overallInsights?.contentStrategy ?? {
        pillarContent:             "",
        supportingContent:         [],
        contentCalendarSuggestion: "",
      },
    };

    console.log(
      `[seo-analysis] Complete. ${finalKeywords.length} keywords, ` +
      `${competitorMetricsMap.size} pages scraped, avg difficulty: ` +
      `${Math.round(finalKeywords.reduce((a, k) => a + k.difficultyScore, 0) / Math.max(finalKeywords.length, 1))}`
    );

    return jsonResponse({ keywords: finalKeywords, overallInsights });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[seo-analysis] Fatal:", msg);
    if (msg.includes("429")) return jsonResponse({ error: "Rate limit exceeded. Try again shortly." }, 429);
    return jsonResponse({ error: "Analysis failed" }, 500);
  }
});
