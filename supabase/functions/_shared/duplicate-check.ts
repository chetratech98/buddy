/**
 * Shared near-duplicate / topic-overlap detection — the exact logic
 * check-duplicate exposes interactively to CreatePost, extracted so
 * daily-blog-generator can run the same check in-process on its actual
 * generated output (not just the content plan's title, which can drift
 * once the writer has creative freedom, and which was only deduped once,
 * at plan-creation time, against whatever posts existed back then).
 *
 * Thresholds (unchanged from check-duplicate's original header comment):
 *   >= 0.92   — Near-duplicate / keyword cannibalization risk
 *   0.80-0.92 — High similarity
 *   0.65-0.80 — Moderate overlap
 *   <  0.65   — Safe
 */

import type { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cosineSimilarity, embedTexts } from "./embeddings.ts";

export type DuplicateRiskLevel = "duplicate" | "high" | "moderate" | "safe";

export interface DuplicateMatch {
  postId: string;
  title: string;
  excerpt: string;
  similarity: number;
  percentage: number;
  level: DuplicateRiskLevel;
  label: string;
  recommendation: string;
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  riskLevel: DuplicateRiskLevel;
  riskLabel: string;
  maxSimilarity: number;
  recommendation: string;
  topMatches: DuplicateMatch[];
  postsChecked: number;
}

export function interpretSimilarity(score: number): { level: DuplicateRiskLevel; label: string; recommendation: string } {
  if (score >= 0.92) return {
    level: "duplicate",
    label: "Near-duplicate",
    recommendation: "This topic is extremely similar to an existing post. Publishing it will cause keyword cannibalization. Either update the existing post or choose a meaningfully different angle.",
  };
  if (score >= 0.80) return {
    level: "high",
    label: "High similarity",
    recommendation: "Strong topical overlap detected. Differentiate by targeting a different search intent, adding a unique angle, or consolidating with the existing post.",
  };
  if (score >= 0.65) return {
    level: "moderate",
    label: "Moderate overlap",
    recommendation: "Related topics detected. This is fine to publish, but consider adding an internal link to the similar existing post.",
  };
  return {
    level: "safe",
    label: "No duplicate",
    recommendation: "Topic is sufficiently unique — safe to create.",
  };
}

/**
 * Checks a proposed title/topic/keyword against a user's own existing
 * posts (published, draft, scheduled, or review — matching what a human
 * could already see as "in flight" content) for near-duplicate overlap.
 */
export async function checkDuplicate(
  // deno-lint-ignore no-explicit-any
  supabase: ReturnType<typeof createClient<any>>,
  userId: string,
  proposed: { title?: string; topic?: string; keyword?: string },
  apiKey: string
): Promise<DuplicateCheckResult> {
  const proposedTitle = (proposed.title ?? "").trim().slice(0, 200);
  const proposedTopic = (proposed.topic ?? "").trim().slice(0, 500);
  const proposedKeyword = (proposed.keyword ?? "").trim().slice(0, 100);

  const { data: posts, error } = await supabase
    .from("blog_posts")
    .select("id, title, excerpt, keywords")
    .eq("user_id", userId)
    .in("status", ["published", "draft", "scheduled", "review"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !posts || posts.length === 0) {
    return {
      hasDuplicate: false,
      riskLevel: "safe",
      riskLabel: "No duplicate",
      maxSimilarity: 0,
      recommendation: "No existing posts to compare against.",
      topMatches: [],
      postsChecked: 0,
    };
  }

  const proposedText = [proposedTitle, proposedKeyword, proposedTopic].filter(Boolean).join(" | ");
  const existingTexts = posts.map((p: { title: string; excerpt: string | null; keywords: string[] | null }) =>
    [p.title ?? "", Array.isArray(p.keywords) ? p.keywords.join(", ") : "", p.excerpt ?? ""]
      .filter(Boolean)
      .join(" | ")
  );

  const allEmbeddings = await embedTexts([proposedText, ...existingTexts], apiKey);
  const proposedEmbedding = allEmbeddings[0];
  const existingEmbeddings = allEmbeddings.slice(1);

  const similarities = posts
    .map((post: { id: string; title: string; excerpt: string | null }, i: number) => ({
      postId: post.id,
      title: post.title,
      excerpt: post.excerpt ?? "",
      similarity: cosineSimilarity(proposedEmbedding, existingEmbeddings[i]),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  const topMatches: DuplicateMatch[] = similarities.slice(0, 5).map((m) => ({
    ...m,
    similarity: parseFloat(m.similarity.toFixed(4)),
    percentage: Math.round(m.similarity * 100),
    ...interpretSimilarity(m.similarity),
  }));

  const maxSimilarity = topMatches[0]?.similarity ?? 0;
  const { level, label, recommendation } = interpretSimilarity(maxSimilarity);

  return {
    hasDuplicate: level === "duplicate",
    riskLevel: level,
    riskLabel: label,
    maxSimilarity,
    recommendation,
    topMatches,
    postsChecked: posts.length,
  };
}
