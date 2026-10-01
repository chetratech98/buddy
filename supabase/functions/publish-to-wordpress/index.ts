import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isUrlSafeToFetch } from "../_shared/scraping.ts";
import { resolveWpPassword } from "../_shared/wp-crypto.ts";
import { uploadFeaturedImageToWordPress } from "../_shared/wp-media.ts";
import { buildPostSchemas, schemaScriptTag } from "../_shared/schema.ts";
import { resolveWpTermIds } from "../_shared/wp-taxonomy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WordPressPost {
  title: string;
  content: string;
  status: 'publish' | 'draft';
  excerpt?: string;
  categories?: number[];
  tags?: number[];
  date?: string;
  featured_media?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get user from token
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const { postId } = await req.json();

    if (!postId) {
      throw new Error("Post ID is required");
    }

    // Get post data
    const { data: post, error: postError } = await supabaseClient
      .from("blog_posts")
      .select("*")
      .eq("id", postId)
      .eq("user_id", user.id)
      .single();

    if (postError || !post) {
      throw new Error("Post not found or access denied");
    }

    // Get user's WordPress credentials
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("wp_url, wp_username, wp_app_password_enc, wp_app_password, display_name")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    const { wp_url, wp_username } = profile;

    // Resolve password: prefer encrypted, fall back to legacy plaintext
    const resolved = await resolveWpPassword(profile, Deno.env.get("WP_ENCRYPTION_KEY"));
    if ("error" in resolved) {
      throw new Error(
        profile.wp_app_password_enc || profile.wp_app_password
          ? resolved.error
          : "WordPress credentials not configured. Please add your WordPress site URL, username, and application password in your profile settings."
      );
    }
    const wp_app_password = resolved.password;

    if (!wp_url || !wp_username) {
      throw new Error("WordPress URL or username not configured. Please update your profile settings.");
    }

    const urlCheck = isUrlSafeToFetch(wp_url);
    if (!urlCheck.safe) {
      throw new Error(`Invalid WordPress URL: ${urlCheck.reason}. Please re-save your WordPress settings.`);
    }
    const safeWpUrl = urlCheck.normalized!;

    // Append structured data (BlogPosting + FAQPage, when a FAQ section is
    // detected) so the post can actually claim rich-snippet eligibility
    // instead of just having FAQ text with no schema backing it.
    const schemas = buildPostSchemas({
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      featuredImageUrl: post.featured_image_url,
      publishedAt: post.published_at,
      authorName: profile.display_name,
    });
    const contentWithSchema = `${post.content}\n\n${schemaScriptTag(schemas)}`;

    // Resolve the post's plain category/tags into WP taxonomy term IDs —
    // creating the term in WP if it doesn't already exist. Never blocks
    // publishing if a lookup/create fails.
    const [categoryIds, tagIds] = await Promise.all([
      resolveWpTermIds(post.category ? [post.category] : [], "categories", safeWpUrl, wp_username, wp_app_password),
      resolveWpTermIds(post.tags, "tags", safeWpUrl, wp_username, wp_app_password),
    ]);

    // Prepare WordPress post data
    const wpPost: WordPressPost = {
      title: post.title,
      content: contentWithSchema,
      status: post.status === 'published' ? 'publish' : 'draft',
      excerpt: post.excerpt || '',
      ...(categoryIds.length > 0 && { categories: categoryIds }),
      ...(tagIds.length > 0 && { tags: tagIds }),
    };

    if (post.scheduled_at && post.status === 'scheduled') {
      wpPost.date = new Date(post.scheduled_at).toISOString();
      wpPost.status = 'publish';
    }

    // Upload the AI-generated featured image into WP's media library, if
    // there is one — never blocks publishing if the upload fails.
    if (post.featured_image_url) {
      const mediaId = await uploadFeaturedImageToWordPress(post.featured_image_url, safeWpUrl, wp_username, wp_app_password);
      if (mediaId) wpPost.featured_media = mediaId;
    }

    // WordPress REST API endpoint
    const wpApiUrl = `${safeWpUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts`;

    // Create Basic Auth header
    const authString = btoa(`${wp_username}:${wp_app_password}`);
    
    // Publish to WordPress
    const wpResponse = await fetch(wpApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify(wpPost),
    });

    if (!wpResponse.ok) {
      const errorText = await wpResponse.text();
      throw new Error(`WordPress API error: ${wpResponse.status} - ${errorText}`);
    }

    const wpData = await wpResponse.json();

    // Log the publishing result
    await supabaseClient.from("publishing_logs").insert({
      post_id: postId,
      platform: 'wordpress',
      status: 'success',
      message: `Published successfully. WordPress Post ID: ${wpData.id}`,
      response_data: wpData,
    });

    // Update post platform status
    const platformStatus = post.platform_status || {};
    platformStatus.wordpress = {
      published: true,
      publishedAt: new Date().toISOString(),
      wordpressId: wpData.id,
      wordpressUrl: wpData.link,
    };

    await supabaseClient
      .from("blog_posts")
      .update({ platform_status: platformStatus, canonical_url: wpData.link })
      .eq("id", postId);

    return new Response(
      JSON.stringify({
        success: true,
        wordpressId: wpData.id,
        wordpressUrl: wpData.link,
        message: "Post published to WordPress successfully!",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("WordPress publish error:", error);

    // Log the error
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {
          global: {
            headers: { Authorization: req.headers.get("Authorization")! },
          },
        }
      );

      const { postId } = await req.json();
      if (postId) {
        await supabaseClient.from("publishing_logs").insert({
          post_id: postId,
          platform: 'wordpress',
          status: 'error',
          message: error.message,
        });
      }
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
