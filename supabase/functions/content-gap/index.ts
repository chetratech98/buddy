/**
 * content-gap — identifies topics your competitors cover that your draft doesn't.
 *
 * Workflow:
 *   1. Receive drafted content + competitor URLs (or keyword for live fetch)
 *   2. Scrape competitor pages with Firecrawl
 *   3. Extract headings + key topics from each competitor
 *   4. Diff against the draft's headings + topics
 *   5. Return prioritized list of missing topics with recommended additions
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─────────────────────────────────────────────────────────────────────────────
// Extract headings from markdown
// ─────────────────────────────────────────────────────────────────────────────
function extractHeadings(markdown: string): string[] {
  return (markdown.match(/^#{1,3} .+/gm) ?? [])
    .map((h) => h.replace(/^#+\s+/, "").trim())
    .filter((h) => h.length > 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// Extract key phrases using simple n-gram frequency
// Returns the top N most-frequent 2-3 word phrases
// ─────────────────────────────────────────────────────────────────────────────
function extractKeyPhrases(text: string, topN = 20): string[] {
  const stopWords = new Set([
    "the","a","an","and","or","but","in","on","at","to","for","of","with",
    "is","are","was","were","be","been","being","have","has","had","do","does",
    "did","will","would","could","should","may","might","must","can","this","that",
    "these","those","it","its","we","you","your","our","their","there","here","when",
    "what","how","why","who","which","where","i","my","me","us","by","from",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  const phrases = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const bi = `${words[i]} ${words[i + 1]}`;
    phrases.set(bi, (phrases.get(bi) ?? 0) + 1);

    if (i < words.length - 2) {
      const tri = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      phrases.set(tri, (phrases.get(tri) ?? 0) + 1);
    }
  }

  return [...phrases.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([phrase]) => phrase);
}

// ─────────────────────────────────────────────────────────────────────────────
// Scrape URL with Firecrawl, return markdown + metadata
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeUrl(url: string, firecrawlKey: string): Promise<{
  markdown: string;
  title: string;
  wordCount: number;
}> {
  const fallback = { markdown: "", title: url, wordCount: 0 };
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 2000,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return fallback;
    const data = await res.json();
    const markdown: string = data?.data?.markdown || data?.markdown || "";
    const title:    string = data?.data?.metadata?.title || url;
    const wordCount = markdown.split(/\s+/).filter((w) => w.length > 1).length;
    return { markdown: markdown.slice(0, 6000), title, wordCount };
  } catch {
    return fallback;
  }
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
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    // ── Input ─────────────────────────────────────────────────────────────────
    const body = await req.json();
    const draftContent:    string   = typeof body.content  === "string" ? body.content.slice(0, 20000)         : "";
    const targetKeyword:   string   = typeof body.keyword  === "string" ? body.keyword.trim().slice(0, 100)    : "";
    const competitorUrls:  string[] = Array.isArray(body.competitorUrls)
      ? body.competitorUrls.slice(0, 5).filter((u: unknown) => typeof u === "string")
      : [];

    if (!draftContent) return jsonResponse({ error: "Draft content is required" }, 400);
    if (!targetKeyword && competitorUrls.length === 0) {
      return jsonResponse({ error: "Provide a keyword or competitor URLs" }, 400);
    }

    const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY");
    const SERP_API_KEY  = Deno.env.get("SERP_API_KEY");
    const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    if (!OPENAI_KEY)    throw new Error("OPENAI_API_KEY not configured");
    if (!FIRECRAWL_KEY) {
      return jsonResponse({
        error: "FIRECRAWL_API_KEY not configured — content gap analysis requires web scraping",
      }, 500);
    }

    // ── Fetch competitor URLs from SerpApi if not provided ───────────────────
    let urlsToScrape = [...competitorUrls];

    if (urlsToScrape.length === 0 && SERP_API_KEY && targetKeyword) {
      try {
        const serpUrl = new URL("https://serpapi.com/search.json");
        serpUrl.searchParams.set("q", targetKeyword);
        serpUrl.searchParams.set("api_key", SERP_API_KEY);
        serpUrl.searchParams.set("engine", "google");
        serpUrl.searchParams.set("num", "5");

        const serpRes = await fetch(serpUrl.toString(), { signal: AbortSignal.timeout(10000) });
        if (serpRes.ok) {
          const serpData = await serpRes.json();
          urlsToScrape = (serpData.organic_results ?? [])
            .slice(0, 5)
            .map((r: any) => r.link)
            .filter(Boolean);
        }
      } catch {
        // continue without SERP
      }
    }

    if (urlsToScrape.length === 0) {
      return jsonResponse({ error: "Could not find competitor URLs for analysis" }, 400);
    }

    // ── Scrape competitors ────────────────────────────────────────────────────
    console.log(`[content-gap] Scraping ${urlsToScrape.length} competitor pages`);
    const scraped = await Promise.all(
      urlsToScrape.map((url) => scrapeUrl(url, FIRECRAWL_KEY))
    );

    // ── Extract headings + key phrases from each competitor ──────────────────
    const competitorData = scraped
      .filter((s) => s.markdown.length > 200) // skip failed scrapes
      .map((s, i) => ({
        url:        urlsToScrape[i],
        title:      s.title,
        wordCount:  s.wordCount,
        headings:   extractHeadings(s.markdown),
        keyPhrases: extractKeyPhrases(s.markdown, 25),
      }));

    if (competitorData.length === 0) {
      return jsonResponse({ error: "Could not scrape any competitor content" }, 400);
    }

    // ── Extract headings + key phrases from draft ─────────────────────────────
    const draftHeadings   = extractHeadings(draftContent);
    const draftKeyPhrases = extractKeyPhrases(draftContent, 40);
    const draftLower      = draftContent.toLowerCase();

    // ── Find topics competitors cover that draft doesn't ─────────────────────
    // Union of all competitor headings
    const allCompetitorHeadings = [...new Set(
      competitorData.flatMap((c) => c.headings)
    )];
    const allCompetitorPhrases = [...new Set(
      competitorData.flatMap((c) => c.keyPhrases)
    )];

    // A competitor heading is "missing" from the draft if:
    // 1. It doesn't appear in any draft heading
    // 2. The concept isn't covered in the draft body text either
    const missingHeadings = allCompetitorHeadings.filter((ch) => {
      const normalized = ch.toLowerCase();
      const inDraftHeadings = draftHeadings.some((dh) =>
        dh.toLowerCase().includes(normalized) || normalized.includes(dh.toLowerCase())
      );
      const inDraftBody = draftLower.includes(normalized);
      return !inDraftHeadings && !inDraftBody;
    });

    // Missing key phrases (appeared in 2+ competitors but not in draft)
    const phraseCoverage = allCompetitorPhrases.map((phrase) => ({
      phrase,
      competitorCount: competitorData.filter((c) =>
        c.keyPhrases.includes(phrase)
      ).length,
      inDraft: draftLower.includes(phrase),
    }));

    const missingPhrases = phraseCoverage
      .filter((p) => p.competitorCount >= 2 && !p.inDraft)
      .sort((a, b) => b.competitorCount - a.competitorCount)
      .slice(0, 15);

    // ── AI: Prioritize and explain the gaps ──────────────────────────────────
    const gapContext = `
Draft headings: ${draftHeadings.slice(0, 15).join(" | ") || "None"}
Draft word count: ~${draftContent.split(/\s+/).length}
Target keyword: ${targetKeyword || "not specified"}

Competitor analysis:
${competitorData.map((c, i) => `
Competitor ${i + 1}: ${c.title} (${c.wordCount} words)
  Headings: ${c.headings.slice(0, 8).join(" | ")}
  Key phrases: ${c.keyPhrases.slice(0, 10).join(", ")}
`).join("")}

Topics in competitors NOT in draft:
Headings: ${missingHeadings.slice(0, 20).join(" | ") || "None"}
Phrases (covered by 2+ competitors): ${missingPhrases.map((p) => `"${p.phrase}" (${p.competitorCount} competitors)`).join(", ") || "None"}
`;

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
          {
            role: "system",
            content: `You are an expert SEO content strategist. Based on competitor analysis data, identify the most important content gaps and provide specific, actionable recommendations to improve the draft. Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Analyze these content gaps and prioritize the most impactful improvements:\n\n${gapContext}\n\nReturn JSON:\n{\n  "gaps": [\n    {\n      "topic": "missing topic or heading",\n      "priority": "critical|high|medium|low",\n      "reason": "why this gap matters for SEO and readers",\n      "suggestedHeading": "## Exact heading to add",\n      "suggestedContent": "2-3 sentence outline of what to write in this section",\n      "competitorCount": <number of competitors covering this>\n    }\n  ],\n  "summary": {\n    "totalGaps": <number>,\n    "criticalGaps": <number>,\n    "estimatedWordsToAdd": <number>,\n    "topRecommendation": "single most important action to take"\n  }\n}\n\nOrder by priority (critical first). Max 10 gaps.`,
          },
        ],
      }),
    });

    let gapAnalysis: {
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
    } = {
      gaps: [],
      summary: {
        totalGaps:            missingHeadings.length,
        criticalGaps:         0,
        estimatedWordsToAdd:  missingHeadings.length * 200,
        topRecommendation:    "Add the missing sections identified above",
      },
    };

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const raw = (aiData.choices?.[0]?.message?.content ?? "")
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/gi, "")
        .trim();
      try {
        gapAnalysis = JSON.parse(raw);
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          try { gapAnalysis = JSON.parse(match[0]); } catch { /* use defaults */ }
        }
      }
    }

    console.log(
      `[content-gap] Found ${gapAnalysis.gaps.length} gaps, ` +
      `${gapAnalysis.summary?.criticalGaps ?? 0} critical, ` +
      `${competitorData.length} competitors scraped`
    );

    return jsonResponse({
      gaps:            gapAnalysis.gaps,
      summary:         gapAnalysis.summary,
      draftMetrics: {
        headingCount: draftHeadings.length,
        wordCount:    draftContent.split(/\s+/).filter((w) => w.length > 1).length,
        headings:     draftHeadings,
      },
      competitorsSummary: competitorData.map((c) => ({
        url:       c.url,
        title:     c.title,
        wordCount: c.wordCount,
        headings:  c.headings.slice(0, 8),
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[content-gap] Error:", msg);
    return jsonResponse({ error: "Content gap analysis failed" }, 500);
  }
});
