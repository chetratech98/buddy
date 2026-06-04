/**
 * generate-writing-brief
 *
 * Takes a single content plan item and returns a ~1,000-word detailed
 * writing brief: article angle, 8-9 key sections with talking points,
 * SEO notes, tone guidance, and word count target.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY is not configured" }, 500);

    const body = await req.json();
    const { title, type, keyword, long_tail_keyword, description, niche, tone } = body;

    if (!title || !keyword) {
      return json({ error: "title and keyword are required" }, 400);
    }

    const systemPrompt = `You are an expert SEO content strategist and writing coach.
Your job is to produce a detailed writing brief for a blog/content writer.
The brief must be practical, specific, and approximately 1,000 words.

Structure the brief exactly like this (use **bold** for section headers):

**Article Angle & Unique Value**
[2-3 sentences on what makes this article different from what already ranks. Be specific about the gap this fills.]

**Section 1: [Section Title]**
[3-5 bullet points of specific talking points, data to include, angle to take]

**Section 2: [Section Title]**
[3-5 bullet points...]

[Continue for 7-9 total sections]

**SEO Notes**
[Specific guidance: target keywords, featured snippet opportunity, internal linking suggestions, meta description angle]

**Tone & Style**
[Specific guidance for this post's tone, voice, and formatting]

**Word Count Target**
[Recommended total word count with brief justification]

Rules:
- Every section must have specific, actionable content — no generic filler
- Include real-world examples, data points, or statistics where relevant to the topic
- Make the angle genuinely differentiated from obvious competitor content
- Total output should be approximately 900-1,100 words`;

    const userPrompt = `Generate a detailed writing brief for the following post:

Title: ${title}
Content Type: ${type}
Primary Keyword: ${keyword}
Long-Tail Keyword: ${long_tail_keyword || ""}
Niche: ${niche || keyword}
Short Description: ${description || ""}
Tone: ${tone || "professional"}

Produce a complete ~1,000-word writing brief that a content writer can use to produce a fully optimized, differentiated article.`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.5,
        max_tokens: 1800,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "OpenAI rate limit reached. Please wait and try again." }, 429);
      if (aiRes.status === 402) return json({ error: "OpenAI usage limit reached. Check your billing." }, 402);
      throw new Error(`OpenAI error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const brief = aiData.choices?.[0]?.message?.content?.trim() ?? "";

    if (!brief) throw new Error("AI returned an empty brief. Please try again.");

    console.log(`[generate-writing-brief] ✅ Generated brief for "${title}" (${brief.length} chars)`);

    return json({ writing_brief: brief });
  } catch (e: any) {
    const msg = e?.message || "Failed to generate writing brief.";
    console.error("[generate-writing-brief] error:", msg);
    return json({ error: msg }, 500);
  }
});
