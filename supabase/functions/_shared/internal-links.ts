/**
 * Finds existing published posts worth linking to from a newly-generated
 * one, and strips any link the writer added that isn't one of them.
 *
 * Reuses check-duplicate's exact similarity tiers (see that function's
 * header comment) for what counts as "related": excludes near-duplicates
 * (>= 0.92 — linking to essentially the same content is confusing, not
 * useful) and excludes anything too dissimilar to link naturally (< 0.55).
 * The 0.55–0.92 band is "topically related, not a duplicate" — exactly
 * check-duplicate's own "moderate/high similarity, suggest an internal
 * link" range, just acted on instead of only suggested to a human.
 */

import type { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cosineSimilarity, embedTexts } from "./embeddings.ts";

export interface RelatedPostCandidate {
  title: string;
  url: string;
}

const MIN_RELEVANCE = 0.55;
const MAX_RELEVANCE = 0.92; // at/above this, it's a near-duplicate, not a "related post"

/**
 * Looks up the user's own published posts with a real canonical_url, and
 * returns the top `limit` whose title/excerpt/keywords are semantically
 * related to `queryText` (the new post's topic + keywords) — never throws;
 * a failure here should never block post generation, it just means no
 * internal links get suggested this run.
 */
export async function findRelatedPosts(
  // deno-lint-ignore no-explicit-any
  supabase: ReturnType<typeof createClient<any>>,
  userId: string,
  queryText: string,
  apiKey: string,
  limit = 3
): Promise<RelatedPostCandidate[]> {
  if (!queryText.trim()) return [];

  try {
    const { data: posts, error } = await supabase
      .from("blog_posts")
      .select("title, excerpt, keywords, canonical_url")
      .eq("user_id", userId)
      .eq("status", "published")
      .not("canonical_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(150);

    if (error || !posts || posts.length === 0) return [];

    const candidateTexts = posts.map((p: { title: string; excerpt: string | null; keywords: string[] | null }) =>
      [p.title, Array.isArray(p.keywords) ? p.keywords.join(", ") : "", p.excerpt ?? ""]
        .filter(Boolean)
        .join(" | ")
    );

    const allEmbeddings = await embedTexts([queryText, ...candidateTexts], apiKey);
    const queryEmbedding = allEmbeddings[0];
    const candidateEmbeddings = allEmbeddings.slice(1);

    const scored = posts
      .map((p: { title: string; canonical_url: string | null }, i: number) => ({
        title: p.title,
        url: p.canonical_url as string,
        similarity: cosineSimilarity(queryEmbedding, candidateEmbeddings[i]),
      }))
      .filter((m) => m.similarity >= MIN_RELEVANCE && m.similarity < MAX_RELEVANCE)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return scored.map((m) => ({ title: m.title, url: m.url }));
  } catch (e) {
    console.warn("[internal-links] findRelatedPosts failed:", e);
    return [];
  }
}

/**
 * Removes any markdown link in `content` whose URL isn't in `allowedUrls`,
 * keeping the link's visible text as plain text. A safety net against the
 * writer hallucinating or mis-copying a URL, so a broken/invented link can
 * never ship through the unattended auto-publish pipeline.
 */
export function stripUnauthorizedLinks(content: string, allowedUrls: Set<string>): string {
  if (!content) return content;
  return content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (full, text, url) => {
    return allowedUrls.has(url.trim()) ? full : text;
  });
}

/** Counts how many of `allowedUrls` actually appear as links in `content` — for logging. */
export function countLinksUsed(content: string, allowedUrls: Set<string>): number {
  if (!content) return 0;
  const matches = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
  let count = 0;
  for (const m of matches) if (allowedUrls.has(m[2].trim())) count++;
  return count;
}
