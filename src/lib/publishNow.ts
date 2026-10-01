import { supabase } from "@/integrations/supabase/client";

export interface PlatformResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface PublishNowResult {
  wordpress?: PlatformResult;
  medium?: PlatformResult;
}

/**
 * Synchronously publishes an already-saved post to whichever platforms it
 * has toggled on (platform_wordpress/platform_medium), returning the real
 * per-platform outcome. Call this right after saving a post with
 * status "published" and at least one platform toggle on — "Publish Now"
 * otherwise only marks the post published internally with no external
 * delivery.
 */
export async function publishPostNow(postId: string): Promise<PublishNowResult> {
  const { data, error } = await supabase.functions.invoke("publish-now", {
    body: { postId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.results ?? {}) as PublishNowResult;
}

/** Builds a human-readable toast description from a publish-now result. */
export function describePublishResult(result: PublishNowResult): { title: string; description: string; hasFailure: boolean } {
  const parts: string[] = [];
  let hasFailure = false;

  if (result.wordpress) {
    if (result.wordpress.success) parts.push("WordPress ✓");
    else { parts.push(`WordPress failed: ${result.wordpress.error}`); hasFailure = true; }
  }
  if (result.medium) {
    if (result.medium.success) parts.push("Medium ✓");
    else { parts.push(`Medium failed: ${result.medium.error}`); hasFailure = true; }
  }

  if (parts.length === 0) {
    return { title: "Post published!", description: "", hasFailure: false };
  }
  return {
    title: hasFailure ? "Published, with issues" : "Published!",
    description: parts.join(" — "),
    hasFailure,
  };
}
