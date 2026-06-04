# Fix Production Errors - Complete Guide

## 🔴 Current Errors You're Seeing

1. **CORS Error on Edge Functions** - "Response to preflight request doesn't pass access control check"
2. **500 Errors on Database** - profiles and blog_posts queries failing
3. **400 Errors** - Missing columns (niche, keywords)

## ✅ Root Causes

1. **Database migrations not run** - Tables/columns don't exist in production
2. **Edge function secrets not set** - OPENAI_API_KEY missing
3. **Edge functions possibly not deployed** - Functions may not be pushed to Supabase

---

## 🚀 SOLUTION 1: Deploy Database Migrations

### Step 1: Link Your Supabase Project
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref envewfudiyxmnuefbdow
```

### Step 2: Push ALL Migrations to Production
```bash
# This will run all migrations in supabase/migrations/ folder
supabase db push

# Verify migrations ran successfully
supabase db diff
```

**What this fixes:**
- ✅ Creates `profiles` table with all columns (niche, keywords, role, etc.)
- ✅ Creates `blog_posts`, `content_plans`, `serp_analyses` tables
- ✅ Sets up RLS policies
- ✅ Fixes 400/500 errors on database queries

---

## 🔐 SOLUTION 2: Set Edge Function Secrets

### Step 1: Go to Supabase Dashboard
https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/settings/functions

### Step 2: Add Secrets
Click "Add Secret" and add these:

**Required:**
- Name: `OPENAI_API_KEY`
- Value: Your OpenAI API key (starts with `sk-`)
- Get it from: https://platform.openai.com/api-keys

**Optional (for SEO Analysis):**
- Name: `SERP_API_KEY`  
- Value: Your SerpApi key
- Get it from: https://serpapi.com/manage-api-key

### Step 3: Redeploy Functions After Adding Secrets
```bash
# Redeploy all edge functions
supabase functions deploy generate-blog
supabase functions deploy generate-content-plan
supabase functions deploy seo-analysis
supabase functions deploy publish-to-wordpress
```

**What this fixes:**
- ✅ Edge functions can now call OpenAI API
- ✅ CORS errors will stop (functions return proper responses)
- ✅ Blog generation will work

---

## 📦 SOLUTION 3: Deploy Edge Functions

If you haven't deployed the functions yet:

```bash
# Deploy all functions at once
cd supabase/functions

supabase functions deploy generate-blog --no-verify-jwt
supabase functions deploy generate-content-plan --no-verify-jwt  
supabase functions deploy seo-analysis --no-verify-jwt
supabase functions deploy publish-to-wordpress --no-verify-jwt
```

**Note:** `--no-verify-jwt` flag allows the function to verify JWT itself (which all functions already do in code)

---

## 🧪 SOLUTION 4: Create Demo User & Data

After migrations are deployed:

### Step 1: Create Demo User in Supabase Auth
1. Go to: https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/auth/users
2. Click "Add User"
3. Email: `demo@blitznova.ai`
4. Password: `demo123456`
5. Uncheck "Send email confirmation"
6. Click "Create User"

### Step 2: Run Demo Data SQL
1. Go to: https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/sql/new
2. Copy entire contents of `SETUP_DEMO_ACCOUNT.sql`
3. Click "Run"

**What this provides:**
- ✅ Demo login button works on your site
- ✅ Sample blog post, content plan, SEO analysis to test with

---

## 📋 Complete Checklist

Run these commands in order:

```bash
# 1. Install Supabase CLI (if not installed)
npm install -g supabase

# 2. Login to Supabase
supabase login

# 3. Link your project
supabase link --project-ref envewfudiyxmnuefbdow

# 4. Push database migrations
supabase db push

# 5. Deploy edge functions
cd supabase/functions
supabase functions deploy generate-blog --no-verify-jwt
supabase functions deploy generate-content-plan --no-verify-jwt
supabase functions deploy seo-analysis --no-verify-jwt
supabase functions deploy publish-to-wordpress --no-verify-jwt

# 6. Return to project root
cd ../..
```

Then in Supabase Dashboard:
- ✅ Add `OPENAI_API_KEY` secret (Settings > Edge Functions > Secrets)
- ✅ Add `SERP_API_KEY` secret (optional)
- ✅ Create demo user in Auth (demo@blitznova.ai / demo123456)
- ✅ Run `SETUP_DEMO_ACCOUNT.sql` in SQL Editor

---

## 🎯 Expected Results

After completing all steps:

1. **No more CORS errors** - Edge functions respond correctly
2. **No more 500 errors** - Database tables exist with proper columns
3. **No more 400 errors** - All required columns (niche, keywords) exist
4. **Demo login works** - Click "Try Demo Account" button to test
5. **Blog generation works** - Create new blog posts successfully
6. **Content planning works** - Generate content plans
7. **SEO analysis works** - Analyze keywords and competitors

---

## 🆘 Troubleshooting

### If CORS errors persist:
- Verify secrets are set: Dashboard > Settings > Edge Functions > Secrets
- Check function logs: Dashboard > Edge Functions > Logs
- Redeploy functions after adding secrets

### If 500 errors persist:
- Verify migrations ran: `supabase db diff` should show no changes
- Check RLS policies aren't blocking: Dashboard > Database > Policies
- View database logs: Dashboard > Logs > Database

### If 400 errors persist:
- Check column exists: Dashboard > Table Editor > profiles > columns
- Should see: niche, keywords, role, org_goals, org_vision, etc.

### If demo login doesn't work:
- Verify demo user exists in Auth section
- Check user's email is exactly: `demo@blitznova.ai`
- Password is exactly: `demo123456`

---

## 📞 Quick Support

All code is correct - these are just deployment/configuration issues!

The edge functions **already have proper CORS headers** in all error responses. The CORS error happens because:
1. Functions can't execute without OPENAI_API_KEY
2. When function crashes before OPTIONS handler runs, no CORS headers are returned
3. Setting the secret fixes this

Run the commands above and your app will work perfectly! 🚀
