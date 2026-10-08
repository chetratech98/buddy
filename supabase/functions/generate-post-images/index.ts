/**
 * generate-post-images — backfills the featured + in-body images for an
 * already-saved post. Posts that daily-blog-generator holds for review are
 * generated WITHOUT images (generate-blog's skipImages), so a rejected post
 * never pays for them; Approve calls this just before publishing.
 *
 * Idempotent: only generates what's missing, so calling it on a post that
 * already has both images costs nothing.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";
import {
  generatePostImage,
  hasGeneratedBodyImage,
  pickBodySectionForImage,
  insertImageAfterHeading,
  bodyImagePrompt,
} from "../_shared/post-images.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) return jsonResponse({ error: "OPENAI_API_KEY not configured" }, 500);

    // User-scoped client: RLS keeps reads/writes (and the Storage upload
    // path) to the caller's own posts.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const postId = typeof body?.postId === "string" ? body.postId : "";
    if (!postId) return jsonResponse({ error: "postId is required" }, 400);

    const { data: post, error: postError } = await supabase
      .from("blog_posts")
      .select("id, title, content, og_image_prompt, featured_image_url")
      .eq("id", postId)
      .eq("user_id", user.id)
      .single();
    if (postError || !post) return jsonResponse({ error: "Post not found" }, 404);

    const content: string = post.content ?? "";
    const needsFeatured = !post.featured_image_url && Boolean(post.og_image_prompt);
    const bodySection = hasGeneratedBodyImage(content) ? null : pickBodySectionForImage(content);

    if (!needsFeatured && !bodySection) {
      return jsonResponse({ success: true, generated: { featured: false, body: false } });
    }

    const logBase = { functionName: "generate-post-images", postId };
    const [featuredUrl, bodyUrl] = await Promise.all([
      needsFeatured
        ? generatePostImage(post.og_image_prompt, OPENAI_API_KEY, supabase, user.id, { ...logBase, purpose: "featured_image" })
        : Promise.resolve(null),
      bodySection
        ? generatePostImage(bodyImagePrompt(bodySection.heading, post.title, post.og_image_prompt ?? ""), OPENAI_API_KEY, supabase, user.id, { ...logBase, purpose: "body_image" })
        : Promise.resolve(null),
    ]);

    const update: Record<string, string> = {};
    if (featuredUrl) update.featured_image_url = featuredUrl;
    if (bodyUrl && bodySection) {
      update.content = insertImageAfterHeading(content, bodySection.lineIndex, bodyUrl, bodySection.heading);
    }

    if (Object.keys(update).length > 0) {
      const { error: updateError } = await supabase.from("blog_posts").update(update).eq("id", postId);
      if (updateError) throw updateError;
    }

    return jsonResponse({
      success: true,
      generated: { featured: Boolean(featuredUrl), body: Boolean(bodyUrl) },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[generate-post-images] Error:", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
