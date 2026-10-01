/**
 * check-duplicate — ML-powered topic similarity detection using OpenAI embeddings.
 *
 * Thin HTTP wrapper around _shared/duplicate-check.ts's checkDuplicate(),
 * which daily-blog-generator also calls directly (in-process, no HTTP
 * round-trip) to run this same check on its own generated output.
 *
 * Thresholds:
 *   ≥ 0.92  — Near-duplicate / keyword cannibalization risk (block/warn strongly)
 *   0.80–0.92 — High similarity — recommend differentiation
 *   0.65–0.80 — Moderate overlap — suggest internal linking
 *   < 0.65  — Safe to publish
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkDuplicate } from "../_shared/duplicate-check.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const proposedTitle   = typeof body.title   === "string" ? body.title   : "";
    const proposedTopic   = typeof body.topic   === "string" ? body.topic   : "";
    const proposedKeyword = typeof body.keyword === "string" ? body.keyword : "";

    if (!proposedTitle.trim() && !proposedTopic.trim()) {
      return jsonResponse({ error: "Title or topic is required" }, 400);
    }

    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY not configured");

    const result = await checkDuplicate(
      supabase,
      user.id,
      { title: proposedTitle, topic: proposedTopic, keyword: proposedKeyword },
      OPENAI_KEY
    );

    console.log(
      `[check-duplicate] Max similarity: ${(result.maxSimilarity * 100).toFixed(1)}% (${result.riskLabel}) against "${result.topMatches[0]?.title ?? "none"}"`
    );

    return jsonResponse({
      ...result,
      proposedText: [proposedTitle.trim(), proposedKeyword.trim(), proposedTopic.trim()].filter(Boolean).join(" | "),
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
