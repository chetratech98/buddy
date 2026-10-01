/**
 * check-duplicate — ML-powered topic similarity detection using OpenAI embeddings.
 *
 * Workflow:
 *   1. Receive proposed title + topic from the frontend
 *   2. Fetch user's existing published/draft posts (title + excerpt)
 *   3. Embed the proposed text + all existing posts using text-embedding-3-small
 *   4. Calculate cosine similarity between proposed and each existing post
 *   5. Return the top matches with similarity scores
 *
 * Thresholds:
 *   ≥ 0.92  — Near-duplicate / keyword cannibalization risk (block/warn strongly)
 *   0.80–0.92 — High similarity — recommend differentiation
 *   0.65–0.80 — Moderate overlap — suggest internal linking
 *   < 0.65  — Safe to publish
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cosineSimilarity, embedTexts } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─────────────────────────────────────────────────────────────────────────────
// Interpret similarity score
// ─────────────────────────────────────────────────────────────────────────────
function interpretSimilarity(score: number): {
  level: "duplicate" | "high" | "moderate" | "safe";
  label: string;
  recommendation: string;
} {
  if (score >= 0.92) return {
    level:          "duplicate",
    label:          "Near-duplicate",
    recommendation: "This topic is extremely similar to an existing post. Publishing it will cause keyword cannibalization. Either update the existing post or choose a meaningfully different angle.",
  };
  if (score >= 0.80) return {
    level:          "high",
    label:          "High similarity",
    recommendation: "Strong topical overlap detected. Differentiate by targeting a different search intent, adding a unique angle, or consolidating with the existing post.",
  };
  if (score >= 0.65) return {
    level:          "moderate",
    label:          "Moderate overlap",
    recommendation: "Related topics detected. This is fine to publish, but consider adding an internal link to the similar existing post.",
  };
  return {
    level:          "safe",
    label:          "No duplicate",
    recommendation: "Topic is sufficiently unique — safe to create.",
  };
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
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    // ── Input ─────────────────────────────────────────────────────────────────
    const body = await req.json();
    const proposedTitle   = typeof body.title   === "string" ? body.title.trim().slice(0, 200)   : "";
    const proposedTopic   = typeof body.topic   === "string" ? body.topic.trim().slice(0, 500)   : "";
    const proposedKeyword = typeof body.keyword === "string" ? body.keyword.trim().slice(0, 100) : "";

    if (!proposedTitle && !proposedTopic) {
      return jsonResponse({ error: "Title or topic is required" }, 400);
    }

    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY not configured");

    // ── Fetch existing posts ──────────────────────────────────────────────────
    const { data: posts, error: postsError } = await supabase
      .from("blog_posts")
      .select("id, title, excerpt, keywords")
      .eq("user_id", user.id)
      .in("status", ["published", "draft", "scheduled", "review"])
      .order("created_at", { ascending: false })
      .limit(100); // check against last 100 posts

    if (postsError) throw postsError;

    if (!posts || posts.length === 0) {
      return jsonResponse({
        hasDuplicate: false,
        topMatches: [],
        proposedText: proposedTitle || proposedTopic,
        message: "No existing posts to compare against.",
      });
    }

    // ── Build text representations ────────────────────────────────────────────
    // Proposed: combine title + topic + keyword for richest semantic signal
    const proposedText = [proposedTitle, proposedKeyword, proposedTopic]
      .filter(Boolean)
      .join(" | ");

    // Existing: title + excerpt + keywords
    const existingTexts = posts.map((p) => {
      const parts = [
        p.title ?? "",
        Array.isArray(p.keywords) ? p.keywords.join(", ") : "",
        p.excerpt ?? "",
      ].filter(Boolean);
      return parts.join(" | ");
    });

    // ── Embed all in one API call (batch) ─────────────────────────────────────
    console.log(`[check-duplicate] Embedding 1 proposed + ${existingTexts.length} existing posts`);
    const allTexts     = [proposedText, ...existingTexts];
    const allEmbeddings = await embedTexts(allTexts, OPENAI_KEY);

    const proposedEmbedding  = allEmbeddings[0];
    const existingEmbeddings = allEmbeddings.slice(1);

    // ── Calculate similarity scores ───────────────────────────────────────────
    const similarities = posts.map((post, i) => ({
      postId:     post.id,
      title:      post.title,
      excerpt:    post.excerpt ?? "",
      similarity: cosineSimilarity(proposedEmbedding, existingEmbeddings[i]),
    }));

    // Sort by similarity descending
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Take top 5 matches
    const topMatches = similarities.slice(0, 5).map((m) => ({
      ...m,
      similarity:    parseFloat(m.similarity.toFixed(4)),
      percentage:    Math.round(m.similarity * 100),
      ...interpretSimilarity(m.similarity),
    }));

    // Overall duplicate status: based on the highest similarity score
    const maxSimilarity = topMatches[0]?.similarity ?? 0;
    const { level, label, recommendation } = interpretSimilarity(maxSimilarity);

    console.log(
      `[check-duplicate] Max similarity: ${(maxSimilarity * 100).toFixed(1)}% (${label}) against "${topMatches[0]?.title ?? "none"}"`
    );

    return jsonResponse({
      hasDuplicate:    level === "duplicate",
      riskLevel:       level,
      riskLabel:       label,
      maxSimilarity:   parseFloat(maxSimilarity.toFixed(4)),
      recommendation,
      topMatches,
      proposedText,
      postsChecked:    posts.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[check-duplicate] Error:", msg);

    if (msg.includes("429")) {
      return jsonResponse({ error: "Rate limit exceeded. Try again shortly." }, 429);
    }
    return jsonResponse({ error: "Duplicate check failed" }, 500);
  }
});
