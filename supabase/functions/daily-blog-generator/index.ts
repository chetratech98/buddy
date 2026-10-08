/**
 * daily-blog-generator — automatically writes one blog post per day from
 * each user's active 30-day content plan, so users don't have to manually
 * visit "Today's Blog" and click Generate every day.
 *
 * Each invocation processes AT MOST ONE user (see the loop below) — a full
 * generate-blog run (SERP + scraping + two LLM passes) is enough compute
 * that doing it for several users inside one invocation hits Supabase's
 * per-invocation resource limit. Instead, pg_cron fires this every few
 * minutes during a morning window (see the migration), and each tick
 * generates for the next user still due today.
 *
 * Workflow (for the first eligible user found):
 *   1. Compute "today's day number" the same way the Today's Blog page does:
 *      days elapsed since the plan's created_at, wrapped into a 1..plan.days cycle.
 *   2. Look up that day's topic/keyword/brief in plan.items.
 *   3. Skip if a post already exists for this user today (manual generation
 *      earlier today, or an earlier tick of this cron already ran for them).
 *   4. Call generate-blog (impersonating the user via a dedicated
 *      INTERNAL_FUNCTION_SECRET, not the service-role key — that key's
 *      representation isn't guaranteed to stay in sync across independently
 *      deployed functions reading it as an ambient env var) to write the
 *      post — reuses the exact same generation pipeline (competitor
 *      research, content intelligence, QA pass, quota check).
 *   5. Insert the result into blog_posts as a draft, identical to the manual flow.
 *
 * Can also be triggered manually via POST /daily-blog-generator, optionally
 * scoped to one user with { user_id }.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Pinned (not floating @2): esm.sh's build of the latest 2.117.0 release is
// currently broken (unresolvable auth-js submodule) — pin to the last known-
// good release until that's fixed upstream.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";
import { checkDuplicate } from "../_shared/duplicate-check.ts";
import { resolveWpSiteCredentials } from "../_shared/wp-site-resolver.ts";

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

/**
 * Counts how many of a user's configured publish weekdays (e.g. [1,3,5]
 * for Mon/Wed/Fri) have occurred strictly after `start`, up to and
 * including `end` — used to advance through the plan only on eligible
 * days instead of every calendar day, so a 3-day/week cadence spreads
 * the plan's items across ~2.3x as many calendar days instead of
 * silently skipping 4 of every 7 items.
 */
function countEligibleDaysBetween(start: Date, end: Date, publishDays: number[]): number {
  const days = publishDays.length > 0 ? publishDays : [0, 1, 2, 3, 4, 5, 6];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  let count = 0;
  while (cur < endDay) {
    cur.setDate(cur.getDate() + 1);
    if (days.includes(cur.getDay())) count++;
  }
  return count;
}

/** Mirrors TodaysPost.tsx's day computation so manual and automated generation always agree. */
function computeTodayDay(planCreatedAt: string, planLengthDays: number, publishDays: number[]): number {
  const created = new Date(planCreatedAt);
  const now = new Date();
  const eligibleDaysElapsed = countEligibleDaysBetween(created, now, publishDays);
  const cycle = planLengthDays > 0 ? planLengthDays : 30;
  return (eligibleDaysElapsed % cycle) + 1;
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
  const INTERNAL_FUNCTION_SECRET = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL || !INTERNAL_FUNCTION_SECRET) {
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

    // ── 2b. Load each user's configured publish weekdays ────────────────────
    const { data: cadenceProfiles } = await admin
      .from("profiles")
      .select("user_id, publish_days_of_week")
      .in("user_id", userIds);
    const publishDaysByUser = new Map<string, number[]>(
      (cadenceProfiles ?? []).map((p) => [p.user_id as string, (p.publish_days_of_week as number[]) ?? [0, 1, 2, 3, 4, 5, 6]])
    );
    const todayWeekday = new Date().getDay();

    // ── 3. Generate today's post for ONE eligible user per invocation ────────
    // generate-blog does SERP + scraping + two LLM passes per user, which is
    // enough compute on its own that running it for multiple users inside a
    // single invocation hits Supabase's per-invocation resource limit
    // (WORKER_RESOURCE_LIMIT) once there's more than a couple of users due on
    // the same run. Instead, each invocation does the cheap eligibility scan
    // over every user, generates for the first one that's actually due, then
    // returns — the cron fires every few minutes during the morning window
    // (see the migration), so a handful of users each get processed within a
    // few minutes of each other rather than one invocation trying to do all
    // of them at once.
    let generated = 0, skippedAlreadyPosted = 0, skippedNotPublishDay = 0, skippedNoItemForDay = 0, skippedQuota = 0, failed = 0, heldDuplicate = 0;
    const results: Array<{ user_id: string; status: string; detail?: string }> = [];

    for (const [userId, plan] of latestPlanByUser) {
      if (alreadyPostedToday.has(userId)) {
        skippedAlreadyPosted++;
        results.push({ user_id: userId, status: "skipped_already_posted" });
        continue;
      }

      const publishDays = publishDaysByUser.get(userId) ?? [0, 1, 2, 3, 4, 5, 6];
      if (!publishDays.includes(todayWeekday)) {
        skippedNotPublishDay++;
        results.push({ user_id: userId, status: "skipped_not_publish_day" });
        continue;
      }

      const todayDay = computeTodayDay(plan.created_at, plan.days ?? 30, publishDays);
      const items = Array.isArray(plan.items) ? (plan.items as ContentPlanItem[]) : [];
      const todayItem = items.find((item) => Number(item.day) === todayDay);

      if (!todayItem) {
        skippedNoItemForDay++;
        results.push({ user_id: userId, status: "skipped_no_item_for_day", detail: `day ${todayDay}` });
        continue;
      }

      try {
        const { data: publishProfile } = await admin
          .from("profiles")
          .select("content_language, auto_publish_enabled, require_review_before_publish, medium_integration_token, medium_author_id")
          .eq("user_id", userId)
          .single();

        // Checks the same precedence the actual publish step will use
        // (explicit site -> org/user default site -> legacy profile fields)
        // — a user who only ever set up a site via Settings > Sites and
        // never touched the old single-site profile form still counts as
        // having WordPress connected.
        const resolvedSite = await resolveWpSiteCredentials(admin, { userId, orgId: null, siteId: null });
        const hasWordPress = Boolean(resolvedSite);
        const hasMedium = Boolean(publishProfile?.medium_integration_token && publishProfile?.medium_author_id);

        // Posts that will be held for review don't get images up front — a
        // rejected post would have paid for two images it never uses. They're
        // generated on Approve instead (generate-post-images). Posts that
        // end up as plain drafts or auto-publish keep inline images.
        const deferImages = Boolean(publishProfile?.auto_publish_enabled)
          && Boolean(publishProfile?.require_review_before_publish)
          && (hasWordPress || hasMedium);

        const { data, error } = await admin.functions.invoke("generate-blog", {
          headers: { Authorization: `Bearer ${INTERNAL_FUNCTION_SECRET}` },
          body: {
            user_id: userId,
            topic: todayItem.title,
            keywords: [todayItem.keyword, todayItem.long_tail_keyword].filter(Boolean).join(", "),
            tone: plan.tone || "professional",
            language: publishProfile?.content_language || "English",
            skipImages: deferImages,
            targetWordCount: 2500,
            contentType: todayItem.type,
            contentPlanBrief: todayItem.description || "",
            niche: plan.niche || "",
          },
        });

        if (error) throw error;
        if (data?.error === "quota_exceeded") {
          skippedQuota++;
          results.push({ user_id: userId, status: "skipped_quota_exceeded" });
          // Quota-skip is cheap (no generation happened) — keep scanning for
          // another eligible user instead of ending the run on this one.
          continue;
        }
        if (data?.error) throw new Error(data.error);

        // ── Duplicate-topic safety net ───────────────────────────────────────
        // The content plan was deduped once, at plan-creation time, against
        // whatever posts existed back then — and the writer has creative
        // freedom, so the actual generated title can still drift into a
        // near-duplicate of something published since. Check-duplicate's
        // same ML similarity check already catches this interactively; this
        // runs it on the real generated output before deciding whether this
        // post is eligible to skip human review via auto-publish.
        let isNearDuplicate = false;
        let duplicateDetail: string | undefined;
        if (OPENAI_API_KEY) {
          try {
            const dupResult = await checkDuplicate(
              admin,
              userId,
              { title: data.title || todayItem.title, topic: todayItem.title, keyword: todayItem.keyword },
              OPENAI_API_KEY
            );
            isNearDuplicate = dupResult.hasDuplicate;
            if (isNearDuplicate) {
              duplicateDetail = `${Math.round(dupResult.maxSimilarity * 100)}% similar to "${dupResult.topMatches[0]?.title ?? "an existing post"}"`;
              console.log(`[daily-blog-generator] Day ${todayDay} near-duplicate detected for user ${userId}: ${duplicateDetail} — holding as draft regardless of auto-publish setting`);
            }
          } catch (dupErr) {
            console.warn(`[daily-blog-generator] Duplicate check failed for user ${userId}, proceeding without it:`, dupErr);
          }
        }

        // ── Auto-publish eligibility ────────────────────────────────────────
        // A generated post only skips the draft stage and gets scheduled for
        // immediate publish (picked up by the scheduled-publisher cron within
        // ~5 minutes) when the user has explicitly opted in, has at least one
        // platform fully connected, AND the post isn't a detected near-
        // duplicate. Anyone who doesn't meet all three keeps today's
        // behavior: a draft in Posts that a human reviews and publishes
        // themselves.
        // (publishProfile / hasWordPress / hasMedium were loaded above, before
        // generation, since deferring images depends on them too.)
        const autoPublish = Boolean(publishProfile?.auto_publish_enabled) && (hasWordPress || hasMedium) && !isNearDuplicate;

        // Opt-in safety net on top of auto-publish: instead of scheduling for
        // immediate publish, hold the post as "review" — a human has to
        // explicitly approve it (same publish-now pipeline, triggered from
        // the Content Manager's "In Review" tab) before it actually goes
        // out. Near-duplicates are already routed to plain "draft" above via
        // autoPublish being false, so this never applies to them.
        const needsReview = autoPublish && Boolean(publishProfile?.require_review_before_publish);

        const { error: insertError } = await admin.from("blog_posts").insert({
          user_id: userId,
          title: data.title || todayItem.title,
          excerpt: data.excerpt || "",
          content: data.content || "",
          keywords: data.keywords || [todayItem.keyword],
          og_image_prompt: data.ogImagePrompt || "",
          featured_image_url: data.featuredImageUrl || null,
          // generate-blog already measured these with the real scorer —
          // persist them directly instead of leaving seo_score/seo_title/
          // seo_description at their empty defaults for every auto-generated
          // post (they previously only got set when a human opened EditPost).
          seo_title: data.seoTitle || data.title || todayItem.title,
          seo_description: data.seoDescription || data.excerpt || "",
          seo_score: typeof data.seoScore === "number" ? data.seoScore : null,
          ...(needsReview
            ? {
                status: "review",
                platform_wordpress: hasWordPress,
                platform_medium: hasMedium,
              }
            : autoPublish
            ? {
                status: "scheduled",
                scheduled_at: new Date().toISOString(),
                platform_wordpress: hasWordPress,
                platform_medium: hasMedium,
              }
            : { status: "draft" }),
        });
        if (insertError) throw insertError;

        console.log(`[daily-blog-generator] Day ${todayDay} SEO score for user ${userId}: ${data.seoScore ?? "n/a"}/100${needsReview ? " | held for review" : autoPublish ? " | auto-publish: scheduled" : ""}${isNearDuplicate ? " | held: near-duplicate" : ""}`);

        generated++;
        if (isNearDuplicate) heldDuplicate++;
        results.push(
          isNearDuplicate
            ? { user_id: userId, status: "generated_held_duplicate", detail: duplicateDetail }
            : { user_id: userId, status: "generated" }
        );
        console.log(`[daily-blog-generator] Day ${todayDay} post generated for user ${userId}: "${todayItem.title}"`);
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ user_id: userId, status: "failed", detail: msg });
        console.error(`[daily-blog-generator] Failed for user ${userId}:`, msg);
      }

      // One real generation (success or failure) is enough compute for this
      // invocation — stop here and let the next cron tick pick up the rest.
      break;
    }

    const summary = {
      success: true,
      usersWithPlans: latestPlanByUser.size,
      generated,
      skippedAlreadyPosted,
      skippedNotPublishDay,
      skippedNoItemForDay,
      skippedQuota,
      failed,
      heldDuplicate,
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
