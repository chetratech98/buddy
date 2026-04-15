/**
 * Real SEO Scorer — all calculations are deterministic, no AI estimation.
 *
 * Scoring dimensions (total 100 pts):
 *   Word count          20 pts
 *   Keyword density     20 pts
 *   Heading structure   15 pts
 *   Readability         15 pts
 *   Meta description    10 pts
 *   FAQ presence        10 pts
 *   Title quality        5 pts
 *   Semantic richness    5 pts
 */

export interface SeoScoreBreakdown {
  total: number;            // 0–100
  grade: "A" | "B" | "C" | "D" | "F";
  wordCount:        { score: number; max: number; value: number;  note: string };
  keywordDensity:   { score: number; max: number; value: string;  note: string };
  headingStructure: { score: number; max: number; h2Count: number; h3Count: number; note: string };
  readability:      { score: number; max: number; fleschScore: number; level: string; note: string };
  metaDescription:  { score: number; max: number; length: number; note: string };
  faqPresence:      { score: number; max: number; faqCount: number; note: string };
  titleQuality:     { score: number; max: number; titleLength: number; note: string };
  semanticRichness: { score: number; max: number; lsiCount: number; note: string };
  suggestions: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")          // code blocks
    .replace(/`[^`]+`/g, " ")                  // inline code
    .replace(/!\[.*?\]\(.*?\)/g, " ")          // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")   // links
    .replace(/^#{1,6}\s+/gm, " ")              // headings
    .replace(/[*_~>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return stripMarkdown(text)
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);
}

function countWords(text: string): number {
  return tokenize(text).length;
}

/**
 * Average sentence length → Flesch Reading Ease approximation.
 * Real Flesch formula: 206.835 − 1.015 × (words/sentences) − 84.6 × (syllables/words)
 * We use a simplified proxy: 100 − (avgSentenceLength − 15) × 3, clamped 0–100.
 */
function fleschApprox(plainText: string): { score: number; level: string } {
  const sentences = plainText.split(/[.!?]+/).filter((s) => s.trim().length > 5);
  if (sentences.length === 0) return { score: 50, level: "Unknown" };

  const words = plainText.split(/\s+/).filter((w) => w.length > 0);
  const avgLen = words.length / Math.max(sentences.length, 1);

  // Simplified Flesch proxy: ideal avg sentence ≈ 15–20 words
  const raw = 100 - (avgLen - 15) * 3;
  const score = Math.max(0, Math.min(100, raw));

  let level = "Very Difficult";
  if (score >= 90) level = "Very Easy";
  else if (score >= 70) level = "Easy";
  else if (score >= 60) level = "Standard";
  else if (score >= 50) level = "Fairly Difficult";
  else if (score >= 30) level = "Difficult";

  return { score: Math.round(score), level };
}

function extractKeywordTerms(keywords: string[]): string[] {
  // Split comma-separated keyword strings into individual terms
  return keywords
    .flatMap((k) => k.split(","))
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

function keywordDensity(text: string, keyword: string): number {
  if (!keyword) return 0;
  const words = tokenize(text);
  const kwTokens = keyword.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  if (kwTokens.length === 0 || words.length === 0) return 0;

  // Count overlapping windows of kwTokens.length
  let matches = 0;
  for (let i = 0; i <= words.length - kwTokens.length; i++) {
    if (kwTokens.every((t, j) => words[i + j] === t)) matches++;
  }
  return matches / words.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main scorer
// ─────────────────────────────────────────────────────────────────────────────

export function scoreContent(params: {
  title: string;
  content: string;
  keywords: string[];
  seoDescription: string;
}): SeoScoreBreakdown {
  const { title, content, keywords, seoDescription } = params;
  const suggestions: string[] = [];

  const plainContent = stripMarkdown(content);
  const kwTerms = extractKeywordTerms(keywords);
  const primaryKw = kwTerms[0] ?? "";

  // ── 1. Word Count (max 20) ──────────────────────────────────────────────────
  const wc = countWords(content);
  let wcScore = 0;
  let wcNote = "";
  if (wc >= 2500)       { wcScore = 20; wcNote = "Excellent length for SEO"; }
  else if (wc >= 2000)  { wcScore = 17; wcNote = "Good length"; }
  else if (wc >= 1500)  { wcScore = 13; wcNote = "Acceptable — aim for 2,000+"; }
  else if (wc >= 1000)  { wcScore =  8; wcNote = "Too short for competitive keywords"; }
  else if (wc >= 500)   { wcScore =  4; wcNote = "Very short — expand significantly"; }
  else                  { wcScore =  0; wcNote = "Critically short"; }
  if (wc < 2000) suggestions.push(`Expand to at least 2,000 words (currently ${wc.toLocaleString()})`);

  // ── 2. Keyword Density (max 20) ────────────────────────────────────────────
  const density = primaryKw ? keywordDensity(content, primaryKw) : 0;
  const densityPct = (density * 100).toFixed(2);
  let kdScore = 0;
  let kdNote = "";
  if (!primaryKw) {
    kdScore = 10; kdNote = "No primary keyword specified";
    suggestions.push("Add target keywords for accurate density scoring");
  } else if (density >= 0.01 && density <= 0.025) {
    kdScore = 20; kdNote = `${densityPct}% — ideal range (1.0–2.5%)`;
  } else if (density > 0.025 && density <= 0.035) {
    kdScore = 14; kdNote = `${densityPct}% — slightly high, may look spammy`;
    suggestions.push(`Reduce "${primaryKw}" mentions — density at ${densityPct}% (ideal: 1–2.5%)`);
  } else if (density > 0.035) {
    kdScore = 5;  kdNote = `${densityPct}% — keyword stuffing detected`;
    suggestions.push(`CRITICAL: Keyword stuffing detected (${densityPct}%) — reduce to under 2.5%`);
  } else if (density > 0 && density < 0.01) {
    kdScore = 10; kdNote = `${densityPct}% — too low, add more mentions`;
    suggestions.push(`Increase "${primaryKw}" usage — currently only ${densityPct}% (need 1.0%+)`);
  } else {
    kdScore = 0; kdNote = "Keyword not found in content";
    suggestions.push(`Primary keyword "${primaryKw}" does not appear in content`);
  }

  // ── 3. Heading Structure (max 15) ──────────────────────────────────────────
  const h2Matches = content.match(/^## .+/gm) ?? [];
  const h3Matches = content.match(/^### .+/gm) ?? [];
  const h2Count = h2Matches.length;
  const h3Count = h3Matches.length;
  let hsScore = 0;
  let hsNote = "";
  if (h2Count >= 5 && h3Count >= 2)       { hsScore = 15; hsNote = "Strong heading hierarchy"; }
  else if (h2Count >= 4)                   { hsScore = 12; hsNote = "Good structure"; }
  else if (h2Count >= 3)                   { hsScore =  9; hsNote = "Acceptable — add more sections"; }
  else if (h2Count >= 1)                   { hsScore =  5; hsNote = "Too few H2 headings"; }
  else                                     { hsScore =  0; hsNote = "No H2 headings found"; }
  if (h2Count < 4) suggestions.push(`Add more H2 sections (have ${h2Count}, aim for 5+)`);
  if (h3Count < 2) suggestions.push("Add H3 sub-headings to improve content structure");

  // Check if primary keyword appears in any heading
  if (primaryKw) {
    const allHeadings = [...h2Matches, ...h3Matches].join(" ").toLowerCase();
    if (!allHeadings.includes(primaryKw.toLowerCase())) {
      hsScore = Math.max(0, hsScore - 3);
      suggestions.push(`Add "${primaryKw}" to at least one H2 heading`);
    }
  }

  // ── 4. Readability (max 15) ────────────────────────────────────────────────
  const { score: fleschScore, level: fleschLevel } = fleschApprox(plainContent);
  let readScore = 0;
  let readNote = "";
  if (fleschScore >= 70)      { readScore = 15; readNote = `${fleschLevel} (${fleschScore}/100)`; }
  else if (fleschScore >= 60) { readScore = 12; readNote = `${fleschLevel} (${fleschScore}/100)`; }
  else if (fleschScore >= 50) { readScore =  9; readNote = `${fleschLevel} — simplify sentences`; }
  else if (fleschScore >= 30) { readScore =  5; readNote = `${fleschLevel} — too complex`; }
  else                        { readScore =  2; readNote = `${fleschLevel} — very hard to read`; }
  if (fleschScore < 60) suggestions.push("Simplify sentence structure — aim for shorter sentences (15–20 words avg)");

  // ── 5. Meta Description (max 10) ──────────────────────────────────────────
  const metaLen = seoDescription?.length ?? 0;
  let metaScore = 0;
  let metaNote = "";
  if (metaLen >= 120 && metaLen <= 160) {
    metaScore = 10; metaNote = `${metaLen} chars — perfect length`;
  } else if (metaLen >= 80 && metaLen < 120) {
    metaScore = 7;  metaNote = `${metaLen} chars — a bit short`;
    suggestions.push(`Expand meta description to 120–160 chars (currently ${metaLen})`);
  } else if (metaLen > 160) {
    metaScore = 6;  metaNote = `${metaLen} chars — Google will truncate`;
    suggestions.push(`Shorten meta description to under 160 chars (currently ${metaLen})`);
  } else if (metaLen > 0) {
    metaScore = 3;  metaNote = `${metaLen} chars — too short`;
    suggestions.push("Write a meta description of 120–160 chars for better CTR");
  } else {
    metaScore = 0;  metaNote = "Missing meta description";
    suggestions.push("Add a meta description (120–160 chars) — critical for CTR");
  }

  // ── 6. FAQ Section (max 10) ────────────────────────────────────────────────
  const faqPatterns = [
    /^## (?:FAQ|Frequently Asked Questions)/im,
    /^### .+\?$/gm,
    /\*\*Q:|Q:/gim,
    /\?[\n\r]/g,
  ];
  const hasFaqHeading = /^#{2,3} (?:FAQ|Frequently Asked Questions)/im.test(content);
  const questionLineMatches = (content.match(/^#{2,3}[^#\n]+\?$/gm) ?? []).length;
  const faqCount = hasFaqHeading ? Math.max(3, questionLineMatches) : questionLineMatches;
  let faqScore = 0;
  let faqNote = "";
  if (faqCount >= 3) {
    faqScore = 10; faqNote = `${faqCount} questions detected — good for PAA features`;
  } else if (faqCount >= 1) {
    faqScore = 5;  faqNote = `${faqCount} question(s) found — add more`;
    suggestions.push("Expand FAQ section to at least 5 questions to target People Also Ask");
  } else {
    faqScore = 0;  faqNote = "No FAQ section found";
    suggestions.push("Add a FAQ section (5+ questions) — helps win People Also Ask SERP features");
  }

  // ── 7. Title Quality (max 5) ───────────────────────────────────────────────
  const titleLen = title?.length ?? 0;
  let titleScore = 0;
  let titleNote = "";
  if (titleLen >= 50 && titleLen <= 70) {
    titleScore = 5; titleNote = `${titleLen} chars — ideal length`;
  } else if (titleLen >= 40 && titleLen < 50) {
    titleScore = 3; titleNote = `${titleLen} chars — slightly short`;
    suggestions.push("Lengthen title to 50–70 chars for optimal SERP display");
  } else if (titleLen > 70 && titleLen <= 85) {
    titleScore = 3; titleNote = `${titleLen} chars — may be truncated`;
    suggestions.push("Shorten title to under 70 chars to avoid truncation");
  } else if (titleLen > 0) {
    titleScore = 1; titleNote = `${titleLen} chars — needs adjustment`;
    suggestions.push("Title should be 50–70 chars for best SEO performance");
  } else {
    titleScore = 0; titleNote = "Missing title";
    suggestions.push("Add an SEO title");
  }

  // Check keyword in title
  if (primaryKw && title && !title.toLowerCase().includes(primaryKw.toLowerCase())) {
    titleScore = Math.max(0, titleScore - 2);
    suggestions.push(`Include primary keyword "${primaryKw}" in the title`);
  }

  // ── 8. Semantic Richness / LSI Keywords (max 5) ───────────────────────────
  // Check for related terms / synonyms presence (LSI signal)
  const lsiTermsFound = kwTerms.filter((kw, idx) => {
    if (idx === 0) return false; // skip primary (already scored above)
    return content.toLowerCase().includes(kw.toLowerCase());
  }).length;

  let lsiScore = 0;
  let lsiNote = "";
  if (lsiTermsFound >= 3) {
    lsiScore = 5; lsiNote = `${lsiTermsFound} related keywords integrated`;
  } else if (lsiTermsFound >= 1) {
    lsiScore = 3; lsiNote = `${lsiTermsFound} related keyword(s) found`;
    suggestions.push("Use more secondary keywords throughout content for semantic richness");
  } else {
    lsiScore = 1; lsiNote = "Only primary keyword used";
    suggestions.push("Add related/secondary keywords to increase semantic depth");
  }

  // ── Final total ────────────────────────────────────────────────────────────
  const total = wcScore + kdScore + hsScore + readScore + metaScore + faqScore + titleScore + lsiScore;

  let grade: "A" | "B" | "C" | "D" | "F";
  if      (total >= 85) grade = "A";
  else if (total >= 70) grade = "B";
  else if (total >= 55) grade = "C";
  else if (total >= 40) grade = "D";
  else                  grade = "F";

  return {
    total,
    grade,
    wordCount:        { score: wcScore,    max: 20, value: wc,          note: wcNote  },
    keywordDensity:   { score: kdScore,    max: 20, value: densityPct + "%", note: kdNote },
    headingStructure: { score: hsScore,    max: 15, h2Count, h3Count,   note: hsNote  },
    readability:      { score: readScore,  max: 15, fleschScore,        level: fleschLevel, note: readNote },
    metaDescription:  { score: metaScore,  max: 10, length: metaLen,    note: metaNote },
    faqPresence:      { score: faqScore,   max: 10, faqCount,           note: faqNote },
    titleQuality:     { score: titleScore, max: 5,  titleLength: titleLen, note: titleNote },
    semanticRichness: { score: lsiScore,   max: 5,  lsiCount: lsiTermsFound, note: lsiNote },
    suggestions: suggestions.slice(0, 6), // top 6 suggestions
  };
}

/** Returns a color class based on total score */
export function scoreColor(total: number): string {
  if (total >= 85) return "text-green-500";
  if (total >= 70) return "text-blue-500";
  if (total >= 55) return "text-yellow-500";
  if (total >= 40) return "text-orange-500";
  return "text-red-500";
}

/** Returns a background color class based on total score */
export function scoreBg(total: number): string {
  if (total >= 85) return "bg-green-500/10 border-green-500/20";
  if (total >= 70) return "bg-blue-500/10 border-blue-500/20";
  if (total >= 55) return "bg-yellow-500/10 border-yellow-500/20";
  if (total >= 40) return "bg-orange-500/10 border-orange-500/20";
  return "bg-red-500/10 border-red-500/20";
}
