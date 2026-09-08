/**
 * daily-blog-generator — automatically writes one blog post per day from
 * each user's active 30-day content plan, so users don't have to manually
 * visit "Today's Blog" and click Generate every day.
 *
 * Workflow (per user with a content plan):
 *   1. Compute "today's day number" the same way the Today's Blog page does:
 *      days elapsed since the plan's created_at, wrapped into a 1..plan.days cycle.
 *   2. Look up that day's topic/keyword/brief in plan.items.
 *   3. Skip if a post already exists for this user today (manual generation
 *      earlier today, or this cron already ran once today).
 *   4. Call generate-blog (impersonating the user via the service-role auth
 *      path) to write the post — reuses the exact same generation pipeline
 *      (competitor research, content intelligence, QA pass, quota check).
 *   5. Insert the result into blog_posts as a draft, identical to the manual flow.
 *
 * Designed to run once daily via pg_cron → net.http_post (see the migration
 * for the commented cron.schedule() call). Can also be triggered manually via
 * POST /daily-blog-generator, optionally scoped to one user with { user_id }.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ContentPlanItem {
  day: number | string;
  title: string;
  type: string;
  keyword: string;
  long_tail_keyword?: string;
  description?: string;
}

interface ContentPlanRow {
  id: string;
  user_id: string;
  niche: string | null;
  tone: string | null;
  days: number | null;
  items: unknown;
  created_at: string;
}

/** Mirrors TodaysBlog.tsx's day computation so manual and automated generation always agree. */
function computeTodayDay(planCreatedAt: string, planLengthDays: number): number {
  const created = new Date(planCreatedAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  const cycle = planLengthDays > 0 ? planLengthDays : 30;
  return (diffDays % cycle) + 1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    return jsonResponse({ error: "Service role not configured" }, 500);
  }

  // Service-role client: reads/writes across all users, bypassing RLS by design —
  // this function only ever runs as a trusted cron job or admin-triggered call.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let targetUserId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    targetUserId = typeof body?.user_id === "string" ? body.user_id : null;
  } catch { /* no body provided — process all users */ }

  try {
    // ── 1. Load each user's most recent content plan ────────────────────────
    let plansQuery = admin
      .from("content_plans")
      .select("id, user_id, niche, tone, days, items, created_at")
      .order("created_at", { ascending: false });

    if (targetUserId) plansQuery = plansQuery.eq("user_id", targetUserId);

    const { data: allPlans, error: plansError } = await plansQuery;
    if (plansError) throw plansError;

    const latestPlanByUser = new Map<string, ContentPlanRow>();
    for (const plan of (allPlans ?? []) as ContentPlanRow[]) {
      if (!latestPlanByUser.has(plan.user_id)) latestPlanByUser.set(plan.user_id, plan);
    }

    console.log(`[daily-blog-generator] ${latestPlanByUser.size} user(s) with a content plan`);

    if (latestPlanByUser.size === 0) {
      return jsonResponse({ success: true, generated: 0, message: "No content plans found" });
    }

    // ── 2. Find who already has a post today — skip them (idempotent re-runs) ─
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const userIds = [...latestPlanByUser.keys()];
    const { data: todaysPosts } = await admin
      .from("blog_posts")
      .select("user_id")
      .in("user_id", userIds)
      .gte("created_at", todayStart.toISOString())
      .lte("created_at", todayEnd.toISOString());

    const alreadyPostedToday = new Set((todaysPosts ?? []).map((p) => p.user_id as string));

    // ── 3. Generate today's post for each eligible user ──────────────────────
    // Sequential, not parallel — generate-blog itself calls OpenAI/SerpApi/Firecrawl,
    // and running many users concurrently would hammer those rate limits at once.
    let generated = 0, skippedAlreadyPosted = 0, skippedNoItemForDay = 0, skippedQuota = 0, failed = 0;
    const results: Array<{ user_id: string; status: string; detail?: string }> = [];

    for (const [userId, plan] of latestPlanByUser) {
      if (alreadyPostedToday.has(userId)) {
        skippedAlreadyPosted++;
        results.push({ user_id: userId, status: "skipped_already_posted" });
        continue;
      }

      const todayDay = computeTodayDay(plan.created_at, plan.days ?? 30);
      const items = Array.isArray(plan.items) ? (plan.items as ContentPlanItem[]) : [];
      const todayItem = items.find((item) => Number(item.day) === todayDay);

      if (!todayItem) {
        skippedNoItemForDay++;
        results.push({ user_id: userId, status: "skipped_no_item_for_day", detail: `day ${todayDay}` });
        continue;
      }

      try {
        const { data, error } = await admin.functions.invoke("generate-blog", {
          headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
          body: {
            user_id: userId,
            topic: todayItem.title,
            keywords: [todayItem.keyword, todayItem.long_tail_keyword].filter(Boolean).join(", "),
            tone: plan.tone || "professional",
            targetWordCount: 1500,
            contentType: todayItem.type,
            contentPlanBrief: todayItem.description || "",
            niche: plan.niche || "",
          },
        });

        if (error) throw error;
        if (data?.error === "quota_exceeded") {
          skippedQuota++;
          results.push({ user_id: userId, status: "skipped_quota_exceeded" });
          continue;
        }
        if (data?.error) throw new Error(data.error);

        const { error: insertError } = await admin.from("blog_posts").insert({
          user_id: userId,
          title: data.title || todayItem.title,
          excerpt: data.excerpt || "",
          content: data.content || "",
          keywords: data.keywords || [todayItem.keyword],
          og_image_prompt: data.ogImagePrompt || "",
          status: "draft",
        });
        if (insertError) throw insertError;

        generated++;
        results.push({ user_id: userId, status: "generated" });
        console.log(`[daily-blog-generator] Day ${todayDay} post generated for user ${userId}: "${todayItem.title}"`);
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ user_id: userId, status: "failed", detail: msg });
        console.error(`[daily-blog-generator] Failed for user ${userId}:`, msg);
      }

      // Small pacing gap between users to avoid bursting shared API rate limits.
      await new Promise((r) => setTimeout(r, 500));
    }

    const summary = {
      success: true,
      usersWithPlans: latestPlanByUser.size,
      generated,
      skippedAlreadyPosted,
      skippedNoItemForDay,
      skippedQuota,
      failed,
    };

    await admin.from("daily_blog_generator_runs").insert(summary);

    console.log("[daily-blog-generator] Summary:", JSON.stringify(summary));
    return jsonResponse({ ...summary, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[daily-blog-generator] Fatal error:", msg);
    return jsonResponse({ error: "Daily blog generation failed", detail: msg }, 500);
  }
});
