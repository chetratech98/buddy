-- =====================================================
-- MAKE USER ADMIN
-- =====================================================
-- Run this AFTER running DATABASE_SETUP.sql
-- This will grant you admin access to the admin panel

-- Step 1: Find your user ID and email
-- (This will show you all users in the system)
SELECT 
  p.id as profile_id,
  p.user_id,
  u.email,
  p.role as current_role,
  p.display_name
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id;

-- Step 2: Update YOUR email below (replace 'your-email@example.com')
-- Then run this query to make yourself admin:

UPDATE public.profiles 
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'your-email@example.com'
);

-- Step 3: Verify you are now admin
-- (Should return your user with role = 'admin')
SELECT 
  p.id,
  u.email,
  p.role,
  p.display_name,
  CASE 
    WHEN p.role = 'admin' THEN '✅ You are now Admin!'
    ELSE '❌ Still a regular user'
  END as status
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE u.email = 'your-email@example.com';

-- =====================================================
-- AFTER RUNNING THIS:
-- 1. Sign out from your app
-- 2. Sign in again
-- 3. Visit: http://localhost:5174/admin
-- 4. You should see the Admin Dashboard!
-- =====================================================
