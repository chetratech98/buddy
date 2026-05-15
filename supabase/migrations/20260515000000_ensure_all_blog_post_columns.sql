-- ============================================================
-- Ensure all blog_posts columns exist for the application
-- This migration is idempotent - safe to run multiple times
-- ============================================================

-- Add any missing columns to blog_posts table
ALTER TABLE public.blog_posts 
ADD COLUMN IF NOT EXISTS category text DEFAULT '',
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS seo_title text DEFAULT '',
ADD COLUMN IF NOT EXISTS seo_description text DEFAULT '',
ADD COLUMN IF NOT EXISTS featured_image_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS published_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS platform_wordpress boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS platform_medium boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS platform_status jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS seo_score integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS word_count integer DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.blog_posts.category IS 'Post category for organization';
COMMENT ON COLUMN public.blog_posts.tags IS 'Array of tags for the post';
COMMENT ON COLUMN public.blog_posts.seo_title IS 'Custom SEO title (meta title)';
COMMENT ON COLUMN public.blog_posts.seo_description IS 'Custom SEO description (meta description)';
COMMENT ON COLUMN public.blog_posts.featured_image_url IS 'URL of the featured/hero image';
COMMENT ON COLUMN public.blog_posts.scheduled_at IS 'When the post should be published (NULL if not scheduled)';
COMMENT ON COLUMN public.blog_posts.published_at IS 'When the post was actually published';
COMMENT ON COLUMN public.blog_posts.platform_wordpress IS 'Whether to publish to WordPress';
COMMENT ON COLUMN public.blog_posts.platform_medium IS 'Whether to publish to Medium';
COMMENT ON COLUMN public.blog_posts.platform_status IS 'Publishing status for each platform (JSONB)';
COMMENT ON COLUMN public.blog_posts.seo_score IS 'Cached SEO score (0-100) from seo-scorer';
COMMENT ON COLUMN public.blog_posts.word_count IS 'Actual word count of content field';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_seo_score 
  ON public.blog_posts (seo_score DESC) 
  WHERE seo_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_blog_posts_status 
  ON public.blog_posts (status);

CREATE INDEX IF NOT EXISTS idx_blog_posts_scheduled_at 
  ON public.blog_posts (scheduled_at) 
  WHERE scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at 
  ON public.blog_posts (published_at DESC) 
  WHERE published_at IS NOT NULL;

-- Update status constraint to include all statuses used in the app
ALTER TABLE public.blog_posts 
DROP CONSTRAINT IF EXISTS blog_posts_status_check;

ALTER TABLE public.blog_posts 
ADD CONSTRAINT blog_posts_status_check 
CHECK (status IN ('draft', 'review', 'scheduled', 'published'));

SELECT '✅ All blog_posts columns verified and created' as message;
