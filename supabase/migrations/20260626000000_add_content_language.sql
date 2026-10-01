-- generate-blog had no language parameter at all — output was implicitly
-- English-only. Defaults to 'English' so existing behavior is unchanged
-- for every current user; daily-blog-generator reads this to keep the
-- automated pipeline consistent with whatever a user picks, not just
-- one-off manual generations in CreatePost.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS content_language text NOT NULL DEFAULT 'English';
