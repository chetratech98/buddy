import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isUrlSafeToFetch, scrapePage, fetchWithRetry } from "../_shared/scraping.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// ─────────────────────────────────────────────────────────────────────────────
// Standard output extraction
//
// Every field in the response goes through the same normalize-and-default
// pipeline below, regardless of what shape the AI actually returned. This
// guarantees the frontend always receives a predictable, complete shape —
// a missing/malformed field from the model never breaks rendering.
// ─────────────────────────────────────────────────────────────────────────────

const INTENTS = ["informational", "navigational", "commercial", "transactional"] as const;
const DIFFICULTIES = ["low", "medium", "high"] as const;
const PRIORITIES = ["high", "medium", "low"] as const;

type Intent = typeof INTENTS[number];
type Difficulty = typeof DIFFICULTIES[number];
type Priority = typeof PRIORITIES[number];

interface ExtractedKeyword {
  term: string;
  intent: Intent;
  difficulty: Difficulty;
  priority: Priority;
  cluster: string;
}

interface ExtractedLongTail {
  term: string;
  intent: Intent;
  difficulty: Difficulty;
  searchContext: string;
}

interface ExtractedCluster {
  pillar: string;
  supporting: string[];
}

interface ExtractedICP {
  name: string;
  role: string;
  companySize: string;
  description: string;
  painPoints: string[];
  goals: string[];
  buyingTriggers: string[];
  preferredChannels: string[];
}

interface ExtractedAnalysis {
  niche: string;
  subNiches: string[];
  description: string;
  keywords: ExtractedKeyword[];
  longTailKeywords: ExtractedLongTail[];
  topicClusters: ExtractedCluster[];
  competitorKeywordGaps: string[];
  idealCustomerProfiles: ExtractedICP[];
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function strArray(v: unknown, max = 20): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, max);
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function extractKeyword(raw: unknown): ExtractedKeyword | null {
  if (typeof raw === "string") {
    const term = str(raw);
    return term ? { term, intent: "informational", difficulty: "medium", priority: "medium", cluster: "" } : null;
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const term = str(o.term);
    if (!term) return null;
    return {
      term,
      intent: oneOf(o.intent, INTENTS, "informational"),
      difficulty: oneOf(o.difficulty, DIFFICULTIES, "medium"),
      priority: oneOf(o.priority, PRIORITIES, "medium"),
      cluster: str(o.cluster),
    };
  }
  return null;
}

function extractLongTail(raw: unknown): ExtractedLongTail | null {
  if (typeof raw === "string") {
    const term = str(raw);
    return term ? { term, intent: "informational", difficulty: "low", searchContext: "" } : null;
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const term = str(o.term);
    if (!term) return null;
    return {
      term,
      intent: oneOf(o.intent, INTENTS, "informational"),
      difficulty: oneOf(o.difficulty, DIFFICULTIES, "low"),
      searchContext: str(o.searchContext),
    };
  }
  return null;
}

function extractCluster(raw: unknown): ExtractedCluster | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pillar = str(o.pillar);
  if (!pillar) return null;
  return { pillar, supporting: strArray(o.supporting, 8) };
}

function extractICP(raw: unknown): ExtractedICP | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = str(o.name);
  if (!name) return null;
  return {
    name,
    role: str(o.role),
    companySize: str(o.companySize, "N/A"),
    description: str(o.description),
    painPoints: strArray(o.painPoints, 6),
    goals: strArray(o.goals, 6),
    buyingTriggers: strArray(o.buyingTriggers, 5),
    preferredChannels: strArray(o.preferredChannels, 5),
  };
}

/**
 * Pulls a JSON object out of a raw LLM response — strips markdown code
 * fences, and if the model added stray prose outside the JSON block, falls
 * back to grabbing the first {...} region in the text.
 */
function extractJsonObject(raw: string): Record<string, unknown> {
  const stripped = raw.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through to empty object below
      }
    }
    return {};
  }
}

/**
 * Standard extraction pipeline for the whole analysis payload. Every field
 * is independently validated and defaulted here — this is the single place
 * that decides what "a valid analyze-site result" looks like.
 */
function extractAnalysis(rawContent: string): ExtractedAnalysis {
  const parsed = extractJsonObject(rawContent);

  return {
    niche: str(parsed.niche, "Unknown"),
    subNiches: strArray(parsed.subNiches, 6),
    description: str(parsed.description),
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords.map(extractKeyword).filter((k): k is ExtractedKeyword => k !== null)
      : [],
    longTailKeywords: Array.isArray(parsed.longTailKeywords)
      ? parsed.longTailKeywords.map(extractLongTail).filter((k): k is ExtractedLongTail => k !== null)
      : [],
    topicClusters: Array.isArray(parsed.topicClusters)
      ? parsed.topicClusters.map(extractCluster).filter((c): c is ExtractedCluster => c !== null)
      : [],
    competitorKeywordGaps: strArray(parsed.competitorKeywordGaps, 8),
    idealCustomerProfiles: Array.isArray(parsed.idealCustomerProfiles)
      ? parsed.idealCustomerProfiles.map(extractICP).filter((p): p is ExtractedICP => p !== null).slice(0, 5)
      : [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Input validation
    const body = await req.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url || url.length > 500) {
      return new Response(
        JSON.stringify({ error: "A valid URL is required (max 500 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SSRF protection
    const urlCheck = isUrlSafeToFetch(url);
    if (!urlCheck.safe) {
      return new Response(JSON.stringify({ error: urlCheck.reason ?? "Invalid URL" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const normalizedUrl = urlCheck.normalized!;
    const parsedUrl = new URL(normalizedUrl);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    // --- Step 1: Use Firecrawl for high-quality content extraction ---
    let pageContent = "";
    let metaTitle = "";
    let metaDescription = "";
    let headings: string[] = [];
    let links: string[] = [];

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    if (FIRECRAWL_API_KEY) {
      console.log("Using Firecrawl for content extraction:", normalizedUrl);
      const scraped = await scrapePage(normalizedUrl, FIRECRAWL_API_KEY, {
        formats: ["markdown", "links"],
        onlyMainContent: false, // Get full page for meta analysis
        waitFor: 3000,
        maxChars: 8000,
        retries: 1,
      });

      pageContent = scraped.markdown;
      links = scraped.links.slice(0, 50);
      metaTitle = scraped.title;
      metaDescription = scraped.description;

      if (pageContent) {
        const headingMatches = pageContent.match(/^#{1,3}\s+.+$/gm) || [];
        headings = headingMatches.slice(0, 20).map((h: string) => h.replace(/^#+\s+/, ""));
        console.log(`Firecrawl extracted: ${pageContent.length} chars, ${links.length} links, ${headings.length} headings`);
      } else {
        console.warn("Firecrawl returned no content, falling back to basic fetch");
      }
    }

    // Fallback to basic fetch if Firecrawl didn't work
    if (!pageContent) {
      try {
        const pageResp = await fetchWithRetry(
          normalizedUrl,
          {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; BlitzNovaBot/1.0)" },
            signal: AbortSignal.timeout(8000),
          },
          { retries: 1, label: "basic-fetch" }
        );
        const html = await pageResp.text();

        // Extract meta tags
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        metaTitle = titleMatch?.[1]?.trim() || "";
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        metaDescription = descMatch?.[1]?.trim() || "";

        // Extract headings
        const hMatches = html.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi) || [];
        headings = hMatches.slice(0, 20).map((h: string) => h.replace(/<[^>]+>/g, "").trim());

        pageContent = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 6000);
      } catch {
        // Will analyze URL only
      }
    }

    // --- Step 2: Industry-standard SEO analysis prompt ---
    const contextSections: string[] = [];
    contextSections.push(`Target URL: ${url}`);
    contextSections.push(`Domain: ${parsedUrl.hostname}`);

    if (metaTitle) contextSections.push(`Meta Title: ${metaTitle}`);
    if (metaDescription) contextSections.push(`Meta Description: ${metaDescription}`);
    if (headings.length > 0) contextSections.push(`Page Headings:\n${headings.map(h => `- ${h}`).join("\n")}`);
    if (links.length > 0) {
      const internalLinks = links.filter(l => {
        try { return new URL(l).hostname === parsedUrl.hostname; } catch { return false; }
      });
      const externalLinks = links.filter(l => {
        try { return new URL(l).hostname !== parsedUrl.hostname; } catch { return false; }
      });
      contextSections.push(`Internal links found: ${internalLinks.length}`);
      contextSections.push(`External links found: ${externalLinks.length}`);
      if (internalLinks.length > 0) {
        contextSections.push(`Sample internal link paths:\n${internalLinks.slice(0, 15).map(l => `- ${new URL(l).pathname}`).join("\n")}`);
      }
    }
    if (pageContent) contextSections.push(`Page Content:\n${pageContent}`);

    const systemPrompt = `You are a senior SEO strategist with 15+ years of experience in keyword research, competitive analysis, and content strategy. You follow methodologies from Ahrefs, SEMrush, and Moz.

Your analysis must follow these industry-standard practices:
- Keyword selection based on search intent mapping (informational, navigational, commercial, transactional)
- Keywords grouped by topic clusters (pillar + supporting keywords)
- Difficulty estimation based on keyword competitiveness signals
- Focus on keywords with realistic ranking potential for the given domain
- Long-tail keywords that target specific user queries with clear intent

Return ONLY valid JSON. No markdown fences, no explanations outside JSON.`;

    const userPrompt = `Perform a comprehensive SEO keyword analysis for this website:

${contextSections.join("\n\n")}

Analyze the website and return a JSON object with this exact structure:
{
  "niche": "Primary niche/industry (be specific, e.g. 'B2B SaaS Project Management' not just 'Technology')",
  "subNiches": ["2-4 related sub-niches or verticals"],
  "description": "2-3 sentence description of what this business does and who it serves",
  "keywords": [
    {
      "term": "keyword phrase",
      "intent": "informational|navigational|commercial|transactional",
      "difficulty": "low|medium|high",
      "priority": "high|medium|low",
      "cluster": "topic cluster name"
    }
  ],
  "longTailKeywords": [
    {
      "term": "long tail keyword phrase (4+ words)",
      "intent": "informational|navigational|commercial|transactional",
      "difficulty": "low|medium",
      "searchContext": "brief context of when someone would search this"
    }
  ],
  "topicClusters": [
    {
      "pillar": "Main pillar topic",
      "supporting": ["3-5 supporting subtopics"]
    }
  ],
  "competitorKeywordGaps": ["3-5 keyword opportunities competitors likely rank for but this site may not"],
  "idealCustomerProfiles": [
    {
      "name": "Short persona title, e.g. 'Growth-Stage SaaS Marketing Lead'",
      "role": "Job title / role, or business type for B2C (e.g. 'VP of Marketing' or 'Busy home cook')",
      "companySize": "e.g. '11-50 employees', 'Solo founder', or 'N/A' for B2C",
      "description": "1-2 sentence summary of who this person is and why this business fits their needs",
      "painPoints": ["2-4 specific pain points this persona has"],
      "goals": ["2-3 goals this persona is trying to achieve"],
      "buyingTriggers": ["1-3 events or moments that push this persona to look for a solution"],
      "preferredChannels": ["1-3 channels where this persona discovers content or products, e.g. 'LinkedIn', 'Google Search', 'Reddit communities'"]
    }
  ]
}

Requirements:
- Provide 12-18 target keywords with diverse search intents
- Provide 8-12 long-tail keywords (4+ words each)
- Provide 3-5 topic clusters
- Keywords must be specific to this business, not generic industry terms
- Difficulty should reflect real competitiveness (most keywords for smaller sites should be low-medium)
- Priority should consider business impact and ranking feasibility
- Provide EXACTLY 5 distinct Ideal Customer Profiles (idealCustomerProfiles), each representing a genuinely different buyer segment for this specific business — not 5 minor variations of the same persona`;

    const aiResp = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.3,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      }
    );

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", aiResp.status);
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Every field below is guaranteed present with a validated shape —
    // see extractAnalysis() and its per-field helpers above.
    const result = extractAnalysis(content);
    if (result.niche === "Unknown" || result.keywords.length === 0) {
      console.warn(`[analyze-site] Extraction produced a sparse result for ${normalizedUrl} — raw AI content may not have been valid JSON.`);
    }

    // Flat arrays for profile-saving compatibility, derived from the same
    // normalized keyword objects (never a separate parse path).
    const flatKeywords = result.keywords.map((k) => k.term);
    const flatLongTail = result.longTailKeywords.map((k) => k.term);

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...result,
        flatKeywords,
        flatLongTail,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-site error:", e);
    return new Response(
      JSON.stringify({ error: "Analysis failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
