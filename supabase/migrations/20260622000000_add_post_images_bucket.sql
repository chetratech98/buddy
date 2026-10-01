-- Storage bucket for AI-generated featured/OG images, so generate-blog can
-- persist the image it generates from ogImagePrompt instead of only handing
-- back a prompt for a human to paste into an external image tool by hand.
-- Mirrors the avatars bucket's per-user-folder RLS pattern.

INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- Service-role calls (generate-blog running as the daily-blog-generator cron)
-- bypass RLS entirely, so this only needs to cover interactive calls where
-- generate-blog runs with the caller's own JWT.
CREATE POLICY "Users can upload their own post images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own post images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own post images"
ON storage.objects FOR DELETE
USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Public read: WordPress/Medium (and the public site) need to be able to
-- fetch the image by URL when the post is published.
CREATE POLICY "Post images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-images');
