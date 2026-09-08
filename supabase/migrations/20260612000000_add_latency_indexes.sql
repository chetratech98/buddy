-- Missing indexes for hot query paths, found via latency audit:
-- blog_posts, content_plans, and post_rankings were all being filtered by
-- user_id (and sorted by created_at/checked_at) with no supporting index,
-- forcing a sequential scan on every Posts/ContentCalendar/Analytics/
-- TodaysBlog page load.

CREATE INDEX IF NOT EXISTS idx_blog_posts_user_created
  ON public.blog_posts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_plans_user_created
  ON public.content_plans(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_rankings_user_checked
  ON public.post_rankings(user_id, checked_at DESC);

-- rank-tracker filters published posts and orders by published_at; the
-- existing standalone idx_blog_posts_status is low-selectivity (4 values)
-- and won't help that ordering.
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published_at
  ON public.blog_posts(status, published_at DESC);
