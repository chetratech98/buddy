/**
 * Medium publisher (https://github.com/Medium/medium-api-docs) — extracted
 * from scheduled-publisher so the interactive "Publish Now" flow can reuse
 * the exact same logic instead of only being reachable via the cron.
 */

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

export interface MediumCredentialProfile {
  medium_integration_token?: string | null;
  medium_author_id?: string | null;
}

export async function publishToMedium(
  post: Record<string, unknown>,
  profile: MediumCredentialProfile
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
