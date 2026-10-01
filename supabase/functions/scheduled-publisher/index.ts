import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveWpPassword, type WpCredentialProfile } from "../_shared/wp-crypto.ts";
import { uploadFeaturedImageToWordPress } from "../_shared/wp-media.ts";
import { buildPostSchemas, schemaScriptTag } from "../_shared/schema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Convert markdown to basic HTML for platforms that need it */
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[h|u|p|l])(.+)$/gm, "<p>$1</p>");
}

/** Retry a fetch up to maxRetries times with exponential back-off */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
  baseDelayMs = 1000
): Promise<Response> {
  let lastError: Error = new Error("Unknown error");
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status < 500) return res; // 4xx = client error, don't retry
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e as Error;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// WordPress publisher
// ─────────────────────────────────────────────────────────────────────────────
async function publishToWordPress(
  post: Record<string, unknown>,
  profile: WpCredentialProfile & { display_name?: string | null },
  wpEncryptionKey: string | undefined
): Promise<{ wordpressId: number; wordpressUrl: string }> {
  const { wp_url, wp_username } = profile;
  if (!wp_url || !wp_username) {
    throw new Error("WordPress credentials incomplete in profile");
  }
  const resolved = await resolveWpPassword(profile, wpEncryptionKey);
  if ("error" in resolved) throw new Error(resolved.error);
  const wp_app_password = resolved.password;

  const apiUrl = `${wp_url.replace(/\/$/, "")}/wp-json/wp/v2/posts`;
  const auth   = btoa(`${wp_username}:${wp_app_password}`);

  // Upload the AI-generated featured image into WP's media library first, if
  // there is one — never blocks publishing if the upload fails.
  let featuredMediaId: number | null = null;
  if (typeof post.featured_image_url === "string" && post.featured_image_url) {
    featuredMediaId = await uploadFeaturedImageToWordPress(post.featured_image_url, wp_url, wp_username, wp_app_password);
  }

  // Structured data: BlogPosting + FAQPage (when a FAQ section is detected)
  // so the post can actually claim the rich-snippet eligibility it was
  // written for, instead of just having FAQ text with no schema backing it.
  const schemas = buildPostSchemas({
    title: String(post.title ?? ""),
    excerpt: typeof post.excerpt === "string" ? post.excerpt : undefined,
    content: String(post.content ?? ""),
    featuredImageUrl: typeof post.featured_image_url === "string" ? post.featured_image_url : null,
    publishedAt: typeof post.published_at === "string" ? post.published_at : null,
    authorName: profile.display_name ?? null,
  });
  const contentWithSchema = `${markdownToHtml(String(post.content ?? ""))}\n\n${schemaScriptTag(schemas)}`;

  const res = await fetchWithRetry(
    apiUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        title:   post.title,
        content: contentWithSchema,
        excerpt: post.excerpt ?? "",
        status:  "publish",
        ...(post.seo_title       && { meta: { _yoast_wpseo_title: post.seo_title } }),
        ...(post.seo_description && { meta: { _yoast_wpseo_metadesc: post.seo_description } }),
        ...(featuredMediaId      && { featured_media: featuredMediaId }),
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WordPress API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return { wordpressId: data.id, wordpressUrl: data.link };
}

// ─────────────────────────────────────────────────────────────────────────────
// Medium publisher  (https://github.com/Medium/medium-api-docs)
// ─────────────────────────────────────────────────────────────────────────────
async function publishToMedium(
  post: Record<string, unknown>,
  profile: Record<string, string>
): Promise<{ mediumId: string; mediumUrl: string }> {
  const { medium_integration_token, medium_author_id } = profile;
  if (!medium_integration_token || !medium_author_id) {
    throw new Error("Medium credentials incomplete — token and author ID are required");
  }

  const tagsArray = Array.isArray(post.tags)
    ? (post.tags as string[]).slice(0, 5)
    : [];

  // Medium has no separate "featured image" field — the standard way to get
  // a lead image on a Medium post is a markdown image as the first line.
  const mediumContent = typeof post.featured_image_url === "string" && post.featured_image_url
    ? `![](${post.featured_image_url})\n\n${post.content ?? ""}`
    : String(post.content ?? "");

  const res = await fetchWithRetry(
    `https://api.medium.com/v1/users/${medium_author_id}/posts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${medium_integration_token}`,
      },
      body: JSON.stringify({
        title:         post.title,
        contentFormat: "markdown",
        content:       mediumContent,
        tags:          tagsArray,
        publishStatus: "public",
        ...(post.canonical_url && { canonicalUrl: post.canonical_url }),
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Medium API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const mediumPost = data.data;
  return { mediumId: mediumPost.id, mediumUrl: mediumPost.url };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  const wpEncryptionKey = Deno.env.get("WP_ENCRYPTION_KEY");

  type PublishResult = {
    postId: string;
    title: string;
    platforms: Record<string, { status: string; url?: string; error?: string }>;
  };

  const results: PublishResult[] = [];

  try {
    // Fetch all posts whose scheduled_at has passed and are still "scheduled"
    const { data: scheduledPosts, error: fetchError } = await admin
      .from("blog_posts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString());

    if (fetchError) throw fetchError;

    console.log(`[scheduler] Processing ${scheduledPosts?.length ?? 0} scheduled posts`);

    for (const post of scheduledPosts ?? []) {
      const platformResults: PublishResult["platforms"] = {};

      // Step 1: Mark published immediately (optimistic update)
      const { error: updateError } = await admin
        .from("blog_posts")
        .update({
          status:       "published",
          published_at: new Date().toISOString(),
        })
        .eq("id", post.id);

      if (updateError) {
        console.error(`[scheduler] Failed to mark post ${post.id} as published:`, updateError);
        results.push({ postId: post.id, title: post.title, platforms: { internal: { status: "error", error: updateError.message } } });
        continue;
      }

      // Step 2: Load user profile for platform credentials
      const { data: profile } = await admin
        .from("profiles")
        .select("wp_url, wp_username, wp_app_password, wp_app_password_enc, medium_integration_token, medium_author_id, display_name")
        .eq("user_id", post.user_id)
        .single();

      const platformStatus: Record<string, unknown> = { ...(post.platform_status ?? {}) };
      // Prefer the WordPress URL as canonical (primary self-hosted site);
      // falls back to Medium's URL if only that platform is published to.
      let canonicalUrl: string | undefined;

      // Step 3: WordPress
      if (post.platform_wordpress && profile) {
        try {
          const { wordpressId, wordpressUrl } = await publishToWordPress(
            post as Record<string, unknown>,
            profile as WpCredentialProfile,
            wpEncryptionKey
          );
          platformStatus.wordpress = {
            published:   true,
            publishedAt: new Date().toISOString(),
            wordpressId,
            wordpressUrl,
          };
          platformResults.wordpress = { status: "success", url: wordpressUrl };
          canonicalUrl = wordpressUrl;

          await admin.from("publishing_logs").insert({
            post_id:       post.id,
            platform:      "wordpress",
            status:        "success",
            message:       `Scheduled publish succeeded. WP ID: ${wordpressId}`,
            response_data: { wordpressId, wordpressUrl },
          });
        } catch (wpErr) {
          const msg = wpErr instanceof Error ? wpErr.message : String(wpErr);
          console.error(`[scheduler] WordPress failed for ${post.id}:`, msg);
          platformResults.wordpress = { status: "error", error: msg };
          await admin.from("publishing_logs").insert({
            post_id:  post.id,
            platform: "wordpress",
            status:   "error",
            message:  msg,
          });
        }
      }

      // Step 4: Medium
      if (post.platform_medium && profile) {
        try {
          const { mediumId, mediumUrl } = await publishToMedium(
            post as Record<string, unknown>,
            profile as Record<string, string>
          );
          platformStatus.medium = {
            published:   true,
            publishedAt: new Date().toISOString(),
            mediumId,
            mediumUrl,
          };
          platformResults.medium = { status: "success", url: mediumUrl };
          canonicalUrl ??= mediumUrl;

          await admin.from("publishing_logs").insert({
            post_id:       post.id,
            platform:      "medium",
            status:        "success",
            message:       `Scheduled publish succeeded. Medium ID: ${mediumId}`,
            response_data: { mediumId, mediumUrl },
          });
        } catch (mErr) {
          const msg = mErr instanceof Error ? mErr.message : String(mErr);
          console.error(`[scheduler] Medium failed for ${post.id}:`, msg);
          platformResults.medium = { status: "error", error: msg };
          await admin.from("publishing_logs").insert({
            post_id:  post.id,
            platform: "medium",
            status:   "error",
            message:  msg,
          });
        }
      }

      // Step 5: Persist platform_status (and canonical_url, if we got one) back to the post
      if (Object.keys(platformStatus).length > 0 || canonicalUrl) {
        await admin
          .from("blog_posts")
          .update({
            platform_status: platformStatus,
            ...(canonicalUrl && { canonical_url: canonicalUrl }),
          })
          .eq("id", post.id);
      }

      platformResults.internal = { status: "success" };
      results.push({ postId: post.id, title: post.title, platforms: platformResults });
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[scheduler] Fatal error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
