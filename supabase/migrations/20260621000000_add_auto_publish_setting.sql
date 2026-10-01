-- Lets a user opt in to having daily-blog-generator's output actually go
-- live on their connected platforms instead of landing as an unpublished
-- draft that only a human can see and schedule. Defaults to false: until a
-- user explicitly turns this on, AI-generated posts keep today's behavior
-- (drafts in Posts, nothing publishes without a human).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_publish_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.auto_publish_enabled IS
  'When true, daily-blog-generator schedules its output for immediate publish on connected platforms (WordPress/Medium) via scheduled-publisher, instead of leaving it as a draft.';
