/**
 * Shared OpenAI-embeddings helpers — extracted from check-duplicate so
 * generate-blog's internal-linking logic uses the exact same similarity
 * math instead of a second, possibly-drifting implementation.
 */

/** Cosine similarity between two embedding vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Batch-embed texts using text-embedding-3-small (cheap + accurate for
 * semantic similarity). Max ~2048 tokens per text; batch up to 100 texts
 * per call.
 */
export async function embedTexts(texts: string[], apiKey: string): Promise<number[][]> {
  // Truncate each text to ~500 chars to stay well within token limits
  const truncated = texts.map((t) => t.slice(0, 500).replace(/\s+/g, " ").trim());

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: truncated,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  // Sort by index to guarantee order
  return (data.data as Array<{ index: number; embedding: number[] }>)
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}
