-- ============================================
-- STEP 1: ADD ADMIN ROLE TO DATABASE
-- ============================================
-- Run this FIRST in Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/sql/new

-- Add admin role column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create index for performance
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

-- Admin policies for profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Admin policies for blog_posts
DROP POLICY IF EXISTS "Admins can view all posts" ON public.blog_posts;
CREATE POLICY "Admins can view all posts"
ON public.blog_posts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Admin policies for content_plans
DROP POLICY IF EXISTS "Admins can view all content plans" ON public.content_plans;
CREATE POLICY "Admins can view all content plans"
ON public.content_plans FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Admin policies for serp_analyses
DROP POLICY IF EXISTS "Admins can view all serp analyses" ON public.serp_analyses;
CREATE POLICY "Admins can view all serp analyses"
ON public.serp_analyses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Success message
SELECT 'Admin role and policies created successfully!' as status;


-- ============================================
-- STEP 2: MAKE YOUR ACCOUNT ADMIN
-- ============================================
-- REPLACE 'your-email@example.com' WITH YOUR ACTUAL EMAIL!

UPDATE public.profiles 
SET role = 'admin' 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'your-email@example.com'
);

-- Verify it worked
SELECT 
  u.email,
  p.display_name,
  p.role,
  CASE WHEN p.role = 'admin' THEN '✅ You are now Admin' ELSE '❌ Still Regular User' END as status
FROM auth.users u
JOIN public.profiles p ON p.user_id = u.id
WHERE u.email = 'your-email@example.com';


-- ============================================
-- STEP 3: VERIFY ADMIN SETUP
-- ============================================

-- List all admin users
SELECT 
  u.email,
  p.display_name,
  p.role,
  p.subscription_tier,
  p.created_at
FROM auth.users u
JOIN public.profiles p ON p.user_id = u.id
WHERE p.role = 'admin'
ORDER BY p.created_at DESC;


-- ============================================
-- OPTIONAL: VIEW ALL USERS
-- ============================================

-- See all users and their details
SELECT 
  u.email,
  p.display_name,
  p.role,
  p.subscription_tier,
  p.subscription_status,
  p.posts_used_this_month,
  p.posts_quota_monthly,
  p.wp_url,
  p.created_at
FROM auth.users u
JOIN public.profiles p ON p.user_id = u.id
ORDER BY p.created_at DESC;


-- ============================================
-- OPTIONAL: REMOVE ADMIN ROLE
-- ============================================

-- To remove admin role from a user
-- UPDATE public.profiles 
-- SET role = 'user' 
-- WHERE user_id = (
--   SELECT id FROM auth.users 
--   WHERE email = 'user@example.com'
-- );
