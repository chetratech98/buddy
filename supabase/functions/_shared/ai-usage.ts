// Pinned like daily-blog-generator: esm.sh's 2.117.0 build was broken.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

// Estimated USD list prices. These are estimates for visibility, not billing
// data — update when OpenAI changes pricing and reconcile against the
// OpenAI usage dashboard.
const CHAT_PRICE_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};

const IMAGE_PRICE: Record<string, Record<string, number>> = {
  "gpt-image-1": {
    "low:1024x1024": 0.011,
    "low:1536x1024": 0.016,
    "medium:1024x1024": 0.042,
    "medium:1536x1024": 0.063,
    "high:1024x1024": 0.167,
    "high:1536x1024": 0.25,
  },
};

export function estimateChatCost(model: string, promptTokens: number, completionTokens: number): number {
  const p = CHAT_PRICE_PER_MILLION[model];
  if (!p) return 0;
  return (promptTokens * p.input + completionTokens * p.output) / 1_000_000;
}

export function estimateImageCost(model: string, quality: string, size: string, count: number): number {
  return (IMAGE_PRICE[model]?.[`${quality}:${size}`] ?? 0) * count;
}

export interface AiUsageEntry {
  userId?: string | null;
  postId?: string | null;
  functionName: string;
  kind: "chat" | "image";
  purpose: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  imageCount?: number;
  estCostUsd: number;
}

let adminClient: ReturnType<typeof createClient> | null = null;

/** Records one paid AI call. Never throws — logging must not break generation. */
export async function logAiUsage(entry: AiUsageEntry): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    adminClient ??= createClient(url, key);
    const { error } = await adminClient.from("ai_usage_log").insert({
      user_id: entry.userId ?? null,
      post_id: entry.postId ?? null,
      function_name: entry.functionName,
      kind: entry.kind,
      purpose: entry.purpose,
      model: entry.model,
      prompt_tokens: entry.promptTokens ?? 0,
      completion_tokens: entry.completionTokens ?? 0,
      image_count: entry.imageCount ?? 0,
      est_cost_usd: Number(entry.estCostUsd.toFixed(5)),
    });
    if (error) console.warn("[ai-usage] insert failed:", error.message);
  } catch (e) {
    console.warn("[ai-usage] logging error:", e);
  }
}
