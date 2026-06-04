/**
 * rank-tracker — daily feedback loop for published posts.
 *
 * Workflow:
 *   1. Fetch all published blog posts that have at least one keyword
 *   2. For each post, take the primary keyword (keywords[0])
 *   3. Query SerpApi for that keyword (Google, US/en)
 *   4. Scan organic results for the post's canonical URL or domain
 *   5. Record position (null = not in top 100) in post_rankings
 *   6. Compute change_from_last compared to previous ranking row
 *
 * Designed to run as a scheduled job (pg_cron → net.http_post).
 * Can also be triggered manually via POST /rank-tracker.
 *
 * Returns per-user summary: { checked, ranked, unranked, improved, dropped }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function rootDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname
      .replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Search SerpApi and return all organic results (up to 100) */
async function fetchSerpResults(
  keyword: string,
  apiKey: string
): Promise<Array<{ position: number; url: string; title: string }>> {
  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("q",       keyword);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("engine",  "google");
    url.searchParams.set("num",     "100");
    url.searchParams.set("gl",      "us");
    url.searchParams.set("hl",      "en");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];

    const data = await res.json();
    return (data.organic_results ?? []).map((r: {
      position: number;
      link?: string;
      title?: string;
    }) => ({
      position: r.position,
      url:      r.link ?? "",
      title:    r.title ?? "",
    }));
  } catch {
    return [];
  }
}

/**
 * Find the best matching position for a post in the SERP.
 * Matches by exact URL first, then by root domain.
 * Returns null if not found in top 100.
 */
function findPosition(
  results: Array<{ position: number; url: string }>,
  postUrl: string | null,
  postDomain: string | null
): { position: number; url: string } | null {
  // Exact URL match
  if (postUrl) {
    const exact = results.find((r) => r.url === postUrl || r.url.includes(postUrl));
    if (exact) return exact;
  }
  // Domain-level match (any page from the same domain)
  if (postDomain) {
    const domain = rootDomain(postDomain);
    const domainMatch = results.find((r) => rootDomain(r.url) === domain);
    if (domainMatch) return domainMatch;
  }
  return null;
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

  const SERP_API_KEY = Deno.env.get("SERP_API_KEY");
  if (!SERP_API_KEY) {
    return jsonResponse({ error: "SERP_API_KEY not configured" }, 500);
  }

  // Use service role to read all published posts across all users
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Optionally scope to a single user_id (passed from manual trigger)
  let targetUserId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    targetUserId = typeof body?.user_id === "string" ? body.user_id : null;
  } catch { /* ignore */ }

  try {
    // ── 1. Fetch published posts that have keywords ───────────────────────────
    let query = admin
      .from("blog_posts")
      .select("id, user_id, title, keywords, canonical_url")
      .eq("status", "published")
      .not("keywords", "is", null)
      .order("published_at", { ascending: false });

    if (targetUserId) query = query.eq("user_id", targetUserId);

    // Process at most 50 posts per run (rate-limit SerpApi calls)
    query = query.limit(50);

    const { data: posts, error: postsError } = await query;
    if (postsError) throw postsError;

    console.log(`[rank-tracker] Checking ${posts?.length ?? 0} posts`);

    if (!posts || posts.length === 0) {
      return jsonResponse({ success: true, processed: 0, message: "No published posts with keywords found" });
    }

    // ── 2. Load user website URLs (for domain-level matching) ─────────────────
    const userIds = [...new Set(posts.map((p) => p.user_id))];
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, website_url")
      .in("user_id", userIds);

    const userDomainMap = new Map<string, string | null>(
      (profiles ?? []).map((p) => [p.user_id, p.website_url])
    );

    // ── 3. Load previous rankings (most recent per post+keyword) ──────────────
    const postIds = posts.map((p) => p.id);
    const { data: prevRankings } = await admin
      .from("post_rankings")
      .select("post_id, keyword, position, checked_at")
      .in("post_id", postIds)
      .order("checked_at", { ascending: false });

    // Index: postId_keyword → last position
    const prevMap = new Map<string, number | null>();
    for (const r of prevRankings ?? []) {
      const key = `${r.post_id}_${r.keyword}`;
      if (!prevMap.has(key)) prevMap.set(key, r.position);
    }

    // ── 4. Check rankings (sequential to respect SerpApi rate limits) ─────────
    const checkedAt = new Date().toISOString();
    const rankingInserts: Array<{
      post_id: string;
      user_id: string;
      keyword: string;
      position: number | null;
      url: string | null;
      change_from_last: number | null;
      source_url: string | null;
      checked_at: string;
    }> = [];

    let ranked = 0, unranked = 0, improved = 0, dropped = 0;

    for (const post of posts) {
      const keywords = Array.isArray(post.keywords) ? post.keywords : [];
      if (keywords.length === 0) continue;

      const primaryKeyword = keywords[0];
      const userDomain     = userDomainMap.get(post.user_id) ?? null;
      const canonicalUrl   = post.canonical_url ?? null;

      // Rate-limit: 1 request per second (SerpApi free tier allows 100 searches/mo)
      await new Promise((r) => setTimeout(r, 1100));

      const results = await fetchSerpResults(primaryKeyword, SERP_API_KEY);
      const match   = findPosition(results, canonicalUrl, userDomain);

      const position    = match?.position ?? null;
      const sourceUrl   = match?.url ?? null;

      // Calculate change from last check
      const prevKey     = `${post.id}_${primaryKeyword}`;
      const prevPosition = prevMap.get(prevKey) ?? null;
      let changeFromLast: number | null = null;

      if (prevPosition !== null && position !== null) {
        changeFromLast = position - prevPosition; // positive = fell, negative = rose
        if (changeFromLast < 0) improved++;
        else if (changeFromLast > 0) dropped++;
      }

      if (position !== null) ranked++; else unranked++;

      rankingInserts.push({
        post_id:          post.id,
        user_id:          post.user_id,
        keyword:          primaryKeyword,
        position,
        url:              sourceUrl,
        change_from_last: changeFromLast,
        source_url:       sourceUrl,
        checked_at:       checkedAt,
      });

      console.log(
        `[rank-tracker] "${post.title}" | keyword: "${primaryKeyword}" | ` +
        `position: ${position ?? "not found"} | change: ${changeFromLast ?? "n/a"}`
      );
    }

    // ── 5. Batch insert ranking rows ──────────────────────────────────────────
    if (rankingInserts.length > 0) {
      const { error: insertError } = await admin
        .from("post_rankings")
        .insert(rankingInserts);
      if (insertError) console.error("[rank-tracker] Insert error:", insertError.message);
    }

    // ── 6. Log the run ────────────────────────────────────────────────────────
    if (targetUserId) {
      await admin.from("rank_tracker_runs").insert({
        user_id:         targetUserId,
        posts_checked:   posts.length,
        keywords_checked: rankingInserts.length,
      });
    } else {
      // Log per user
      const perUser = new Map<string, number>();
      for (const r of rankingInserts) {
        perUser.set(r.user_id, (perUser.get(r.user_id) ?? 0) + 1);
      }
      if (perUser.size > 0) {
        await admin.from("rank_tracker_runs").insert(
          [...perUser.entries()].map(([uid, count]) => ({
            user_id:          uid,
            posts_checked:    posts.filter((p) => p.user_id === uid).length,
            keywords_checked: count,
          }))
        );
      }
    }

    const summary = {
      success:    true,
      processed:  posts.length,
      ranked,
      unranked,
      improved,
      dropped,
      checkedAt,
    };

    console.log("[rank-tracker] Summary:", JSON.stringify(summary));
    return jsonResponse(summary);

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[rank-tracker] Fatal error:", msg);
    return jsonResponse({ error: "Rank tracker failed", detail: msg }, 500);
  }
});
