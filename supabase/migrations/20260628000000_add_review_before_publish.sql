-- blog_posts.status already supports "review", but nothing ever set it —
-- auto-publish either published immediately or landed as a plain draft.
-- This adds an opt-in safety net: when enabled, auto-generated posts that
-- would otherwise auto-publish are held as "review" instead, requiring an
-- explicit human approval (via the existing publish-now pipeline) before
-- they actually go out. Defaults to false so existing auto-publish users
-- keep today's instant-publish behavior unless they opt in.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS require_review_before_publish boolean NOT NULL DEFAULT false;
