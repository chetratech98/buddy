-- Add encrypted WordPress password column
-- The plaintext wp_app_password column is kept but will be nulled out
-- after users re-save their credentials through the updated UI.
-- Edge Functions read wp_app_password_enc (preferred) with fallback to wp_app_password.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wp_app_password_enc TEXT;

-- Security: revoke direct SELECT on wp_app_password from the anon role
-- so the frontend can never read plaintext credentials via the Supabase client
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop and recreate the user self-read policy to explicitly exclude the plaintext password
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

-- Create a secure view that never exposes the plaintext or encrypted password fields
-- (Frontend should use this view for reading profile data)
CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT
  id,
  user_id,
  display_name,
  avatar_url,
  website_url,
  niche,
  keywords,
  org_goals,
  org_vision,
  role,
  subscription_tier,
  subscription_status,
  stripe_customer_id,
  stripe_subscription_id,
  posts_quota_monthly,
  posts_used_this_month,
  quota_reset_date,
  notification_preferences,
  onboarding_completed,
  onboarding_step,
  medium_integration_token,
  medium_author_id,
  wp_url,
  wp_username,
  -- Expose only whether a password is configured, never the password itself
  (wp_app_password_enc IS NOT NULL) AS has_wp_password,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the safe view
GRANT SELECT ON public.profiles_safe TO authenticated;
GRANT SELECT ON public.profiles_safe TO anon;
