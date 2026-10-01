/**
 * Builds schema.org JSON-LD (BlogPosting + FAQPage) from a generated post,
 * so the FAQ section generate-blog already requires every post to have
 * actually gets to claim the rich-snippet eligibility it was written for,
 * instead of just sitting in the page as plain text.
 *
 * FAQ detection mirrors _shared/seo-scorer.ts's own heading pattern
 * (`/^#{2,3}[^#\n]+\?$/gm`) so "does this post have a FAQ" never disagrees
 * between the scorer and the schema it feeds.
 */

export interface FaqPair {
  question: string;
  answer: string;
}

/** Strips common markdown syntax down to plain text for use inside JSON-LD. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")           // code fences
    .replace(/`([^`]+)`/g, "$1")              // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")     // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")  // links -> link text
    .replace(/\*\*([^*]+)\*\*/g, "$1")        // bold
    .replace(/\*([^*]+)\*/g, "$1")            // italic
    .replace(/^#{1,6}\s+/gm, "")              // stray headings
    .replace(/^[-*+]\s+/gm, "")               // bullet markers
    .replace(/^\d+\.\s+/gm, "")               // numbered list markers
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Extracts Q&A pairs from a post's "### Question text?" / "## Question
 * text?" headings — the exact format generate-blog's system prompt
 * requires for every post's FAQ section. The answer is everything between
 * that heading and the next heading of any level.
 */
export function extractFaqPairs(markdown: string, maxPairs = 10): FaqPair[] {
  if (!markdown) return [];

  const lines = markdown.split("\n");
  const questionLineRe = /^#{2,3}\s+(.+\?)\s*$/;
  const anyHeadingRe = /^#{1,6}\s+/;

  const pairs: FaqPair[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(questionLineRe);
    if (!match) continue;

    const question = stripMarkdown(match[1]);
    const answerLines: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (anyHeadingRe.test(lines[j])) break;
      answerLines.push(lines[j]);
    }
    const answer = stripMarkdown(answerLines.join("\n"));
    if (question && answer) pairs.push({ question, answer });
    if (pairs.length >= maxPairs) break;
  }
  return pairs;
}

export interface PostSchemaInput {
  title: string;
  excerpt?: string;
  content: string;
  featuredImageUrl?: string | null;
  publishedAt?: string | null;
  authorName?: string | null;
}

/**
 * Builds the schema object(s) for a post: BlogPosting always, plus FAQPage
 * when the post actually has a detectable FAQ section. Returns an array
 * (1 or 2 entries) rather than a single @graph so each stays a valid,
 * independently-parseable JSON-LD object.
 */
export function buildPostSchemas(post: PostSchemaInput): Record<string, unknown>[] {
  const schemas: Record<string, unknown>[] = [];
  const datePublished = post.publishedAt || new Date().toISOString();

  const blogPosting: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished,
    dateModified: datePublished,
  };
  if (post.excerpt) blogPosting.description = post.excerpt;
  if (post.featuredImageUrl) blogPosting.image = [post.featuredImageUrl];
  if (post.authorName) {
    blogPosting.author = { "@type": "Person", name: post.authorName };
  }
  schemas.push(blogPosting);

  const faqPairs = extractFaqPairs(post.content);
  if (faqPairs.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqPairs.map((pair) => ({
        "@type": "Question",
        name: pair.question,
        acceptedAnswer: { "@type": "Answer", text: pair.answer },
      })),
    });
  }

  return schemas;
}

/** Wraps the schema object(s) in a single <script type="application/ld+json"> tag. */
export function schemaScriptTag(schemas: Record<string, unknown>[]): string {
  if (schemas.length === 0) return "";
  const payload = schemas.length === 1 ? schemas[0] : schemas;
  return `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;
}
