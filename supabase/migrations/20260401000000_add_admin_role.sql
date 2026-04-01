-- Add admin role to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create an index for performance
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = is_admin.user_id 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin policies for profiles (admins can see all profiles)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Admin policies for blog_posts (admins can see all posts)
DROP POLICY IF EXISTS "Admins can view all posts" ON public.blog_posts;
CREATE POLICY "Admins can view all posts"
ON public.blog_posts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Admin policies for content_plans (admins can see all plans)
DROP POLICY IF EXISTS "Admins can view all content plans" ON public.content_plans;
CREATE POLICY "Admins can view all content plans"
ON public.content_plans FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Admin policies for serp_analyses (admins can see all analyses)
DROP POLICY IF EXISTS "Admins can view all serp analyses" ON public.serp_analyses;
CREATE POLICY "Admins can view all serp analyses"
ON public.serp_analyses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Admin policies for subscriptions (admins can see all subscriptions)
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view all subscriptions"
ON public.subscriptions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Admin policies for publishing_logs (admins can see all logs)
DROP POLICY IF EXISTS "Admins can view all publishing logs" ON public.publishing_logs;
CREATE POLICY "Admins can view all publishing logs"
ON public.publishing_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Comment: To make a user an admin, run:
-- UPDATE public.profiles SET role = 'admin' WHERE user_id = '[USER_UUID]';
-- Or by email:
-- UPDATE public.profiles SET role = 'admin' 
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
