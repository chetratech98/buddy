-- wordpress_sites (multi-site support) has existed since the multi-tenancy
-- migration, with a full UI at /settings/sites and a real is_default flag —
-- but blog_posts had no way to reference a site at all, and nothing in the
-- actual publish pipeline (publish-to-wordpress, scheduled-publisher,
-- daily-blog-generator) ever read from wordpress_sites. Adding a second
-- site in Settings had zero effect on where any post actually published —
-- everything silently kept going to the single legacy profiles.wp_url.
--
-- Nullable and unused by any UI yet (no per-post site picker exists) — this
-- is the plumbing a future site-picker would write to. In the meantime,
-- the publish pipeline resolves credentials via (in order): this column if
-- set, else the org/user's default wordpress_sites row, else the legacy
-- profiles.wp_url fields — so the already-built "Default" button in
-- Settings > Sites becomes the real, functioning control surface today.
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS wordpress_site_id uuid REFERENCES public.wordpress_sites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS blog_posts_wordpress_site_idx ON public.blog_posts(wordpress_site_id);
