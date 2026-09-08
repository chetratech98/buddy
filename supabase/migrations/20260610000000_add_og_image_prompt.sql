-- ============================================================
-- OG image prompt — generated alongside each blog post so users
-- have a ready-to-use prompt for an AI image generator (DALL-E,
-- Midjourney, Stable Diffusion, etc.) to create the post's
-- Open Graph / featured image.
-- ============================================================
alter table public.blog_posts
  add column if not exists og_image_prompt text default '';

comment on column public.blog_posts.og_image_prompt is
  'AI-generated image prompt describing the ideal OG/featured image for this post — for use with an external image generator';
