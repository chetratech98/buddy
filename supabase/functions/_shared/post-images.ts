import { estimateImageCost, logAiUsage } from "./ai-usage.ts";

// Structural type so callers on any supabase-js version can pass their client.
// deno-lint-ignore no-explicit-any
type StorageCapableClient = { storage: { from: (bucket: string) => any } };

const IMAGE_MODEL = "gpt-image-1";
const IMAGE_SIZE = "1536x1024";

// "low" is roughly a quarter of "medium" per image. Override per-deployment
// with the IMAGE_QUALITY secret (low | medium | high) if the visual quality
// isn't good enough for a given use.
function imageQuality(): string {
  const q = (Deno.env.get("IMAGE_QUALITY") ?? "low").toLowerCase();
  return ["low", "medium", "high"].includes(q) ? q : "low";
}

export interface ImageLogContext {
  functionName: string;
  purpose: "featured_image" | "body_image";
  postId?: string | null;
}

/**
 * Generates one image from `prompt` and persists it to the post-images
 * Storage bucket. Never throws — a failed image (rate limit, content policy,
 * etc.) must never block the post itself; the caller just gets null.
 */
export async function generatePostImage(
  prompt: string,
  apiKey: string,
  supabase: StorageCapableClient,
  userId: string,
  log: ImageLogContext
): Promise<string | null> {
  if (!prompt) return null;
  const quality = imageQuality();
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt: prompt.slice(0, 4000),
        size: IMAGE_SIZE,
        quality,
        n: 1,
      }),
    });

    if (!res.ok) {
      console.warn(`[post-images] Image generation failed: HTTP ${res.status}`);
      return null;
    }

    // Billed once the API has returned an image, regardless of whether the
    // upload below succeeds.
    await logAiUsage({
      userId,
      postId: log.postId,
      functionName: log.functionName,
      kind: "image",
      purpose: log.purpose,
      model: IMAGE_MODEL,
      imageCount: 1,
      estCostUsd: estimateImageCost(IMAGE_MODEL, quality, IMAGE_SIZE, 1),
    });

    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      console.warn("[post-images] Image generation returned no image data");
      return null;
    }

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(path, bytes, { contentType: "image/png", upsert: false });

    if (uploadError) {
      console.warn("[post-images] Failed to upload generated image:", uploadError.message);
      return null;
    }

    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
    return urlData.publicUrl;
  } catch (e) {
    console.warn("[post-images] Image generation error:", e);
    return null;
  }
}

/** True if the article body already contains an image we generated and stored. */
export function hasGeneratedBodyImage(content: string): boolean {
  return /!\[[^\]]*\]\([^)]*\/post-images\/[^)]+\)/.test(content);
}

// Pick one H2 section to illustrate with an in-body image — roughly the
// middle of the article, skipping the opening section (keep the intro
// clean) and anything that looks like FAQ/conclusion (an image doesn't fit
// the Q&A format and the article is winding down by then anyway).
export function pickBodySectionForImage(content: string): { heading: string; lineIndex: number } | null {
  const lines = content.split("\n");
  const h2Indices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+.+$/.test(lines[i]) && !/^###/.test(lines[i])) h2Indices.push(i);
  }
  const eligible = h2Indices.slice(1).filter((i) => !/faq|frequently asked|conclusion|summary|final thoughts|wrap.?up/i.test(lines[i]));
  if (eligible.length === 0) return null;

  const midIndex = eligible[Math.floor(eligible.length / 2)];
  const heading = lines[midIndex].replace(/^##\s+/, "").trim();
  return { heading, lineIndex: midIndex };
}

/** Inserts a markdown image right after the given H2 heading's line. */
export function insertImageAfterHeading(content: string, lineIndex: number, imageUrl: string, alt: string): string {
  const lines = content.split("\n");
  lines.splice(lineIndex + 1, 0, "", `![${alt.replace(/[[\]]/g, "")}](${imageUrl})`);
  return lines.join("\n");
}

export function bodyImagePrompt(heading: string, topic: string, styleHint: string): string {
  return `Create a single standalone illustration for a blog section titled "${heading}", in an article about "${topic}". Match this visual style and color palette: ${styleHint || "clean, modern, professional"}. No embedded text, logos, or words in the image — imagery only.`;
}
