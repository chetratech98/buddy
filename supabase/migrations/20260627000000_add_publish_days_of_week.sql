-- Publishing cadence was hardcoded to "every calendar day" — no way to
-- restrict automated generation/publishing to specific weekdays (e.g.
-- "only Mon/Wed/Fri" for 3 posts/week). Defaults to every day (0=Sun..
-- 6=Sat, matching JS Date.getDay()) so existing users see no behavior
-- change until they explicitly narrow it down.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS publish_days_of_week smallint[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}';

-- Tracks how many daily-blog-generator runs skipped a user because today
-- isn't one of their configured publish weekdays — visibility into the
-- new cadence gate, same pattern as the existing skip counters.
ALTER TABLE public.daily_blog_generator_runs
  ADD COLUMN IF NOT EXISTS "skippedNotPublishDay" integer NOT NULL DEFAULT 0;
