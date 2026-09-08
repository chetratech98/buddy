/**
 * Shared scraping/SERP utilities used by analyze-site, seo-analysis, serp-layer,
 * content-gap, and generate-blog. Consolidates what used to be five near-identical
 * copies of: domain-authority scoring, intent classification, SerpApi search,
 * Firecrawl page scraping, retry/backoff, and SSRF URL validation.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Known high-authority domains (used for difficulty scoring)
// ─────────────────────────────────────────────────────────────────────────────
export const HIGH_DA_DOMAINS = new Set([
  "wikipedia.org", "youtube.com", "amazon.com", "reddit.com", "linkedin.com",
  "forbes.com", "nytimes.com", "wsj.com", "techcrunch.com", "theguardian.com",
  "bbc.com", "bbc.co.uk", "cnn.com", "huffpost.com", "businessinsider.com",
  "healthline.com", "webmd.com", "mayoclinic.org", "nih.gov", "cdc.gov",
  "gov.uk", "usa.gov", "who.int", "harvard.edu", "mit.edu", "stanford.edu",
  "shopify.com", "hubspot.com", "moz.com", "semrush.com", "ahrefs.com",
  "medium.com", "quora.com", "stackoverflow.com", "github.com",
  "nerdwallet.com", "investopedia.com", "bankrate.com", "pcmag.com",
  "cnet.com", "wired.com", "theverge.com", "engadget.com", "zdnet.com",
]);

export function rootDomain(url: string): string {
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return host.replace(/^www\./, "").split(".").slice(-2).join(".");
  } catch {
    return url;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SSRF protection — validate a user- or third-party-supplied URL before it's
// ever handed to Firecrawl or fetched directly. Blocks loopback, private/link-
// local IPv4 ranges (RFC1918 + the 169.254.0.0/16 cloud-metadata range),
// IPv6 loopback/unique-local, and .local/.internal hostnames.
//
// Note: this is hostname/literal-IP based. It does not resolve DNS, so a
// malicious domain that resolves to a private IP at request time (DNS
// rebinding) would not be caught here — that requires resolving + re-checking
// at the HTTP client layer, which Firecrawl (not this function) controls.
// ─────────────────────────────────────────────────────────────────────────────
const BLOCKED_HOSTNAME_SUFFIXES = [".local", ".internal", ".localhost"];

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 127) return true;              // loopback
  if (a === 10) return true;               // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 0) return true;                // 0.0.0.0/8
  return false;
}

function isPrivateIPv6(hostname: string): boolean {
  const h = hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (h === "::1") return true;            // loopback
  if (h.startsWith("fe80:")) return true;  // link-local
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local (fc00::/7)
  return false;
}

export function isUrlSafeToFetch(rawUrl: string): { safe: boolean; reason?: string; normalized?: string } {
  const normalized = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { safe: false, reason: "Invalid URL format" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: "Only http(s) URLs are allowed" };
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || BLOCKED_HOSTNAME_SUFFIXES.some((s) => hostname.endsWith(s))) {
    return { safe: false, reason: "Local/internal hostnames are not allowed" };
  }
  if (hostname.startsWith("[") || hostname.includes(":")) {
    if (isPrivateIPv6(hostname)) return { safe: false, reason: "Private IPv6 addresses are not allowed" };
  } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    if (isPrivateIPv4(hostname)) return { safe: false, reason: "Private/internal IP addresses are not allowed" };
  }
  return { safe: true, normalized };
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry/backoff wrapper — retries on network errors and 429/5xx responses.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { retries?: number; backoffMs?: number; label?: string } = {}
): Promise<Response> {
  const { retries = 2, backoffMs = 500, label = "fetch" } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || (res.status !== 429 && res.status < 500)) return res;
      lastErr = new Error(`${label} responded ${res.status}`);
      if (attempt < retries) {
        console.warn(`[${label}] attempt ${attempt + 1} got ${res.status}, retrying...`);
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        console.warn(`[${label}] attempt ${attempt + 1} failed, retrying...`, e);
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// ─────────────────────────────────────────────────────────────────────────────
// SerpApi search
// ─────────────────────────────────────────────────────────────────────────────
export interface SerpOrganicResult {
  position: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  date: string | null;
}

export interface SerpSearchResult {
  organic: SerpOrganicResult[];
  features: Record<string, boolean>;
  adsCount: number;
  paa: string[];
}

export async function searchSerp(
  query: string,
  apiKey: string,
  opts: { country?: string; language?: string; num?: number; retries?: number } = {}
): Promise<SerpSearchResult> {
  const { country = "us", language = "en", num = 10, retries = 1 } = opts;
  const empty: SerpSearchResult = { organic: [], features: {}, adsCount: 0, paa: [] };
  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("engine", "google");
    url.searchParams.set("num", String(num));
    url.searchParams.set("gl", country);
    url.searchParams.set("hl", language);

    const res = await fetchWithRetry(url.toString(), { signal: AbortSignal.timeout(14000) }, { retries, label: "serpapi" });
    if (!res.ok) return empty;
    const data = await res.json();

    const organic: SerpOrganicResult[] = (data.organic_results ?? []).map((r: {
      position?: number; title?: string; link?: string; snippet?: string; date?: string;
    }) => ({
      position: r.position ?? 0,
      title: r.title || "Untitled",
      url: r.link || "",
      domain: rootDomain(r.link || ""),
      snippet: r.snippet || "",
      date: r.date ?? null,
    }));

    const features: Record<string, boolean> = {};
    if (data.answer_box) features.featured_snippet = true;
    if (data.knowledge_graph) features.knowledge_graph = true;
    if (data.related_questions) features.people_also_ask = true;
    if (data.related_searches) features.related_searches = true;
    if (data.local_results) features.local_pack = true;
    if (data.inline_images) features.image_pack = true;
    if (data.inline_videos) features.video_results = true;
    if (data.shopping_results) features.shopping_results = true;

    const paa: string[] = (data.related_questions ?? [])
      .slice(0, 8)
      .map((q: { question?: string }) => (q.question ?? "").trim())
      .filter(Boolean);

    return { organic, features, adsCount: (data.ads ?? []).length, paa };
  } catch (e) {
    console.error("[searchSerp] error:", e);
    return empty;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Firecrawl page scraping
// ─────────────────────────────────────────────────────────────────────────────
export interface ScrapedPage {
  markdown: string;
  title: string;
  description: string;
  links: string[];
}

export async function scrapePage(
  url: string,
  firecrawlKey: string,
  opts: { formats?: string[]; onlyMainContent?: boolean; waitFor?: number; timeoutMs?: number; maxChars?: number; retries?: number } = {}
): Promise<ScrapedPage> {
  const empty: ScrapedPage = { markdown: "", title: "", description: "", links: [] };
  const check = isUrlSafeToFetch(url);
  if (!check.safe) {
    console.warn(`[scrapePage] blocked unsafe URL: ${url} (${check.reason})`);
    return empty;
  }
  const {
    formats = ["markdown"],
    onlyMainContent = true,
    waitFor = 2000,
    timeoutMs = 9000,
    maxChars = 6000,
    retries = 1,
  } = opts;
  try {
    const res = await fetchWithRetry(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: check.normalized, formats, onlyMainContent, waitFor }),
        signal: AbortSignal.timeout(timeoutMs),
      },
      { retries, label: "firecrawl" }
    );
    if (!res.ok) return empty;
    const data = await res.json();
    const d = data?.data ?? data ?? {};
    return {
      markdown: (d.markdown || "").slice(0, maxChars),
      title: d.metadata?.title || "",
      description: d.metadata?.description || "",
      links: d.links || [],
    };
  } catch (e) {
    console.error(`[scrapePage] failed for ${url}:`, e);
    return empty;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Difficulty scoring (0-100, purely from SERP signals — no AI)
// ─────────────────────────────────────────────────────────────────────────────
export function calculateDifficulty(
  organicResults: Array<{ position: number; url: string }>,
  serpFeatures: Record<string, boolean>,
  adsCount = 0
): { score: number; label: "low" | "medium" | "high" } {
  let score = 0;
  for (const r of organicResults.filter((r) => r.position <= 5))
    if (HIGH_DA_DOMAINS.has(rootDomain(r.url))) score += 14;
  for (const r of organicResults.filter((r) => r.position > 5 && r.position <= 10))
    if (HIGH_DA_DOMAINS.has(rootDomain(r.url))) score += 4;

  const featureWeights: Record<string, number> = {
    featured_snippet: 8, knowledge_graph: 6, people_also_ask: 4,
    shopping_results: 4, local_pack: 3, image_pack: 2, video_results: 2, related_searches: 1,
  };
  for (const [feature, present] of Object.entries(serpFeatures)) {
    if (present) score += featureWeights[feature] ?? 2;
  }
  score += Math.min(12, adsCount * 3);

  const clamped = Math.min(100, Math.max(0, score));
  const label: "low" | "medium" | "high" = clamped >= 60 ? "high" : clamped >= 35 ? "medium" : "low";
  return { score: clamped, label };
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent classification (rule-based, no AI). Labels are standardized to
// "transactional" | "commercial" | "navigational" | "informational" —
// downstream consumers (e.g. content-intelligence) switch on these exact
// strings, so don't rename them without updating every consumer.
// ─────────────────────────────────────────────────────────────────────────────
export function classifyIntent(
  keyword: string,
  serpFeatures: Record<string, boolean>,
  adsCount: number
): { intent: "transactional" | "commercial" | "navigational" | "informational"; confidence: number } {
  const kw = keyword.toLowerCase();
  if (adsCount >= 3 || serpFeatures.shopping_results ||
      /\b(buy|purchase|price|cheap|deal|discount|order|shop|sale|coupon|cost)\b/.test(kw))
    return { intent: "transactional", confidence: 88 };
  if (/\b(best|top|review|vs|versus|compare|comparison|alternative|pros|cons|rating|recommended)\b/.test(kw))
    return { intent: "commercial", confidence: 82 };
  if (serpFeatures.knowledge_graph ||
      /\b(login|sign in|sign up|download|official|website|app)\b/.test(kw))
    return { intent: "navigational", confidence: 79 };
  return { intent: "informational", confidence: 75 };
}
