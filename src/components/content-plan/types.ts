export type ContentItem = {
  day: number;
  title: string;
  type: string;
  keyword: string;
  description: string;
  long_tail_keyword?: string;
  writing_brief?: string;       // ~1000-word detailed writing guide (generated on demand)
  brief_generating?: boolean;   // transient UI flag
};

export const TYPE_COLORS: Record<string, string> = {
  blog: "bg-primary/10 text-primary",
  listicle: "bg-accent text-accent-foreground",
  "how-to": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "case-study": "bg-amber-