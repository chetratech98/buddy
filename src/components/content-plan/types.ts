export type ContentItem = {
  day: number;
  title: string;
  type: string;
  keyword: string;
  description: string;
  long_tail_keyword?: string;
  audience_persona?: string;    // which ICP this post targets, e.g. "Aspiring AI Professional"
  writing_brief?: string;       // ~1000-word detailed writing guide (generated on demand)
  brief_generating?: boolean;   // transient UI flag
};

// Business intelligence carried over from the Analyze Site page — grounds
// the 30-day plan in the real business instead of generic niche/keywords.
export interface BusinessContext {
  topicClusters: { pillar: string; supporting: string[] }[];
  competitorKeywordGaps: string[];
  idealCustomerProfiles: { name: string; role?: string; painPoints?: string[]; goals?: string[] }[];
  icp: string;
  topServices: string[];
  mainCta: string;
  trustAssets: string[];
  brandVoice: string;
  valueProposition: string;
  businessModel: string;
  differentiators: string[];
}

export const emptyBusinessContext: BusinessContext = {
  topicClusters: [],
  competitorKeywordGaps: [],
  idealCustomerProfiles: [],
  icp: "",
  topServices: [],
  mainCta: "",
  trustAssets: [],
  brandVoice: "",
  valueProposition: "",
  businessModel: "",
  differentiators: [],
};

export const TYPE_COLORS: Record<string, string> = {
  blog: "bg-primary/10 text-primary",
  listicle: "bg-accent text-accent-foreground",
  "how-to": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "case-study": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  opinion: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};
