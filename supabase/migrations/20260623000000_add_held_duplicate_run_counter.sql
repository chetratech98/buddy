-- Tracks how many daily-blog-generator runs produced a post that was held
-- back as a draft (instead of auto-published) because it was flagged as a
-- near-duplicate of an existing post — visibility into how often the new
-- duplicate-topic safety net actually fires.
ALTER TABLE public.daily_blog_generator_runs
  ADD COLUMN IF NOT EXISTS "heldDuplicate" integer NOT NULL DEFAULT 0;
