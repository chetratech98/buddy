/**
 * serp-layer — Auto Blog SaaS SERP Intelligence Pipeline
 *
 * 8-module pipeline:
 *   1. Keyword Cleaner    — deduplicate, stem lightly, remove junk
 *   2. Cluster Engine     — group semantic/shared-SERP keywords into article candidates
 *   3. SERP Fetcher       — pull top organic results for each cluster head keyword
 *   4. Page Extractor     — scrape content from top URLs for structure + topic analysis
 *   5. Intent Classifier  — infer dominant search intent from result types + page language
 *   6. Gap Detector       — find topics competitors cover poorly or omit
 *   7. Brief Generator    — produce machine-readable article instructions
 *   8. Decision Engine    — write_new_article vs refresh_existing vs skip
 *
 * Output per cluster (JSON schema):
 * {
 *   keyword_cluster:        { primary_keyword, secondary_keywords, serp_cluster_id }
 *   serp_summary:           { country, language, top_urls, dominant_intent, shared_patterns }
 *   content_recommendation: { article_type, suggested_title_angles, recommended_outline,
 *                             must_cover_topics, faq_questions, content_gaps_to_win }
 *   scoring:                { opportunity_score, difficulty_proxy, business_relevance }
 *   action:                 { decision, reason }
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// ─────────────────────────────────────────────────────────────────────────────
// High-authority domain list (difficulty scoring)
// ─────────────────────────────────────────────────────────────────────────────
const HIGH_DA_DOMAINS = new Set([
  "wikipedia.org","youtube.com","amazon.com","reddit.com","linkedin.com",
  "forbes.com","nytimes.com","wsj.com","techcrunch.com","theguardian.com",
  "bbc.com","bbc.co.uk","cnn.com","huffpost.com","businessinsider.com",
  "healthline.com","webmd.com","mayoclinic.org","nih.gov","cdc.gov",
  "gov.uk","usa.gov","who.int","harvard.edu","mit.edu","stanford.edu",
  "shopify.com","hubspot.com","moz.com","semrush.com","ahrefs.com",
  "medium.com","quora.com","stackoverflow.com","github.com",
  "nerdwallet.com","investopedia.com","bankrate.com","pcmag.com",
  "cnet.com","wired.com","theverge.com","engadget.com","zdnet.com",
]);

function rootDomain(url: string): string {
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return host.replace(/^www\./, "").split(".").slice(-2).join(".");
  } catch { return url; }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1: Keyword Cleaner
// Deduplicate, normalize, remove junk terms
// ─────────────────────────────────────────────────────────────────────────────
const JUNK_PATTERNS = [
  /^\d+$/,            // pure numbers
  /^.{1,2}$/,         // too short
  /[<>{}|\\^~[\]`]/, // special chars
  /^\s*$/, // blank
];

function cleanKeywords(raw: string[]): string[] {
  const seen = new Set<string>();
  return raw
    .map((k) => k.trim().toLowerCase().replace(/\s+/g, " "))
    .filter((k) => {
      if (!k || seen.has(k)) return false;
      if (JUNK_PATTERNS.some((p) => p.test(k))) return false;
      seen.add(k);
      return true;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2: Cluster Engine
// Group keywords by word-overlap similarity (≥50% shared content tokens).
// Cluster head = shortest (broadest) keyword.
// ─────────────────────────────────────────────────────────────────────────────
const STOP = new Set([
  "how","what","why","when","where","which","who","the","a","an","and","or",
  "but","in","on","at","to","for","of","with","is","are","was","were","be",
  "been","have","has","do","does","did","will","would","could","should","may",
  "might","must","can","this","that","these","those","it","its","your","our",
  "best","top","get","make","use","using","used","vs","versus",
]);

function kwTokens(kw: string): Set<string> {
  return new Set(kw.split(/[\s\-_]+/).filter((w) => w.length > 2 && !STOP.has(w)));
}

function clusterKeywords(
  keywords: string[]
): Array<{ head: string; members: string[] }> {
  const nodes = keywords.map((kw) => ({ kw, toks: kwTokens(kw) }));
  const assigned = new Set<string>();
  const clusters: Array<{ head: string; members: string[] }> = [];

  for (const a of nodes) {
    if (assigned.has(a.kw)) continue;
    const members = [a.kw];
    assigned.add(a.kw);
    for (const b of nodes) {
      if (assigned.has(b.kw)) continue;
      const shared = [...a.toks].filter((t) => b.toks.has(t)).length;
      const min = Math.min(a.toks.size, b.toks.size);
      if (min > 0 && shared / min >= 0.5) {
        members.push(b.kw);
        assigned.add(b.kw);
      }
    }
    const head = members.reduce((s, k) => (k.length < s.length ? k : s), members[0]);
    clusters.push({ head, members });
  }
  return clusters;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3: SERP Fetcher
// Pull top 10 organic results + SERP features + PAA + ads via SerpApi
// ─────────────────────────────────────────────────────────────────────────────
interface SerpResult {
  position: number;
  title:    string;
  url:      string;
  domain:   string;
  snippet:  string;
  date:     string | null;
}

async function fetchSerp(
  keyword: string,
  apiKey: string,
  country: string,
  language: string
): Promise<{
  organic: SerpResult[];
  features: Record<string, boolean>;
  adsCount: number;
  paa: string[];
}> {
  const empty = { organic: [], features: {}, adsCount: 0, paa: [] };
  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("q",       keyword);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("engine",  "google");
    url.searchParams.set("num",     "10");
    url.searchParams.set("gl",      country);
    url.searchParams.set("hl",      language);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(14000) });
    if (!res.ok) return empty;
    const data = await res.json();

    const organic: SerpResult[] = (data.organic_results ?? []).map(
      (r: { position?: number; title?: string; link?: string; snippet?: string; date?: string }) => ({
        position: r.position ?? 0,
        title:    r.title    || "Untitled",
        url:      r.link     || "",
        domain:   rootDomain(r.link || ""),
        snippet:  r.snippet  || "",
        date:     r.date ?? null,
      })
    );

    const features: Record<string, boolean> = {};
    if (data.answer_box)        features.featured_snippet = true;
    if (data.knowledge_graph)   features.knowledge_graph  = true;
    if (data.related_questions) features.people_also_ask  = true;
    if (data.related_searches)  features.related_searches = true;
    if (data.local_results)     features.local_pack       = true;
    if (data.inline_images)     features.image_pack       = true;
    if (data.inline_videos)     features.video_results    = true;
    if (data.shopping_results)  features.shopping_results = true;

    const paa: string[] = (data.related_questions ?? [])
      .slice(0, 8)
      .map((q: { question?: string }) => (q.question ?? "").trim())
      .filter(Boolean);

    return { organic, features, adsCount: (data.ads ?? []).length, paa };
  } catch (e) {
    console.error("[serp-layer] SerpApi:", e);
    return empty;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4: Page Extractor
// Scrape competitor page via Firecrawl, return markdown
// ─────────────────────────────────────────────────────────────────────────────
async function extractPage(url: string, key: string): Promise<string> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 2000,
      }),
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const md: string = data?.data?.markdown || data?.markdown || "";
    return md.slice(0, 4000);
  } catch { return ""; }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 5: Intent Classifier
// Rule-based intent detection from SERP signals (no AI)
// ─────────────────────────────────────────────────────────────────────────────
function classifyIntent(
  keyword: string,
  features: Record<string, boolean>,
  adsCount: number
): { intent: string; confidence: number } {
  const kw = keyword.toLowerCase();
  if (adsCount >= 3 || features.shopping_results ||
      /\b(buy|purchase|price|cheap|deal|discount|order|shop|sale|coupon|cost)\b/.test(kw))
    return { intent: "transactional", confidence: 88 };
  if (/\b(best|top|review|vs|versus|compare|comparison|alternative|pros|cons|rating|recommended)\b/.test(kw))
    return { intent: "commercial_investigation", confidence: 82 };
  if (features.knowledge_graph ||
      /\b(login|sign in|sign up|download|official|website|app)\b/.test(kw))
    return { intent: "navigational", confidence: 79 };
  return { intent: "informational", confidence: 75 };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 5 (cont.): Page-type detection from titles + URLs
// ─────────────────────────────────────────────────────────────────────────────
function detectPageType(title: string, url: string): string {
  const t = title.toLowerCase();
  const u = url.toLowerCase();
  if (/\bhow[- ]to\b/.test(t))                                            return "how-to";
  if (/\b(best|top \d+|top-\d+|\d+ best|\d+ ways|\d+ tips|\d+ steps)\b/.test(t)) return "listicle";
  if (/\bvs\.?\b|\bversus\b|\bcompar(e|ison)\b/.test(t))                 return "comparison";
  if (/\breview\b/.test(t))                                               return "review";
  if (/\b(ultimate|complete|comprehensive|definitive)\b.*\bguide\b/.test(t) ||
      /\bguide\b.*\b(ultimate|complete)\b/.test(t))                       return "pillar-guide";
  if (/\bguide\b|\btutorial\b|\bwalkthrough\b/.test(t))                   return "guide";
  if (/\bwhat (is|are)\b|\bdefinition\b|\bmeaning\b/.test(t))             return "informational";
  if (/\btemplate\b|\bexample\b|\bsample\b|\bchecklist\b/.test(t))        return "template";
  if (/\/product\/|\/shop\/|\/buy\//.test(u))                             return "product";
  return "guide";
}

function dominantTypes(organic: Array<{ title: string; url: string }>): string[] {
  const counts = new Map<string, number>();
  for (const r of organic) {
    const pt = detectPageType(r.title, r.url);
    counts.set(pt, (counts.get(pt) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 6: Gap Detector
// Detect shared structural patterns across top pages (rule-based on scraped content)
// ─────────────────────────────────────────────────────────────────────────────
function detectSharedPatterns(
  pages: string[],
  features: Record<string, boolean>,
  pageTypes: string[],
  paa: string[]
): string[] {
  const patterns = new Set<string>();

  // SERP feature signals
  if (features.featured_snippet)              patterns.add("featured snippet box");
  if (features.people_also_ask || paa.length) patterns.add("FAQ section");
  if (features.shopping_results)              patterns.add("product listings");
  if (features.image_pack)                    patterns.add("image gallery");
  if (features.video_results)                 patterns.add("embedded videos");

  // Page type signals
  if (pageTypes.some((t) => t === "comparison" || t === "listicle"))
    patterns.add("comparison tables");
  if (pageTypes.some((t) => t === "review"))
    patterns.add("pros and cons");
  if (pageTypes.some((t) => t === "listicle"))
    patterns.add("numbered tool list");

  // Scraped content analysis
  const combined = pages.join("\n");

  if (/\|.+\|.+\|/.test(combined))
    patterns.add("comparison tables");
  if (/##\s.*(faq|frequently asked)/i.test(combined))
    patterns.add("FAQ section");
  if (/##\s.*(pros\b.*cons|advantages.*disadvantages|benefits.*drawbacks)/i.test(combined))
    patterns.add("pros and cons");
  if (/##\s.*(price|pricing|cost|plan)/i.test(combined))
    patterns.add("pricing section");
  if (/##\s.*(step \d|getting started|how to)/i.test(combined))
    patterns.add("step-by-step guide");
  if (/##\s.*(example|case study|use case)/i.test(combined))
    patterns.add("examples and case studies");
  if (/##\s.*(vs\b|alternative|compare)/i.test(combined))
    patterns.add("competitor comparisons");
  if (/##\s.*(tool|software|resource|recommendation)/i.test(combined))
    patterns.add("tool/resource list");
  if (/##\s.*(summary|conclusion|key takeaway)/i.test(combined))
    patterns.add("summary/conclusion");

  return [...patterns].slice(0, 7);
}

// Extract common H2/H3 headings repeated across 2+ scraped pages
function extractCommonHeadings(pages: string[]): string[] {
  const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const counts = new Map<string, number>();
  for (const md of pages) {
    const heads = (md.match(/^#{1,3} .+/gm) ?? []).map((h) =>
      h.replace(/^#+\s+/, "").trim()
    );
    const seen = new Set<string>();
    for (const h of heads) {
      const n = norm(h);
      if (n.length > 5 && !seen.has(n)) {
        counts.set(n, (counts.get(n) ?? 0) + 1);
        seen.add(n);
      }
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([h]) => h);
}

// Extract named entities from titles + snippets (capitalized noun phrases)
const SKIP_CAPS = new Set([
  "The","This","That","These","Those","A","An","And","Or","But","In","On","At",
  "To","For","Of","With","Is","Are","Was","Were","How","What","Why","When",
  "Where","Which","Who","If","Then","So","As","By","From","Its","Our","Your",
]);
function extractEntities(texts: string[]): string[] {
  const combined = texts.join(" ");
  const matches  = combined.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? [];
  const counts   = new Map<string, number>();
  for (const m of matches)
    if (!SKIP_CAPS.has(m) && m.length > 3) counts.set(m, (counts.get(m) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([e]) => e);
}

// Freshness observation from result dates
function freshnessNote(organic: Array<{ date?: string | null }>): string {
  const cur = new Date().getFullYear();
  const years = organic
    .map((r) => r.date ? new Date(r.date).getFullYear() : NaN)
    .filter((y) => !isNaN(y));
  if (!years.length) return "No freshness signals detected.";
  const recent = years.filter((y) => cur - y <= 1).length;
  const ratio  = recent / years.length;
  const oldest = Math.max(...years.map((y) => cur - y));
  if (ratio >= 0.6)
    return `High freshness sensitivity — ${recent}/${years.length} ranking pages < 1 year old. Plan regular updates.`;
  if (ratio >= 0.3)
    return `Moderate freshness — mix of ages. An updated article can displace ${oldest}-year-old competitors.`;
  return `Low freshness sensitivity — content up to ${oldest} years old still ranks. Depth > recency.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring helpers
// ─────────────────────────────────────────────────────────────────────────────
function calcDifficultyProxy(
  organic: Array<{ position: number; url: string }>,
  features: Record<string, boolean>,
  adsCount: number
): number {
  let score = 0;
  for (const r of organic.filter((r) => r.position <= 5))
    if (HIGH_DA_DOMAINS.has(rootDomain(r.url))) score += 14;
  for (const r of organic.filter((r) => r.position > 5 && r.position <= 10))
    if (HIGH_DA_DOMAINS.has(rootDomain(r.url))) score += 4;
  const fw: Record<string, number> = {
    featured_snippet: 8, knowledge_graph: 6, people_also_ask: 4,
    shopping_results: 4, local_pack: 3, image_pack: 2, video_results: 2, related_searches: 1,
  };
  for (const [f, on] of Object.entries(features)) if (on) score += fw[f] ?? 2;
  score += Math.min(12, adsCount * 3);
  return Math.min(100, Math.max(0, score));
}

function calcOpportunity(
  difficulty: number,
  intent: string,
  clusterSize: number
): number {
  const intentBonus = (intent === "commercial_investigation" || intent === "transactional") ? 15 : 0;
  const sizeBonus   = Math.min(10, (clusterSize - 1) * 3);
  return Math.min(100, Math.max(0, (100 - difficulty) * 0.75 + intentBonus + sizeBonus));
}

function calcBusinessRelevance(
  primary: string,
  secondary: string[],
  niche: string,
  intent: string,
  opportunity: number
): number {
  const nicheWords = new Set(
    niche.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
  const kwWords = [primary, ...secondary]
    .join(" ").toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const overlap = kwWords.filter((w) => nicheWords.has(w)).length;
  const ratio   = nicheWords.size > 0 ? overlap / nicheWords.size : 0;
  let score     = Math.min(100, ratio * 60 + 30);
  if (intent === "commercial_investigation" || intent === "transactional") score = Math.min(100, score + 15);
  if (opportunity > 70) score = Math.min(100, score + 10);
  score = Math.min(100, score + Math.min(5, secondary.length));
  return Math.round(score);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 8: Decision Engine
// write_new_article | refresh_existing | skip
// ─────────────────────────────────────────────────────────────────────────────
type Decision = "write_new_article" | "refresh_existing" | "skip";

function makeDecision(
  existingSiteMatch: boolean,
  opportunity: number,
  difficulty: number,
  relevance: number
): { decision: Decision; reason: string } {
  if (existingSiteMatch && opportunity >= 30)
    return {
      decision: "refresh_existing",
      reason:   `site already ranks in top 10 — refreshing existing content improves position faster than creating new (opportunity: ${opportunity})`,
    };
  if (opportunity < 25 && relevance < 40)
    return {
      decision: "skip",
      reason:   `low opportunity (${opportunity}) and low business relevance (${relevance}) — resources better spent elsewhere`,
    };
  if (difficulty > 75 && opportunity < 35)
    return {
      decision: "skip",
      reason:   `high difficulty (${difficulty}) with insufficient opportunity (${opportunity}) — not cost-effective to compete`,
    };
  return {
    decision: "write_new_article",
    reason:   `opportunity ${opportunity}, difficulty ${difficulty}, relevance ${relevance} — clear SERP pattern with content gap exists`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 200, headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json();

    const rawKeywords: string[] = Array.isArray(body.keywords)
      ? body.keywords.slice(0, 30).map((k: unknown) => String(k).slice(0, 150))
      : [];
    const niche      = typeof body.niche       === "string" ? body.niche.trim().slice(0, 200)      : "";
    const targetSite = typeof body.target_site === "string" ? body.target_site.trim().slice(0, 200) : "";
    const country    = typeof body.country     === "string" ? body.country.trim().slice(0, 5)       : "us";
    const language   = typeof body.language    === "string" ? body.language.trim().slice(0, 5)      : "en";

    if (!rawKeywords.length) return json({ error: "keywords[] is required" }, 400);

    const SERP_KEY      = Deno.env.get("SERP_API_KEY");
    const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY");
    const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    if (!SERP_KEY)   return json({ error: "SERP_API_KEY not configured" },  500);
    if (!OPENAI_KEY) return json({ error: "OPENAI_API_KEY not configured" }, 500);

    // ── Module 1: Clean keywords ─────────────────────────────────────────────
    const keywords = cleanKeywords(rawKeywords);
    if (!keywords.length) return json({ error: "No valid keywords after cleaning" }, 400);

    // ── Module 2: Cluster ────────────────────────────────────────────────────
    const clusters = clusterKeywords(keywords);
    console.log(`[serp-layer] ${keywords.length} keywords → ${clusters.length} clusters`);

    // ── Module 3: Fetch SERP per cluster head (rate-limited at 600ms) ────────
    type RawEntry = {
      cluster:  { head: string; members: string[] };
      organic:  SerpResult[];
      features: Record<string, boolean>;
      adsCount: number;
      paa:      string[];
    };

    const entries: RawEntry[] = [];
    for (let i = 0; i < clusters.length; i++) {
      console.log(`[serp-layer] SERP → "${clusters[i].head}"`);
      const serp = await fetchSerp(clusters[i].head, SERP_KEY, country, language);
      entries.push({ cluster: clusters[i], ...serp });
      if (i < clusters.length - 1) await new Promise((r) => setTimeout(r, 600));
    }

    // ── Module 4: Scrape top 3 per cluster (cap: 9 total) ───────────────────
    type ScrapeJob = { url: string; ci: number };
    const jobs: ScrapeJob[] = [];
    for (let ci = 0; ci < entries.length; ci++) {
      for (const r of entries[ci].organic.slice(0, 3)) {
        if (r.url && jobs.length < 9) jobs.push({ url: r.url, ci });
      }
    }

    const pagesByCluster = new Map<number, string[]>();
    if (FIRECRAWL_KEY && jobs.length > 0) {
      console.log(`[serp-layer] Scraping ${jobs.length} pages`);
      const scraped = await Promise.all(jobs.map((j) => extractPage(j.url, FIRECRAWL_KEY)));
      for (let i = 0; i < jobs.length; i++) {
        const { ci } = jobs[i];
        if (!pagesByCluster.has(ci)) pagesByCluster.set(ci, []);
        if (scraped[i]) pagesByCluster.get(ci)!.push(scraped[i]);
      }
    }

    // ── Build intermediate cluster summaries (Modules 5 + 6) ─────────────────
    type ClusterMeta = {
      ci:               number;
      cluster:          { head: string; members: string[] };
      intent:           string;
      confidence:       number;
      difficulty:       number;
      opportunity:      number;
      relevance:        number;
      pageTypes:        string[];
      sharedPatterns:   string[];
      commonHeadings:   string[];
      paa:              string[];
      entities:         string[];
      topUrls:          string[];
      topDomains:       string[];
      featureList:      string[];
      freshness:        string;
      siteMatch:        boolean;
      topTitles:        string[];
      topSnippets:      string[];
    };

    const metas: ClusterMeta[] = entries.map(({ cluster, organic, features, adsCount, paa }, ci) => {
      const { intent, confidence } = classifyIntent(cluster.head, features, adsCount);
      const difficulty   = calcDifficultyProxy(organic, features, adsCount);
      const opportunity  = calcOpportunity(difficulty, intent, cluster.members.length);
      const secondary    = cluster.members.filter((m) => m !== cluster.head);
      const relevance    = calcBusinessRelevance(cluster.head, secondary, niche, intent, opportunity);
      const pageTypes    = dominantTypes(organic);
      const pages        = pagesByCluster.get(ci) ?? [];
      const sharedPats   = detectSharedPatterns(pages, features, pageTypes, paa);
      const commonHeads  = pages.length >= 2 ? extractCommonHeadings(pages) : [];
      const topTitles    = organic.slice(0, 5).map((r) => r.title);
      const topSnippets  = organic.slice(0, 5).map((r) => r.snippet);
      const entities     = extractEntities([...topTitles, ...topSnippets, ...pages.map((p) => p.slice(0, 800))]);
      const topUrls      = organic.slice(0, 10).map((r) => r.url).filter(Boolean);
      const topDomains   = [...new Set(organic.slice(0, 10).map((r) => r.domain).filter(Boolean))];
      const featureList  = Object.keys(features).filter((k) => features[k]);
      const freshness    = freshnessNote(organic);
      const siteMatch    = targetSite
        ? topDomains.some((d) => d.includes(rootDomain(targetSite)) || rootDomain(targetSite).includes(d))
        : false;

      return {
        ci, cluster, intent, confidence, difficulty, opportunity, relevance,
        pageTypes, sharedPatterns: sharedPats, commonHeadings: commonHeads,
        paa, entities, topUrls, topDomains, featureList,
        freshness, siteMatch, topTitles, topSnippets,
      };
    });

    // ── Module 7: Brief Generator — AI pass (one call, all clusters) ─────────
    const aiContext = metas.map((m) => {
      let t = `### Cluster: "${m.cluster.head}"\n`;
      t += `- Intent: ${m.intent} (${m.confidence}%)\n`;
      t += `- Difficulty: ${m.difficulty}/100\n`;
      t += `- Dominant page types: ${m.pageTypes.join(", ")}\n`;
      t += `- SERP features: ${m.featureList.join(", ") || "none"}\n`;
      t += `- Shared structural patterns: ${m.sharedPatterns.join(", ") || "none"}\n`;
      if (m.commonHeadings.length) t += `- Common headings: ${m.commonHeadings.slice(0, 5).join(" | ")}\n`;
      if (m.paa.length)            t += `- PAA questions: ${m.paa.slice(0, 4).join(" | ")}\n`;
      t += `- Top titles: ${m.topTitles.slice(0, 3).join(" | ")}\n`;
      if (m.entities.length)       t += `- Key entities: ${m.entities.slice(0, 6).join(", ")}\n`;
      const secondary = m.cluster.members.filter((x) => x !== m.cluster.head);
      if (secondary.length)        t += `- Also covers: ${secondary.slice(0, 4).join(", ")}\n`;
      return t;
    }).join("\n");

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model:       "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `You are a senior SEO content strategist. Analyze live SERP cluster data and produce concise, actionable content briefs.
Return ONLY valid JSON — no markdown, no explanations.`,
          },
          {
            role: "user",
            content: `Niche: "${niche || "general"}"

${aiContext}

For EACH cluster, return a brief. JSON:
{
  "clusters": [
    {
      "head": "<exact primary_keyword>",
      "article_type": "listicle|guide|how-to|comparison|pillar-guide|review|informational",
      "suggested_title_angles": ["3-4 specific SEO-optimized title options — use PAA questions and identified gaps"],
      "recommended_outline": ["## H2 heading 1", "### H3 sub-heading", "## H2 heading 2", "...8-12 headings total"],
      "must_cover_topics": ["5-7 essential topics every ranking page covers that you must include"],
      "content_gaps_to_win": ["3-5 specific subtopics or angles missing from competitors — these are your differentiation opportunities"],
      "notes_for_planner": "2 sentences: key context, differentiation strategy, and one specific writer instruction"
    }
  ]
}`,
          },
        ],
      }),
    });

    type AiBrief = {
      head:                   string;
      article_type:           string;
      suggested_title_angles: string[];
      recommended_outline:    string[];
      must_cover_topics:      string[];
      content_gaps_to_win:    string[];
      notes_for_planner:      string;
    };

    let aiBriefs: AiBrief[] = [];
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const raw = (aiData.choices?.[0]?.message?.content ?? "")
        .replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
      try {
        aiBriefs = JSON.parse(raw).clusters ?? [];
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) try { aiBriefs = JSON.parse(m[0]).clusters ?? []; } catch { /* use defaults */ }
      }
    }

    // ── Module 7 + 8: Assemble final briefs in the spec JSON schema ──────────
    const serpDate = new Date().toISOString().split("T")[0];

    const briefs = metas.map((m, idx) => {
      const ai = aiBriefs.find((a) => a.head?.toLowerCase() === m.cluster.head.toLowerCase()) ?? {
        article_type:           m.pageTypes[0] ?? "guide",
        suggested_title_angles: [`The Complete Guide to ${m.cluster.head}`, `${m.cluster.head}: Everything You Need to Know`],
        recommended_outline:    [
          `## Introduction to ${m.cluster.head}`,
          `## What is ${m.cluster.head}`,
          `## Key Features and Benefits`,
          `## How to Get Started`,
          `## Best Practices`,
          `## FAQ`,
        ],
        must_cover_topics:      m.commonHeadings.slice(0, 5),
        content_gaps_to_win:    [`In-depth ${m.cluster.head} examples`, "Comparison with alternatives"],
        notes_for_planner:      `Target "${m.cluster.head}" as primary keyword. Match the ${m.pageTypes[0] ?? "guide"} format dominant in SERPs.`,
      };

      const secondary = m.cluster.members.filter((x) => x !== m.cluster.head);
      const { decision, reason } = makeDecision(m.siteMatch, m.opportunity, m.difficulty, m.relevance);

      const clusterId = `cluster_${String(idx + 1).padStart(3, "0")}`;

      return {
        keyword_cluster: {
          primary_keyword:    m.cluster.head,
          secondary_keywords: secondary,
          serp_cluster_id:    clusterId,
        },
        serp_summary: {
          country,
          language,
          top_urls:        m.topUrls,
          dominant_intent: m.intent,
          shared_patterns: m.sharedPatterns,
        },
        content_recommendation: {
          article_type:           ai.article_type,
          suggested_title_angles: ai.suggested_title_angles,
          recommended_outline:    ai.recommended_outline,
          must_cover_topics:      ai.must_cover_topics,
          faq_questions:          m.paa,
          content_gaps_to_win:    ai.content_gaps_to_win,
        },
        scoring: {
          opportunity_score:  Math.round(m.opportunity),
          difficulty_proxy:   m.difficulty,
          business_relevance: m.relevance,
        },
        action: { decision, reason },
        // Extended signals (for downstream use / DB storage)
        _meta: {
          serp_date:           serpDate,
          top_domains:         m.topDomains,
          serp_features:       m.featureList,
          dominant_page_types: m.pageTypes,
          common_headings:     m.commonHeadings,
          required_entities:   m.entities,
          freshness_note:      m.freshness,
          intent_confidence:   m.confidence,
          notes_for_planner:   ai.notes_for_planner,
        },
      };
    });

    // Sort: write_new first, then refresh, then skip; within each group by opportunity desc
    const order: Record<Decision, number> = { write_new_article: 0, refresh_existing: 1, skip: 2 };
    briefs.sort((a, b) => {
      const od = order[a.action.decision] - order[b.action.decision];
      if (od !== 0) return od;
      return b.scoring.opportunity_score - a.scoring.opportunity_score;
    });

    console.log(
      `[serp-layer] Done. ${briefs.length} briefs. ` +
      `Actions: ${briefs.filter((b) => b.action.decision === "write_new_article").length} write / ` +
      `${briefs.filter((b) => b.action.decision === "refresh_existing").length} refresh / ` +
      `${briefs.filter((b) => b.action.decision === "skip").length} skip`
    );

    return json({
      briefs,
      meta: {
        total_clusters:    briefs.length,
        keywords_cleaned:  keywords.length,
        pages_scraped:     jobs.length,
        country,
        language,
        generated_at:      new Date().toISOString(),
        actions_summary: {
          write_new_article: briefs.filter((b) => b.action.decision === "write_new_article").length,
          refresh_existing:  briefs.filter((b) => b.action.decision === "refresh_existing").length,
          skip:              briefs.filter((b) => b.action.decision === "skip").length,
        },
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[serp-layer] Fatal:", msg);
    if (msg.includes("429"))
      return json({ error: "Rate limit exceeded. Try again shortly." }, 429);
    return json({ error: "SERP layer pipeline failed", detail: msg }, 500);
  }
});
