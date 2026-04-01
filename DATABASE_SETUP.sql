-- =====================================================
-- COMPLETE DATABASE SETUP FOR SUPABASE
-- =====================================================
-- Copy and paste this ENTIRE file into Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/sql/new
-- Then click "RUN" to create all tables and setup

-- =====================================================
-- STEP 1: CREATE PROFILES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STEP 2: CREATE BLOG_POSTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  excerpt TEXT,
  keywords TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Users can view their own posts
DROP POLICY IF EXISTS "Users can view their own posts" ON public.blog_posts;
CREATE POLICY "Users can view their own posts"
ON public.blog_posts FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own posts
DROP POLICY IF EXISTS "Users can create their own posts" ON public.blog_posts;
CREATE POLICY "Users can create their own posts"
ON public.blog_posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
DROP POLICY IF EXISTS "Users can update their own posts" ON public.blog_posts;
CREATE POLICY "Users can update their own posts"
ON public.blog_posts FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own posts
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.blog_posts;
CREATE POLICY "Users can delete their own posts"
ON public.blog_posts FOR DELETE
USING (auth.uid() = user_id);

-- Timestamp trigger
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STEP 3: CREATE CONTENT_PLANS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.content_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  niche TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  long_tail_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  days INTEGER NOT NULL DEFAULT 30,
  tone TEXT NOT NULL DEFAULT 'professional',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Users can view their own plans" ON public.content_plans;
CREATE POLICY "Users can view their own plans"
ON public.content_plans FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own plans" ON public.content_plans;
CREATE POLICY "Users can create their own plans"
ON public.content_plans FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own plans" ON public.content_plans;
CREATE POLICY "Users can update their own plans"
ON public.content_plans FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own plans" ON public.content_plans;
CREATE POLICY "Users can delete their own plans"
ON public.content_plans FOR DELETE
USING (auth.uid() = user_id);

-- Timestamp trigger
DROP TRIGGER IF EXISTS update_content_plans_updated_at ON public.content_plans;
CREATE TRIGGER update_content_plans_updated_at
BEFORE UPDATE ON public.content_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STEP 4: CREATE SERP_ANALYSES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.serp_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  niche TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.serp_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own SERP analyses" ON public.serp_analyses;
CREATE POLICY "Users can view their own SERP analyses"
ON public.serp_analyses FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own SERP analyses" ON public.serp_analyses;
CREATE POLICY "Users can create their own SERP analyses"
ON public.serp_analyses FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own SERP analyses" ON public.serp_analyses;
CREATE POLICY "Users can update their own SERP analyses"
ON public.serp_analyses FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own SERP analyses" ON public.serp_analyses;
CREATE POLICY "Users can delete their own SERP analyses"
ON public.serp_analyses FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_serp_analyses_updated_at ON public.serp_analyses;
CREATE TRIGGER update_serp_analyses_updated_at
BEFORE UPDATE ON public.serp_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STEP 5: ADD WORDPRESS & SUBSCRIPTION FIELDS
-- =====================================================

-- Add WordPress integration fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS wp_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS wp_username text DEFAULT '',
ADD COLUMN IF NOT EXISTS wp_app_password text DEFAULT '';

-- Add subscription and billing fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS stripe_customer_id text DEFAULT '',
ADD COLUMN IF NOT EXISTS stripe_subscription_id text DEFAULT '',
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS posts_quota_monthly integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS posts_used_this_month integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS quota_reset_date timestamp with time zone DEFAULT date_trunc('month', now() + interval '1 month');

-- Add notification preferences
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"post_published": true, "review_needed": true, "scheduled_reminder": true, "weekly_digest": true}'::jsonb;

-- Add onboarding tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0;

-- =====================================================
-- STEP 6: ADD ADMIN ROLE
-- =====================================================

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

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

SELECT '✅ Database setup complete! All tables and policies created.' as message;
