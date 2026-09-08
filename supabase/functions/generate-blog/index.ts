import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { searchSerp, scrapePage } from "../_shared/scraping.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: count words in markdown text
// ─────────────────────────────────────────────────────────────────────────────
function countWords(text: string): number {
  return text
    .replace(/```[\s\S]*?```/g, "") // strip code blocks
    .replace(/`[^`]+`/g, "")        // strip inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // strip links, keep text
    .replace(/[#*_~>|]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: fetch top competitor URLs from SerpApi
// ─────────────────────────────────────────────────────────────────────────────
async function fetchCompetitorUrls(
  keyword: string,
  serpApiKey: string,
  limit = 5
): Promise<Array<{ url: string; title: string; domain: string; snippet: string }>> {
  const { organic } = await searchSerp(keyword, serpApiKey, { num: 10, retries: 1 });
  return organic
    .slice(0, limit)
    .filter((r) => r.url)
    .map((r) => ({ url: r.url, title: r.title, domain: r.domain, snippet: r.snippet }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: scrape a single URL with Firecrawl, return cleaned markdown
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeUrl(url: string, firecrawlKey: string): Promise<string> {
  const scraped = await scrapePage(url, firecrawlKey, { maxChars: 4000, timeoutMs: 10000, retries: 1 });
  return scraped.markdown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build competitor context string from scraped pages
// ─────────────────────────────────────────────────────────────────────────────
function buildCompetitorContext(
  competitors: Array<{ url: string; title: string; domain: string; snippet: string }>,
  scrapedContents: string[]
): string {
  let ctx = "";
  for (let i = 0; i < competitors.length; i++) {
    const c = competitors[i];
    const body = scrapedContents[i];
    if (!body && !c.snippet) continue;

    ctx += `\n### Competitor ${i + 1}: ${c.title}\n`;
    ctx += `Domain: ${c.domain}\n`;
    if (c.snippet) ctx += `Google Snippet: ${c.snippet}\n`;
    if (body) {
      ctx += `Content Summary:\n${body}\n`;
    }
  }
  return ctx.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: call OpenAI chat completions
// ─────────────────────────────────────────────────────────────────────────────
async function callOpenAI(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  temperature = 0.7,
  model = "gpt-4o-mini"
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, temperature, messages }),
  });

  if (!res.ok) {
    const status = res.status;
    if (status === 429) throw new Error("RATE_LIMIT");
    if (status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error(`openai_error_${status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: parse JSON from LLM output (strips fences)
// ─────────────────────────────────────────────────────────────────────────────
function parseJSON<T>(raw: string): T | null {
  try {
    const cleaned = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to extract the first {...} block
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]) as T; } catch { /* fall through */ }
    }
    return null;
  }
}

interface BlogPost {
  title: string;
  excerpt: string;
  content: string;
  keywords: string[];
  ogImagePrompt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
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
    // ── Auth ──────────────────────────────────────────────────────────────────
    // Two callers are supported:
    //  1. A logged-in user's browser — Authorization: Bearer <user JWT>, verified via getUser().
    //  2. A trusted server-to-server caller (e.g. the daily-blog-generator cron job) —
    //     Authorization: Bearer <SERVICE_ROLE_KEY> plus an explicit `user_id` in the body,
    //     since a service-role key has no associated auth.getUser() identity to check.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const bearerToken = authHeader.slice("Bearer ".length);
    const body = await req.json();

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const isServiceRoleCall = Boolean(serviceRoleKey) && bearerToken === serviceRoleKey;

    let supabase: ReturnType<typeof createClient>;
    let userId: string;

    if (isServiceRoleCall) {
      const impersonatedUserId = typeof body.user_id === "string" ? body.user_id : "";
      if (!impersonatedUserId) {
        return jsonResponse({ error: "user_id is required for service-role calls" }, 400);
      }
      supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey);
      userId = impersonatedUserId;
    } else {
      supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);
      userId = user.id;
    }

    // ── Quota check ───────────────────────────────────────────────────────────
    const { data: quotaProfile, error: quotaError } = await supabase
      .from("profiles")
      .select("posts_used_this_month, posts_quota_monthly")
      .eq("user_id", userId)
      .single();

    if (!quotaError && quotaProfile) {
      const used = quotaProfile.posts_used_this_month ?? 0;
      const quota = quotaProfile.posts_quota_monthly ?? 15;
      if (used >= quota) {
        return jsonResponse({
          error: "quota_exceeded",
          message: "You've reached your monthly post limit. Upgrade your plan to continue creating content.",
        }, 200);
      }
      // Increment usage counter before generation (prevents races)
      await supabase.rpc("check_and_increment_quota", { p_user_id: userId });
    }

    // ── Input validation ──────────────────────────────────────────────────────
    const topic    = typeof body.topic    === "string" ? body.topic.trim().slice(0, 1000)   : "";
    const keywords = typeof body.keywords === "string" ? body.keywords.trim().slice(0, 500) : "";
    const tone     = typeof body.tone     === "string" ? body.tone.trim().slice(0, 50)      : "professional";
    const targetWordCount = typeof body.targetWordCount === "number" && body.targetWordCount >= 500 && body.targetWordCount <= 5000
      ? body.targetWordCount
      : 1500;
    const template          = body.template ?? null;
    const contentType       = typeof body.contentType === "string" ? body.contentType.trim() : "blog";
    const contentPlanBrief  = typeof body.contentPlanBrief === "string" ? body.contentPlanBrief.trim().slice(0, 1000) : "";
    const niche             = typeof body.niche === "string" ? body.niche.trim().slice(0, 200) : "";

    if (!topic) return jsonResponse({ error: "Topic is required" }, 400);

    const OPENAI_API_KEY  = Deno.env.get("OPENAI_API_KEY");
    const SERP_API_KEY    = Deno.env.get("SERP_API_KEY");
    const FIRECRAWL_KEY   = Deno.env.get("FIRECRAWL_API_KEY");

    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    // ── PHASE 0 + PHASE 1: Content Intelligence + Competitor Research ──────────
    // These two lookups are fully independent (one hits content-intelligence,
    // the other hits SERP/Firecrawl) — run them concurrently instead of paying
    // for both round-trips back-to-back.
    const primaryKeyword = keywords
      ? keywords.split(",")[0].trim()
      : topic.slice(0, 100);

    const fetchContentIntelligence = async (): Promise<any> => {
      try {
        console.log(`[generate-blog] Fetching content intelligence for: "${primaryKeyword}"`);
        const intelligenceRes = await supabase.functions.invoke("content-intelligence", {
          body: {
            keyword: primaryKeyword,
            userId,
            includeOutline: true,
            includeHeadings: true,
            includeFAQ: true,
          },
        });

        if (intelligenceRes.data && !intelligenceRes.error) {
          console.log(`[generate-blog] Content intelligence loaded: ${intelligenceRes.data.outline?.sections?.length || 0} sections`);
          return intelligenceRes.data;
        }
        console.log("[generate-blog] No content intelligence available, proceeding with standard generation");
        return null;
      } catch (e) {
        console.log("[generate-blog] Content intelligence fetch failed, proceeding with standard generation:", e);
        return null;
      }
    };

    const fetchCompetitorResearch = async (): Promise<{
      context: string;
      urls: Array<{ url: string; title: string; domain: string; snippet: string }>;
    }> => {
      if (!SERP_API_KEY) return { context: "", urls: [] };

      console.log(`[generate-blog] Fetching SERP results for: "${primaryKeyword}"`);
      const urls = await fetchCompetitorUrls(primaryKeyword, SERP_API_KEY, 5);
      console.log(`[generate-blog] Found ${urls.length} competitor URLs`);

      if (urls.length > 0 && FIRECRAWL_KEY) {
        console.log("[generate-blog] Scraping competitor content with Firecrawl...");
        // Scrape top 3 in parallel (balance speed vs. context size)
        const scrapedContents = await Promise.all(
          urls.slice(0, 3).map((c) => scrapeUrl(c.url, FIRECRAWL_KEY))
        );
        const context = buildCompetitorContext(urls.slice(0, 3), scrapedContents);
        console.log(`[generate-blog] Competitor context built: ${context.length} chars`);
        return { context, urls };
      } else if (urls.length > 0) {
        // No Firecrawl — use SERP snippets only
        console.log("[generate-blog] Using SERP snippets only (no Firecrawl key)");
        return { context: buildCompetitorContext(urls, []), urls };
      }
      return { context: "", urls };
    };

    const [contentIntelligence, competitorResearch] = await Promise.all([
      fetchContentIntelligence(),
      fetchCompetitorResearch(),
    ]);
    const competitorContext = competitorResearch.context;
    const competitorUrls = competitorResearch.urls;

    // ── PHASE 2: Generate blog post (grounded in competitor data + intelligence) ──
    const competitorSection = competitorContext
      ? `\n\n## LIVE COMPETITOR INTELLIGENCE (from current Google top results)\nAnalyze these top-ranking pages and CREATE SUPERIOR content that covers their topics more comprehensively, fills their gaps, and provides more unique value:\n\n${competitorContext}\n\n### Your content MUST:\n- Cover all major topics the competitors cover PLUS additional unique angles they miss\n- Be longer and more comprehensive than competitors (target 2,000+ words)\n- Include unique insights, data points, or frameworks not found in any competitor\n- Answer questions competitors leave unanswered`
      : "";

    const templateSection = template
      ? `\n\n## CONTENT TEMPLATE TO FOLLOW\nName: ${template.name}\nStructure sections: ${template.structure.join(", ")}\nInstructions: ${template.promptTemplate}`
      : "";

    // Build content intelligence section if available
    let intelligenceSection = "";
    let intelligenceWordCount = targetWordCount;
    let intelligenceTone = tone;
    
    if (contentIntelligence) {
      intelligenceWordCount = contentIntelligence.optimization?.targetWordCount || targetWordCount;
      intelligenceTone = contentIntelligence.optimization?.toneAndStyle || tone;
      
      const outlineSections = contentIntelligence.outline?.sections || [];
      const faqQuestions = contentIntelligence.faq?.map((f: any) => f.question).slice(0, 5) || [];
      const semanticEntities = contentIntelligence.semanticEntities?.required || [];
      const contentGaps = contentIntelligence.contentGaps || [];
      
      intelligenceSection = `\n\n## 🎯 CONTENT INTELLIGENCE (from SERP Analysis)

### Search Intent: ${contentIntelligence.searchIntent?.primary || "informational"} (${contentIntelligence.searchIntent?.confidence || 80}% confidence)
Write in a ${intelligenceTone} style that matches this intent.

### Required Structure (follow this outline exactly):
${outlineSections.map((s: any, idx: number) => 
  `${idx + 1}. ${s.heading} (${s.priority === 'must-have' ? '⭐ REQUIRED' : 'recommended'}, ~${s.estimatedWords} words)${s.subtopics && s.subtopics.length > 0 ? '\n   - ' + s.subtopics.join('\n   - ') : ''}`
).join('\n\n')}

${faqQuestions.length > 0 ? `### FAQ Section (REQUIRED - include these questions):
${faqQuestions.map((q: string) => `- ${q}`).join('\n')}` : ''}

${semanticEntities.length > 0 ? `### Must-Include Semantic Entities:
Naturally incorporate these terms/concepts: ${semanticEntities.join(', ')}` : ''}

${contentGaps.length > 0 ? `### Content Gaps to Address (competitive advantages):
${contentGaps.map((gap: string) => `- ${gap}`).join('\n')}` : ''}

### Content Benchmark:
- Target word count: ${intelligenceWordCount} words
- Recommended H2 sections: ${contentIntelligence.optimization?.recommendedH2Count || 8}
- Recommended H3 subsections: ${contentIntelligence.optimization?.recommendedH3Count || 12}
- Dominant format: ${contentIntelligence.contentBenchmark?.dominantContentType || 'guide'}`;
    }

    const systemPrompt = `You are an expert SEO content writer with deep knowledge of Google's E-E-A-T principles (Experience, Expertise, Authoritativeness, Trust). You write comprehensive, data-driven blog posts that outrank competitors.

QUALITY STANDARDS:
- Target ${intelligenceWordCount} words (±10% is acceptable)
- Use proper markdown: H2 (##) and H3 (###) headings, bullet lists, bold key terms
- ${contentIntelligence?.faq?.length > 0 ? 'Include the FAQ section with the provided questions' : 'Include a FAQ section at the end with 3–5 questions'}
- Natural keyword integration (1.5–2% density) — never keyword-stuffed
- Factual, specific, and actionable — no vague filler content
- Strong intro (hook the reader in the first 2 sentences) and clear conclusion with CTA
- Add real examples, case studies, statistics, and actionable tips throughout
- Use numbered lists, bullet points, and tables for better readability
- ${contentIntelligence ? 'Follow the EXACT outline structure provided in Content Intelligence section' : 'Create a logical structure'}

ALSO generate an "ogImagePrompt": a single vivid, detailed prompt (2–4 sentences) suitable for
feeding directly into an AI image generator (DALL-E, Midjourney, Stable Diffusion) to create this
post's Open Graph / featured image. It must describe: the subject/scene, a concrete visual style
(e.g. flat illustration, photorealistic, 3D render, isometric), a specific color palette, and
composition/framing suited to a 1200×630 social share image. Never ask for embedded text, logos,
or words rendered in the image itself — describe imagery only.

Respond in VALID JSON ONLY. No markdown fences outside the JSON.
JSON format:
{
  "title": "SEO-optimized title (50–70 chars)",
  "excerpt": "Compelling 1–2 sentence summary for meta description (120–160 chars)",
  "content": "Full markdown content (${intelligenceWordCount} words target)",
  "keywords": ["keyword1", "keyword2", ...],
  "ogImagePrompt": "Detailed AI image-generation prompt for the OG/featured image",
  "wordCount": <integer>,
  "competitorUrlsAnalyzed": <integer>
}`;

    // Build content-type format instructions
    const contentTypeGuide: Record<string, string> = {
      "how-to": "Structure as a step-by-step guide. Use numbered steps (##Step 1, ##Step 2…) as the backbone. Each step must have a clear action, explanation of WHY, and a concrete example. Open with a short 'What you'll achieve' section. Close with a 'Common Mistakes' or 'Pro Tips' section.",
      "listicle": "Structure as a ranked or curated list (e.g., '12 Ways to…' or 'Top 10…'). Each list item gets its own H2 with a bold key insight in the first sentence. Use short paragraphs per item — no walls of text. Include a comparison summary table if 5+ items.",
      "case-study": "Open with the problem context and stakes. Walk through the solution with specific decisions, timelines, and metrics. Include a 'Results' section with quantifiable outcomes. Close with 'Key Takeaways' and 'How to Apply This' sections.",
      "opinion": "Take a clear, defensible position in the opening paragraph. Build the argument with evidence, counterarguments, and rebuttals. Use first-person voice. End with a call to action that invites the reader to act on the perspective.",
      "blog": "Use a narrative/educational structure: hook → problem statement → body (H2 sections with H3 subsections) → FAQ → conclusion with CTA.",
    };
    const formatGuide = contentTypeGuide[contentType] || contentTypeGuide["blog"];

    const userPrompt = `Write a comprehensive, SEO-optimized blog post on this topic:

TOPIC: ${topic}
${niche ? `SITE NICHE: ${niche}` : ""}
${keywords ? `TARGET KEYWORDS: ${keywords}` : ""}
TONE: ${intelligenceTone}
CONTENT FORMAT: ${contentType.toUpperCase()}
TARGET LENGTH: ${intelligenceWordCount} words
${contentPlanBrief ? `\nCONTENT PLAN BRIEF (use this to shape the angle, audience, and outcome):\n${contentPlanBrief}\n` : ""}
FORMAT INSTRUCTIONS FOR ${contentType.toUpperCase()}:
${formatGuide}
${intelligenceSection}
${competitorSection}
${templateSection}

CRITICAL REQUIREMENTS:
1. Follow the FORMAT INSTRUCTIONS above to structure the article correctly for its type (${contentType})
2. Use the CONTENT PLAN BRIEF to nail the specific angle — do NOT write a generic overview
3. Follow the outline structure EXACTLY if provided in Content Intelligence
4. Answer all FAQ questions if provided
5. Include all semantic entities naturally
6. The content field must be a complete, polished article of ${intelligenceWordCount} words (±10%)
7. ${contentIntelligence ? 'Address all content gaps mentioned to differentiate from competitors' : 'Provide unique insights not found in the top 10 Google results'}`;

    console.log("[generate-blog] Calling OpenAI for generation with content intelligence...");
    const rawGeneration = await callOpenAI(
      OPENAI_API_KEY,
      [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      0.7
    );

    let post = parseJSON<BlogPost & { wordCount?: number; competitorUrlsAnalyzed?: number }>(rawGeneration);

    if (!post) {
      post = {
        title: "Generated Blog Post",
        excerpt: "",
        content: rawGeneration,
        keywords: [],
        wordCount: countWords(rawGeneration),
        competitorUrlsAnalyzed: competitorUrls.length,
      };
    }

    // ── PHASE 3: Word Count Enforcement ──────────────────────────────────────
    const actualWordCount = countWords(post.content || "");
    console.log(`[generate-blog] Generated word count: ${actualWordCount} (target: ${targetWordCount})`);

    const minWordCount = Math.max(500, targetWordCount * 0.85); // Allow 15% under target
    
    if (actualWordCount < minWordCount) {
      console.log(`[generate-blog] Content too short (${actualWordCount} < ${minWordCount}) — running expansion pass...`);
      const expansionPrompt = `The following blog post is only ${actualWordCount} words, which is below the ${targetWordCount}-word target.

EXPAND this post to ${targetWordCount} words by:
1. Adding more depth to each existing section (more examples, data, explanation)
2. Adding 2–3 additional H2 sections that complement the existing ones
3. Expanding the FAQ section with 2 more questions if it exists
4. Adding a proper introduction paragraph if it's too thin
5. Adding a conclusion with actionable next steps
6. Include real-world examples, statistics, case studies, and best practices

Current post:
${JSON.stringify(post)}

Return ONLY valid JSON in the exact same format: { title, excerpt, content, keywords, ogImagePrompt, wordCount, competitorUrlsAnalyzed }
The content must be at least ${targetWordCount} words.`;

      const expandedRaw = await callOpenAI(
        OPENAI_API_KEY,
        [
          { role: "system", content: "You are an expert SEO content editor who expands and enriches blog posts while maintaining quality and flow. Return ONLY valid JSON." },
          { role: "user",   content: expansionPrompt },
        ],
        0.6
      );

      const expandedPost = parseJSON<BlogPost & { wordCount?: number }>(expandedRaw);
      if (expandedPost?.content && countWords(expandedPost.content) > actualWordCount) {
        post = { ...post, ...expandedPost };
        console.log(`[generate-blog] Expanded to ${countWords(post.content)} words`);
      }
    }

    // ── PHASE 4: QA Review Pass ───────────────────────────────────────────────
    const reviewSystemPrompt = `You are a strict SEO QA editor. Review and fix the blog post if needed. Return ONLY valid JSON.`;
    const reviewUserPrompt = `Review this blog post for the topic "${topic}" and keywords "${keywords}".

FIX ANY OF THESE ISSUES (if present):
1. Title must be 50–70 chars and SEO-optimized — fix if not
2. Excerpt must be 120–160 chars — fix if not
3. Content must have a proper introduction (2+ sentences), body (H2/H3 sections), and conclusion
4. Target keywords ("${keywords}") must appear naturally in title, at least 2 headings, and throughout body
5. Tone must be consistently "${tone}"
6. No incomplete sentences, no placeholder text like [INSERT X HERE]
7. FAQ section must exist (3+ questions)
8. Content type is "${contentType}" — verify the structure matches: how-to uses numbered steps, listicle has individual H2s per item, case-study has Results section, opinion takes a clear stance
9. Verify "wordCount" field reflects actual content word count
10. Keep "ogImagePrompt" as-is unless it's missing or empty — it is not affected by content edits

Current post:
${JSON.stringify(post)}

Return ONLY valid JSON: { title, excerpt, content, keywords, ogImagePrompt, wordCount, competitorUrlsAnalyzed }
If everything is correct, return unchanged.`;

    try {
      const reviewedRaw = await callOpenAI(
        OPENAI_API_KEY,
        [
          { role: "system", content: reviewSystemPrompt },
          { role: "user",   content: reviewUserPrompt },
        ],
        0.3
      );
      const reviewedPost = parseJSON<BlogPost & { wordCount?: number; competitorUrlsAnalyzed?: number }>(reviewedRaw);
      if (reviewedPost?.title && reviewedPost?.content) {
        // Merge (not replace) so fields the review prompt doesn't ask the model
        // to echo back — like ogImagePrompt — survive even if omitted.
        post = { ...post, ...reviewedPost, ogImagePrompt: reviewedPost.ogImagePrompt || post.ogImagePrompt };
        console.log("[generate-blog] QA review pass complete");
      }
    } catch (reviewErr) {
      console.warn("[generate-blog] QA review pass failed, using generation output:", reviewErr);
    }

    // ── Final metadata ─────────────────────────────────────────────────────────
    post.wordCount = countWords(post.content || "");
    post.competitorUrlsAnalyzed = competitorUrls.length;
    post.ogImagePrompt = post.ogImagePrompt || "";

    // Add content intelligence metadata if available
    const response: any = {
      ...post,
      contentIntelligence: contentIntelligence ? {
        searchIntent: contentIntelligence.searchIntent?.primary,
        intentConfidence: contentIntelligence.searchIntent?.confidence,
        targetWordCount: contentIntelligence.optimization?.targetWordCount,
        recommendedH2Count: contentIntelligence.optimization?.recommendedH2Count,
        dominantContentType: contentIntelligence.contentBenchmark?.dominantContentType,
        semanticEntitiesUsed: contentIntelligence.semanticEntities?.required?.slice(0, 5),
        faqQuestionsAnswered: contentIntelligence.faq?.length || 0,
        contentGapsAddressed: contentIntelligence.contentGaps?.length || 0,
      } : null,
    };

    console.log(
      `[generate-blog] Final: "${post.title}" | ${post.wordCount} words | ${post.competitorUrlsAnalyzed} competitors analyzed | Intelligence: ${contentIntelligence ? 'YES' : 'NO'}`
    );

    return jsonResponse(response);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    console.error("[generate-blog] Fatal error:", msg);

    if (msg === "RATE_LIMIT") {
      return jsonResponse({ error: "Rate limit exceeded. Please try again in a moment." }, 429);
    }
    if (msg === "CREDITS_EXHAUSTED") {
      return jsonResponse({ error: "AI credits exhausted. Please add funds to your workspace." }, 402);
    }
    return jsonResponse({ error: "Failed to generate blog post" }, 500);
  }
});
