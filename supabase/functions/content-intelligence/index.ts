import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/**
 * Content Intelligence Edge Function
 * 
 * Provides advanced content intelligence for blog generation:
 * Phase 1: SERP analysis integration, intent detection, keyword clustering, outline generation
 * Phase 2: Competitor heading extraction, FAQ generation, schema generation, semantic entities
 * Phase 3: AI Overview optimization, NLP scoring, topical authority, internal linking
 */

interface ContentIntelligenceRequest {
  keyword: string;
  userId: string;
  serpAnalysisId?: string;
  includeOutline?: boolean;
  includeHeadings?: boolean;
  includeFAQ?: boolean;
  includeSchema?: boolean;
  includeEntities?: boolean;
}

interface ContentIntelligence {
  keyword: string;
  searchIntent: {
    primary: string;
    confidence: number;
    secondary?: string[];
  };
  contentBenchmark: {
    avgWordCount: number;
    avgH2Count: number;
    avgImageCount: number;
    avgReadingTime: number;
    commonFormats: string[];
    dominantContentType: string;
  };
  outline: {
    sections: Array<{
      heading: string;
      level: number;
      subtopics: string[];
      estimatedWords: number;
      priority: "must-have" | "recommended" | "optional";
    }>;
    introduction: string;
    conclusion: string;
  };
  competitors: Array<{
    url: string;
    title: string;
    headings: {
      h1?: string;
      h2: string[];
      h3: string[];
      h4?: string[];
    };
    wordCount: number;
    contentScore: number;
    uniqueAngles: string[];
    headingDepth?: any;
    structureType?: string;
  }>;
  headingPatterns?: {
    commonHeadings: Array<{ heading: string; frequency: number; percentage: number }>;
    totalUniqueH2: number;
    totalUniqueH3: number;
    avgH2Count: number;
    avgH3Count: number;
  };
  faq: Array<{
    question: string;
    answer: string;
    source: "PAA" | "competitor" | "generated";
    priority: number;
  }>;
  schema: {
    type: string;
    properties: Record<string, any>;
  }[];
  semanticEntities: {
    required: string[];
    recommended: string[];
    niche: string[];
    topicalClusters?: Record<string, string[]>;
    densityRecommendations?: {
      current: number;
      optimal: number;
      status: string;
      recommendation: string;
      targetMentions: {
        required: number;
        recommended: number;
      };
    };
  };
  contentGaps: string[];
  quickWins: string[];
  optimization: {
    targetWordCount: number;
    recommendedH2Count: number;
    recommendedH3Count: number;
    toneAndStyle: string;
    writingLevel: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ContentIntelligenceRequest = await req.json();
    const { keyword, serpAnalysisId, includeOutline = true, includeHeadings = true, includeFAQ = true } = body;

    if (!keyword) {
      return new Response(JSON.stringify({ error: "Keyword is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing SERP analysis if provided
    let serpData: any = null;
    if (serpAnalysisId) {
      const { data } = await supabase
        .from("serp_analyses")
        .select("analysis")
        .eq("id", serpAnalysisId)
        .single();
      
      if (data) {
        serpData = data.analysis;
      }
    } else {
      // Fetch most recent SERP analysis for this user
      const { data } = await supabase
        .from("serp_analyses")
        .select("analysis")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        serpData = data.analysis;
      }
    }

    // Find keyword data in SERP analysis
    let keywordData = serpData?.keywords?.find(
      (k: any) => k.keyword.toLowerCase() === keyword.toLowerCase()
    );

    // If no SERP analysis exists, create basic keyword data structure
    if (!keywordData) {
      console.log(`[content-intelligence] No SERP analysis found for "${keyword}", generating basic intelligence`);
      
      // Detect basic intent from keyword
      const lowerKeyword = keyword.toLowerCase();
      let detectedIntent = "informational";
      if (lowerKeyword.includes("best") || lowerKeyword.includes("top") || lowerKeyword.includes("vs") || lowerKeyword.includes("review")) {
        detectedIntent = "commercial";
      } else if (lowerKeyword.includes("buy") || lowerKeyword.includes("price") || lowerKeyword.includes("cost")) {
        detectedIntent = "transactional";
      } else if (lowerKeyword.includes("how to") || lowerKeyword.includes("guide") || lowerKeyword.includes("tutorial")) {
        detectedIntent = "informational";
      }
      
      // Generate basic keyword data
      keywordData = {
        keyword: keyword,
        searchIntent: detectedIntent,
        intentConfidence: 60,
        difficulty: "medium",
        difficultyScore: 50,
        targetWordCount: 1500,
        recommendedContentFormat: detectedIntent === "commercial" ? "comparison" : "guide",
        topCompetitors: [],
        relatedKeywords: generateRelatedQuestions(keyword, detectedIntent),
        serpFeatures: ["People Also Ask"],
        contentBenchmark: {
          avgWordCount: 1500,
          avgH2Count: 8,
          avgImageCount: 5,
          avgReadingTime: 7,
          commonFormats: [detectedIntent === "commercial" ? "comparison" : "guide"],
          structuralPatterns: []
        },
        quickWins: [`Focus on ${detectedIntent} intent`, `Include practical examples`, `Add FAQ section`],
        opportunity: `Create comprehensive ${detectedIntent} content for "${keyword}"`
      };
    }

    // Build content intelligence response
    const competitors = extractCompetitorData(keywordData);
    const headingPatterns = analyzeHeadingPatterns(competitors);
    const generatedFAQs = await generateFAQ(keywordData, includeFAQ);
    
    const intelligence: ContentIntelligence = {
      keyword: keywordData.keyword,
      searchIntent: {
        primary: keywordData.searchIntent || "informational",
        confidence: keywordData.intentConfidence || 80,
        secondary: keywordData.secondaryIntents || [],
      },
      contentBenchmark: {
        avgWordCount: keywordData.contentBenchmark?.avgWordCount || keywordData.targetWordCount || 1500,
        avgH2Count: keywordData.contentBenchmark?.avgH2Count || 8,
        avgImageCount: keywordData.contentBenchmark?.avgImageCount || 5,
        avgReadingTime: keywordData.contentBenchmark?.avgReadingTime || 7,
        commonFormats: keywordData.contentBenchmark?.commonFormats || [keywordData.recommendedContentFormat || "guide"],
        dominantContentType: keywordData.recommendedContentFormat || "guide",
      },
      outline: await generateOutline(keywordData, serpData),
      competitors,
      headingPatterns,
      faq: generatedFAQs,
      schema: generateSchema(keywordData, generatedFAQs),
      semanticEntities: extractSemanticEntities(keywordData, serpData),
      contentGaps: keywordData.quickWins || [],
      quickWins: keywordData.quickWins || [],
      optimization: {
        targetWordCount: keywordData.targetWordCount || 1500,
        recommendedH2Count: Math.ceil((keywordData.targetWordCount || 1500) / 200),
        recommendedH3Count: Math.ceil((keywordData.targetWordCount || 1500) / 150),
        toneAndStyle: determineStyle(keywordData.searchIntent),
        writingLevel: determineWritingLevel(keywordData.difficulty),
      },
    };

    return new Response(JSON.stringify(intelligence), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[content-intelligence] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Generate outline based on SERP data
// ─────────────────────────────────────────────────────────────────────────────
async function generateOutline(keywordData: any, serpData: any) {
  const sections: any[] = [];
  
  // Introduction section
  const intro = {
    heading: "Introduction",
    level: 2,
    subtopics: [
      `What is ${keywordData.keyword}?`,
      "Why it matters",
      "What you'll learn in this guide"
    ],
    estimatedWords: 200,
    priority: "must-have" as const,
  };
  sections.push(intro);

  // Extract common topics from competitors
  const commonTopics = serpData?.overallInsights?.commonTopics || [];
  const structuralPatterns = keywordData.contentBenchmark?.structuralPatterns || [];

  // Build main content sections based on competitor patterns
  if (structuralPatterns.length > 0) {
    structuralPatterns.slice(0, 6).forEach((pattern: string, idx: number) => {
      sections.push({
        heading: pattern,
        level: 2,
        subtopics: commonTopics.slice(idx * 2, idx * 2 + 2),
        estimatedWords: 250,
        priority: idx < 3 ? "must-have" : "recommended" as const,
      });
    });
  } else {
    // Fallback sections based on search intent
    const intentSections = getDefaultSections(keywordData.searchIntent, keywordData.keyword);
    sections.push(...intentSections);
  }

  // Add FAQ section if there are related questions
  if (keywordData.relatedKeywords && keywordData.relatedKeywords.length > 0) {
    sections.push({
      heading: "Frequently Asked Questions",
      level: 2,
      subtopics: keywordData.relatedKeywords.slice(0, 5),
      estimatedWords: 300,
      priority: "recommended" as const,
    });
  }

  // Conclusion
  sections.push({
    heading: "Conclusion",
    level: 2,
    subtopics: [
      "Key takeaways",
      "Next steps",
      "Final thoughts"
    ],
    estimatedWords: 150,
    priority: "must-have" as const,
  });

  return {
    sections,
    introduction: `Write a compelling introduction that hooks the reader with a problem or question related to "${keywordData.keyword}". Clearly state what the article will cover and why it's valuable.`,
    conclusion: `Summarize the key points about ${keywordData.keyword}. Provide actionable next steps and reinforce the main value proposition.`,
  };
}

function getDefaultSections(intent: string, keyword: string) {
  if (intent === "commercial" || intent === "transactional") {
    return [
      { heading: `Best ${keyword} Options`, level: 2, subtopics: ["Top choices", "Comparison"], estimatedWords: 300, priority: "must-have" as const },
      { heading: "How to Choose", level: 2, subtopics: ["Key factors", "What to avoid"], estimatedWords: 250, priority: "must-have" as const },
      { heading: "Pricing and Value", level: 2, subtopics: ["Cost breakdown", "ROI"], estimatedWords: 200, priority: "recommended" as const },
    ];
  } else if (intent === "navigational") {
    return [
      { heading: "Overview", level: 2, subtopics: ["Key features", "How it works"], estimatedWords: 300, priority: "must-have" as const },
      { heading: "Getting Started", level: 2, subtopics: ["Setup", "First steps"], estimatedWords: 250, priority: "must-have" as const },
    ];
  } else {
    // informational
    return [
      { heading: `Understanding ${keyword}`, level: 2, subtopics: ["Definition", "Why it's important"], estimatedWords: 300, priority: "must-have" as const },
      { heading: "How It Works", level: 2, subtopics: ["Process", "Key components"], estimatedWords: 300, priority: "must-have" as const },
      { heading: "Benefits and Use Cases", level: 2, subtopics: ["Advantages", "When to use"], estimatedWords: 250, priority: "recommended" as const },
      { heading: "Best Practices", level: 2, subtopics: ["Tips", "Common mistakes"], estimatedWords: 250, priority: "recommended" as const },
    ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Extract competitor heading structure (Phase 2 Enhanced)
// ─────────────────────────────────────────────────────────────────────────────
function extractCompetitorData(keywordData: any) {
  const competitors = keywordData.topCompetitors || [];
  
  // Extract detailed heading structure from each competitor
  const competitorData = competitors.map((comp: any) => ({
    url: comp.url || "",
    title: comp.title || "",
    headings: {
      h1: comp.title || "",
      h2: comp.headings?.h2 || [],
      h3: comp.headings?.h3 || [],
      h4: comp.headings?.h4 || [],
    },
    wordCount: comp.wordCount || 0,
    contentScore: comp.contentScore || 0,
    uniqueAngles: comp.uniqueAngles || [],
    headingDepth: calculateHeadingDepth(comp.headings),
    structureType: determineStructureType(comp.headings),
  }));

  return competitorData;
}

// Calculate average heading depth and nesting
function calculateHeadingDepth(headings: any) {
  if (!headings) return 0;
  
  const h2Count = headings.h2?.length || 0;
  const h3Count = headings.h3?.length || 0;
  const h4Count = headings.h4?.length || 0;
  
  if (h2Count === 0) return 0;
  
  return {
    depth: h3Count > 0 ? (h4Count > 0 ? 3 : 2) : 1,
    h2Count,
    h3Count,
    h4Count,
    h3PerH2: h3Count / h2Count,
    totalHeadings: h2Count + h3Count + h4Count,
  };
}

// Determine if structure is flat, hierarchical, or mixed
function determineStructureType(headings: any) {
  const depth = calculateHeadingDepth(headings);
  
  if (depth.depth === 1) return "flat";
  if (depth.h3PerH2 > 2) return "hierarchical";
  return "mixed";
}

// Phase 2: Analyze heading patterns across all competitors
function analyzeHeadingPatterns(competitors: any[]) {
  const headingFrequency: Record<string, number> = {};
  const h2Patterns: string[] = [];
  const h3Patterns: string[] = [];
  
  competitors.forEach(comp => {
    // Track H2 heading patterns
    comp.headings.h2.forEach((h2: string) => {
      const normalized = normalizeHeading(h2);
      headingFrequency[normalized] = (headingFrequency[normalized] || 0) + 1;
      h2Patterns.push(normalized);
    });
    
    // Track H3 heading patterns
    comp.headings.h3.forEach((h3: string) => {
      const normalized = normalizeHeading(h3);
      h3Patterns.push(normalized);
    });
  });
  
  // Find most common headings (appearing in 3+ competitors)
  const commonHeadings = Object.entries(headingFrequency)
    .filter(([_, count]) => count >= Math.min(3, competitors.length / 2))
    .sort((a, b) => b[1] - a[1])
    .map(([heading, count]) => ({ heading, frequency: count, percentage: Math.round((count / competitors.length) * 100) }));
  
  return {
    commonHeadings,
    totalUniqueH2: new Set(h2Patterns).size,
    totalUniqueH3: new Set(h3Patterns).size,
    avgH2Count: Math.round(competitors.reduce((sum, c) => sum + (c.headings.h2?.length || 0), 0) / competitors.length),
    avgH3Count: Math.round(competitors.reduce((sum, c) => sum + (c.headings.h3?.length || 0), 0) / competitors.length),
  };
}

// Normalize headings for comparison
function normalizeHeading(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[0-9]+/g, '') // Remove numbers
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/[^\w\s]/g, '') // Remove special chars
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Generate FAQ from SERP features and competitors (Phase 2 Enhanced)
// ─────────────────────────────────────────────────────────────────────────────
async function generateFAQ(keywordData: any, include: boolean) {
  if (!include) return [];

  const faqs: any[] = [];
  const processedQuestions = new Set<string>();
  
  // 1. Extract from SERP features (People Also Ask)
  const serpFeatures = keywordData.serpFeatures || [];
  if (serpFeatures.includes("People Also Ask") && keywordData.relatedKeywords) {
    keywordData.relatedKeywords.slice(0, 8).forEach((question: string, idx: number) => {
      if (isQuestion(question)) {
        const normalizedQ = normalizeQuestion(question);
        if (!processedQuestions.has(normalizedQ)) {
          processedQuestions.add(normalizedQ);
          faqs.push({
            question: question.endsWith("?") ? question : question + "?",
            answer: "", // Will be generated by AI in next step
            source: "PAA",
            priority: 100 - (idx * 5),
          });
        }
      }
    });
  }

  // 2. Extract questions from competitor content
  const competitors = keywordData.topCompetitors || [];
  competitors.slice(0, 5).forEach((comp: any) => {
    // Extract questions from headings
    const allHeadings = [
      ...(comp.headings?.h2 || []),
      ...(comp.headings?.h3 || []),
    ];
    
    allHeadings.forEach((heading: string) => {
      if (isQuestion(heading)) {
        const normalizedQ = normalizeQuestion(heading);
        if (!processedQuestions.has(normalizedQ)) {
          processedQuestions.add(normalizedQ);
          faqs.push({
            question: heading.endsWith("?") ? heading : heading + "?",
            answer: "",
            source: "competitor",
            priority: 80,
          });
        }
      }
    });
  });

  // 3. Generate common questions based on search intent
  const intentQuestions = generateIntentBasedQuestions(keywordData.keyword, keywordData.searchIntent);
  intentQuestions.forEach((q: string) => {
    const normalizedQ = normalizeQuestion(q);
    if (!processedQuestions.has(normalizedQ)) {
      processedQuestions.add(normalizedQ);
      faqs.push({
        question: q,
        answer: "",
        source: "generated",
        priority: 70,
      });
    }
  });

  // 4. Generate AI answers for top questions using OpenAI
  const topFaqs = faqs.sort((a, b) => b.priority - a.priority).slice(0, 10);
  const faqsWithAnswers = await generateFAQAnswers(topFaqs, keywordData.keyword);

  return faqsWithAnswers;
}

// Check if text is a question
function isQuestion(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    text.includes("?") ||
    lower.startsWith("how ") ||
    lower.startsWith("what ") ||
    lower.startsWith("why ") ||
    lower.startsWith("when ") ||
    lower.startsWith("where ") ||
    lower.startsWith("who ") ||
    lower.startsWith("can ") ||
    lower.startsWith("is ") ||
    lower.startsWith("are ") ||
    lower.startsWith("do ") ||
    lower.startsWith("does ")
  );
}

// Normalize question for deduplication
function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[?!.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Generate intent-based common questions
function generateIntentBasedQuestions(keyword: string, intent: string): string[] {
  const questions: string[] = [];
  
  if (intent === "commercial" || intent === "transactional") {
    questions.push(
      `What is the best ${keyword}?`,
      `How much does ${keyword} cost?`,
      `Is ${keyword} worth it?`,
      `Where can I buy ${keyword}?`
    );
  } else if (intent === "informational") {
    questions.push(
      `What is ${keyword}?`,
      `How does ${keyword} work?`,
      `Why is ${keyword} important?`,
      `What are the benefits of ${keyword}?`
    );
  } else if (intent === "navigational") {
    questions.push(
      `How to use ${keyword}?`,
      `What features does ${keyword} have?`
    );
  }
  
  return questions.slice(0, 3);
}

// Generate related questions when no SERP data available
function generateRelatedQuestions(keyword: string, intent: string): string[] {
  const questions: string[] = [];
  
  if (intent === "commercial" || intent === "transactional") {
    questions.push(
      `What is the best ${keyword}?`,
      `How much does ${keyword} cost?`,
      `Is ${keyword} worth it?`,
      `Where to buy ${keyword}?`,
      `${keyword} vs alternatives?`
    );
  } else if (intent === "informational") {
    questions.push(
      `What is ${keyword}?`,
      `How does ${keyword} work?`,
      `Why is ${keyword} important?`,
      `What are the benefits of ${keyword}?`,
      `How to get started with ${keyword}?`
    );
  } else {
    questions.push(
      `How to use ${keyword}?`,
      `What is ${keyword}?`,
      `${keyword} tutorial?`
    );
  }
  
  return questions;
}

// Generate AI-powered answers for FAQ questions
async function generateFAQAnswers(faqs: any[], keyword: string) {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey || faqs.length === 0) return faqs;

  try {
    // Batch generate answers for all questions
    const questionsText = faqs.map((faq, idx) => `${idx + 1}. ${faq.question}`).join("\n");
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an SEO content expert. Generate concise, accurate answers (2-3 sentences each) for FAQ questions. Answers should be informative, natural, and optimized for featured snippets."
          },
          {
            role: "user",
            content: `Generate answers for these FAQ questions about "${keyword}":\n\n${questionsText}\n\nProvide answers in format:\n1. [Answer for question 1]\n2. [Answer for question 2]\netc.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.statusText);
      return faqs;
    }

    const data = await response.json();
    const answersText = data.choices[0]?.message?.content || "";
    
    // Parse answers and match with questions
    const answerLines = answersText.split("\n").filter((line: string) => line.trim());
    faqs.forEach((faq, idx) => {
      const answerLine = answerLines.find((line: string) => line.startsWith(`${idx + 1}.`));
      if (answerLine) {
        faq.answer = answerLine.replace(/^\d+\.\s*/, "").trim();
      } else if (answersText.includes(faq.question)) {
        // Fallback: find answer after question
        const questionIndex = answersText.indexOf(faq.question);
        const nextQuestionIndex = faqs[idx + 1] 
          ? answersText.indexOf(faqs[idx + 1].question, questionIndex + 1)
          : answersText.length;
        const answer = answersText.substring(questionIndex + faq.question.length, nextQuestionIndex).trim();
        faq.answer = answer.substring(0, 300); // Limit length
      }
    });

    return faqs;
  } catch (error) {
    console.error("Error generating FAQ answers:", error);
    return faqs;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Generate schema markup (Phase 2 Enhanced with Real FAQ Answers)
// ─────────────────────────────────────────────────────────────────────────────
function generateSchema(keywordData: any, generatedFAQs?: any[]) {
  const schemas: any[] = [];
  const currentDate = new Date().toISOString();

  // 1. Article schema (main content structure)
  schemas.push({
    type: "Article",
    properties: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: keywordData.keyword,
      description: `Comprehensive guide about ${keywordData.keyword}`,
      author: {
        "@type": "Person",
        name: "Author Name", // Will be replaced with actual author
      },
      datePublished: currentDate,
      dateModified: currentDate,
      publisher: {
        "@type": "Organization",
        name: "Organization Name", // Will be replaced
        logo: {
          "@type": "ImageObject",
          url: "" // Will be replaced
        }
      },
      image: "", // Will be replaced with actual image
      articleBody: "Generated content will be inserted here",
      wordCount: keywordData.targetWordCount || 1500,
      keywords: [keywordData.keyword, ...(keywordData.relatedKeywords?.slice(0, 5) || [])].join(", "),
    }
  });

  // 2. FAQPage schema with AI-generated answers
  if (generatedFAQs && generatedFAQs.length > 0) {
    schemas.push({
      type: "FAQPage",
      properties: {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: generatedFAQs.map((faq: any) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer || `Detailed answer about ${faq.question.replace("?", "")}`
          }
        }))
      }
    });
  } else if (keywordData.relatedKeywords && keywordData.relatedKeywords.length > 0) {
    // Fallback to basic FAQ schema without answers
    const faqQuestions = keywordData.relatedKeywords
      .filter((k: string) => k.includes("?") || k.toLowerCase().includes("how") || k.toLowerCase().includes("what") || k.toLowerCase().includes("why"))
      .slice(0, 8);

    if (faqQuestions.length > 0) {
      schemas.push({
        type: "FAQPage",
        properties: {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqQuestions.map((q: string) => ({
            "@type": "Question",
            name: q.endsWith("?") ? q : q + "?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "" // To be filled by AI-generated content
            }
          }))
        }
      });
    }
  }

  // 3. BreadcrumbList schema (for SEO navigation)
  schemas.push({
    type: "BreadcrumbList",
    properties: {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "/" // Will be replaced with actual domain
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Blog",
          item: "/blog"
        },
        {
          "@type": "ListItem",
          position: 3,
          name: keywordData.keyword,
          item: "" // Current page URL
        }
      ]
    }
  });

  // 4. HowTo schema for instructional content
  if (keywordData.searchIntent === "informational" && 
      (keywordData.keyword.toLowerCase().includes("how to") || 
       keywordData.keyword.toLowerCase().includes("guide"))) {
    schemas.push({
      type: "HowTo",
      properties: {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: keywordData.keyword,
        description: `Learn ${keywordData.keyword} with this comprehensive guide`,
        totalTime: `PT${Math.ceil((keywordData.targetWordCount || 1500) / 200)}M`,
        step: [] // Will be populated from outline sections
      }
    });
  }

  return schemas;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Extract semantic entities (Phase 2 Enhanced with NLP)
// ─────────────────────────────────────────────────────────────────────────────
function extractSemanticEntities(keywordData: any, serpData: any) {
  const commonTopics = serpData?.overallInsights?.commonTopics || [];
  const relatedKeywords = keywordData.relatedKeywords || [];
  const competitors = keywordData.topCompetitors || [];
  
  // 1. Required entities (must-have keywords)
  const required = [
    keywordData.keyword,
    ...relatedKeywords.slice(0, 5).filter((k: string) => !k.includes("?")),
  ];

  // 2. Recommended entities from common topics and competitor analysis
  const recommended = [
    ...commonTopics.slice(0, 10),
    ...extractEntitiesFromCompetitors(competitors),
  ];

  // 3. Niche-specific entities (authority domains and specialized terms)
  const niche = [
    ...(serpData?.overallInsights?.topAuthorityDomains || []),
    ...extractNicheTerms(keywordData.keyword, competitors),
  ];

  // 4. Topical clusters (semantic groupings)
  const topicalClusters = buildTopicalClusters(required, recommended);

  // 5. Entity density recommendations
  const entityDensity = calculateEntityDensity(
    required.length,
    recommended.length,
    keywordData.targetWordCount || 1500
  );

  return {
    required: [...new Set(required)].slice(0, 10),
    recommended: [...new Set(recommended)].slice(0, 20),
    niche: [...new Set(niche)].slice(0, 10),
    topicalClusters,
    densityRecommendations: entityDensity,
  };
}

// Extract entities from competitor headings and content signals
function extractEntitiesFromCompetitors(competitors: any[]): string[] {
  const entities: string[] = [];
  
  competitors.slice(0, 5).forEach((comp: any) => {
    // Extract from H2/H3 headings
    const headings = [
      ...(comp.headings?.h2 || []),
      ...(comp.headings?.h3 || []),
    ];
    
    headings.forEach((heading: string) => {
      // Extract multi-word entities (2-3 words)
      const words = heading.toLowerCase().split(/\s+/);
      for (let i = 0; i < words.length - 1; i++) {
        if (words[i].length > 3 && words[i + 1].length > 3) {
          entities.push(`${words[i]} ${words[i + 1]}`);
        }
      }
    });
    
    // Extract unique angles as entities
    if (comp.uniqueAngles) {
      entities.push(...comp.uniqueAngles);
    }
  });
  
  // Return most frequent entities
  const frequency: Record<string, number> = {};
  entities.forEach(entity => {
    const normalized = entity.toLowerCase().trim();
    frequency[normalized] = (frequency[normalized] || 0) + 1;
  });
  
  return Object.entries(frequency)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([entity]) => entity)
    .slice(0, 15);
}

// Extract niche-specific terminology
function extractNicheTerms(keyword: string, competitors: any[]): string[] {
  const terms: string[] = [];
  const keywordWords = new Set(keyword.toLowerCase().split(/\s+/));
  
  competitors.slice(0, 3).forEach((comp: any) => {
    const headings = [
      ...(comp.headings?.h2 || []),
      ...(comp.headings?.h3 || []),
    ];
    
    headings.forEach((heading: string) => {
      const words = heading.toLowerCase().split(/\s+/);
      words.forEach(word => {
        // Find specialized terms (longer words not in keyword)
        if (word.length > 6 && !keywordWords.has(word) && /^[a-z]+$/.test(word)) {
          terms.push(word);
        }
      });
    });
  });
  
  // Return unique specialized terms
  return [...new Set(terms)].slice(0, 10);
}

// Build topical clusters from entities
function buildTopicalClusters(required: string[], recommended: string[]): Record<string, string[]> {
  const clusters: Record<string, string[]> = {};
  
  // Simple clustering based on word overlap
  required.forEach(entity => {
    const words = entity.toLowerCase().split(/\s+/);
    const mainWord = words[0];
    
    if (!clusters[mainWord]) {
      clusters[mainWord] = [];
    }
    
    // Find related entities
    recommended.forEach(recEntity => {
      if (recEntity.toLowerCase().includes(mainWord) && !clusters[mainWord].includes(recEntity)) {
        clusters[mainWord].push(recEntity);
      }
    });
  });
  
  // Keep only clusters with 2+ items
  Object.keys(clusters).forEach(key => {
    if (clusters[key].length < 2) {
      delete clusters[key];
    }
  });
  
  return clusters;
}

// Calculate entity density recommendations
function calculateEntityDensity(requiredCount: number, recommendedCount: number, wordCount: number) {
  const totalEntities = requiredCount + recommendedCount;
  const optimalDensity = 0.02; // 2% entity density target
  const currentDensity = totalEntities / wordCount;
  
  return {
    current: Math.round(currentDensity * 100) / 100,
    optimal: optimalDensity,
    status: currentDensity >= optimalDensity ? "good" : "needs_improvement",
    recommendation: currentDensity < optimalDensity 
      ? `Add ${Math.ceil((optimalDensity * wordCount) - totalEntities)} more semantic entities`
      : "Entity density is optimal",
    targetMentions: {
      required: Math.max(3, Math.floor(wordCount / 500)), // Mention required entities 3+ times
      recommended: Math.max(1, Math.floor(wordCount / 1000)), // Mention recommended entities 1+ times
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Determine writing style based on intent
// ─────────────────────────────────────────────────────────────────────────────
function determineStyle(intent: string) {
  switch (intent) {
    case "commercial":
    case "transactional":
      return "persuasive and action-oriented";
    case "navigational":
      return "clear and instructional";
    default:
      return "informative and educational";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Determine writing level based on difficulty
// ─────────────────────────────────────────────────────────────────────────────
function determineWritingLevel(difficulty: string) {
  switch (difficulty) {
    case "low":
      return "beginner-friendly";
    case "high":
      return "advanced and technical";
    default:
      return "intermediate";
  }
}
