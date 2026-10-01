/**
 * Uploads an already-hosted image (e.g. a post's featured_image_url, stored
 * in the post-images Supabase Storage bucket) into a WordPress site's media
 * library, returning the resulting attachment ID for use as featured_media
 * on a post create call. Never throws — a failed upload should never block
 * publishing the post itself; it just means the post ships without a
 * featured image that run.
 */
export async function uploadFeaturedImageToWordPress(
  imageUrl: string,
  wpUrl: string,
  wpUsername: string,
  wpAppPassword: string
): Promise<number | null> {
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      console.warn(`[wp-media] Failed to fetch source image: HTTP ${imgRes.status}`);
      return null;
    }
    const bytes = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get("content-type") || "image/png";
    const filename = (imageUrl.split("/").pop() || "featured-image.png").split("?")[0];

    const auth = btoa(`${wpUsername}:${wpAppPassword}`);
    const mediaRes = await fetch(`${wpUrl.replace(/\/$/, "")}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
      body: bytes,
    });

    if (!mediaRes.ok) {
      console.warn(`[wp-media] Media upload failed: HTTP ${mediaRes.status}`);
      return null;
    }

    const data = await mediaRes.json();
    return typeof data.id === "number" ? data.id : null;
  } catch (e) {
    console.warn("[wp-media] Media upload error:", e);
    return null;
  }
}
