/**
 * publish-now — the synchronous, interactive counterpart to
 * scheduled-publisher's cron pipeline. Before this function existed,
 * clicking "Publish Now" in CreatePost/EditPost only ever set
 * blog_posts.status = "published" directly — it never called WordPress or
 * Medium at all, regardless of the platform_wordpress/platform_medium
 * toggles. The only path that ever reached a real platform was choosing
 * "Scheduled" and waiting for the cron.
 *
 * This function makes "Publish Now" actually mean now: it marks the post
 * published internally first (so publish-to-wordpress's own status check
 * sends WordPress "publish" rather than "draft"), then synchronously
 * attempts each toggled platform and returns the real per-platform result
 * so the UI can report what actually happened instead of a blind "success".
 *
 * Mirrors scheduled-publisher's own semantics: the internal "published"
 * state is independent of external delivery success — a platform failure
 * is surfaced to the caller and logged, not reverted.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { publishToMedium } from "../_shared/medium-publish.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PlatformResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * supabase-js's functions.invoke() error for a non-2xx response is a
 * generic "Edge Function returned a non-2xx status code" — the actual
 * reason the called function failed lives in error.context (the raw
 * Response), not error.message. Reads it out so the real reason reaches
 * the UI instead of this placeholder text.
 */
async function describeFunctionsError(error: unknown): Promise<Error> {
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.clone().json();
      if (body?.error) return new Error(String(body.error));
    } catch { /* not JSON — fall through to text */ }
    try {
      const text = await ctx.clone().text();
      if (text) return new Error(text.slice(0, 300));
    } catch { /* fall through to generic message */ }
  }
  return error instanceof Error ? error : new Error(String(error));
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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    // User-scoped client: RLS keeps every read/write below scoped to the
    // caller's own posts, and the same Authorization header is forwarded
    // when invoking publish-to-wordpress so it authenticates as this user.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const postId = typeof body?.postId === "string" ? body.postId : "";
    if (!postId) return jsonResponse({ error: "postId is required" }, 400);

    const { data: post, error: postError } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("id", postId)
      .eq("user_id", user.id)
      .single();

    if (postError || !post) return jsonResponse({ error: "Post not found" }, 404);

    // Mark published internally FIRST — publish-to-wordpress re-fetches the
    // post and sends WordPress "publish" vs. "draft" based on this exact
    // status, so it must already be "published" before that call happens.
    const { error: markError } = await supabase
      .from("blog_posts")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", postId);
    if (markError) throw markError;

    const results: { wordpress?: PlatformResult; medium?: PlatformResult } = {};
    let canonicalUrl: string | undefined;

    if (post.platform_wordpress) {
      try {
        const { data, error } = await supabase.functions.invoke("publish-to-wordpress", {
          body: { postId },
        });
        if (error) throw await describeFunctionsError(error);
        if (data?.error) throw new Error(data.error);
        results.wordpress = { success: true, url: data?.wordpressUrl };
        canonicalUrl = data?.wordpressUrl;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[publish-now] WordPress failed for ${postId}:`, msg);
        results.wordpress = { success: false, error: msg };
      }
    }

    if (post.platform_medium) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("medium_integration_token, medium_author_id")
          .eq("user_id", user.id)
          .single();

        const { mediumId, mediumUrl } = await publishToMedium(post, profile ?? {});
        results.medium = { success: true, url: mediumUrl };
        canonicalUrl ??= mediumUrl;

        // Re-read platform_status so we merge onto whatever the WordPress
        // step above may have just written, instead of clobbering it.
        const { data: current } = await supabase
          .from("blog_posts")
          .select("platform_status")
          .eq("id", postId)
          .single();

        await supabase
          .from("blog_posts")
          .update({
            platform_status: {
              ...(current?.platform_status ?? {}),
              medium: { published: true, publishedAt: new Date().toISOString(), mediumId, mediumUrl },
            },
            // Only set canonical_url here if WordPress didn't already set
            // its own (WP is preferred as the canonical, self-hosted URL).
            ...(!results.wordpress?.success && { canonical_url: mediumUrl }),
          })
          .eq("id", postId);

        await supabase.from("publishing_logs").insert({
          post_id:       postId,
          platform:      "medium",
          status:        "success",
          message:       `Publish succeeded. Medium ID: ${mediumId}`,
          response_data: { mediumId, mediumUrl },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[publish-now] Medium failed for ${postId}:`, msg);
        results.medium = { success: false, error: msg };
        await supabase.from("publishing_logs").insert({
          post_id:  postId,
          platform: "medium",
          status:   "error",
          message:  msg,
        });
      }
    }

    return jsonResponse({ success: true, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[publish-now] Fatal error:", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
