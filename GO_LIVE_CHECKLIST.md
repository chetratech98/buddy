# 🚀 GO LIVE CHECKLIST - Buddy AI SEO Auto Blog Generator

**Project Status:** 85% Complete - Needs Configuration & Deployment  
**Time to Launch:** 2-3 hours (following this guide)  
**Current Date:** April 8, 2026

---

## 📋 MASTER CHECKLIST

### ✅ PHASE 1: Local Setup & Testing (45 mins)

- [ ] **1.1 Verify Dependencies Installed**
  ```bash
  npm install
  ```
  ✅ Expected: "added XXX packages"

- [ ] **1.2 Check Supabase Connection**
  - Your .env already has: `https://envewfudiyxmnuefbdow.supabase.co`
  - Test: Start app and check if it loads
  ```bash
  npm run dev
  ```
  - Visit: http://localhost:5173
  - ✅ Should see landing page (no errors in console)

- [ ] **1.3 Get OpenAI API Key** ⚠️ REQUIRED
  - Go to: https://platform.openai.com/api-keys
  - Click "Create new secret key"
  - Name: "buddy-seo-generator"
  - Copy key (starts with `sk-proj-...`)
  - Set spending limit: $10/month recommended
  - **Cost:** ~$0.002-0.005 per blog post

- [ ] **1.4 Get Firecrawl API Key** (Optional - for SEO analysis)
  - Go to: https://firecrawl.dev
  - Sign up for free account
  - Copy API key (starts with `fc-...`)
  - Free tier: 500 requests/month

- [ ] **1.5 Link Supabase CLI**
  ```bash
  npx supabase login
  npx supabase link --project-ref envewfudiyxmnuefbdow
  ```
  ✅ Expected: "Linked to project envewfudiyxmnuefbdow"

- [ ] **1.6 Set API Keys in Supabase**
  ```bash
  # Set OpenAI key
  npx supabase secrets set OPENAI_API_KEY="sk-proj-your-actual-key-here"
  
  # Set Firecrawl key (optional)
  npx supabase secrets set FIRECRAWL_API_KEY="fc-your-actual-key-here"
  ```
  ✅ Expected: "Finished supabase secrets set"

- [ ] **1.7 Verify Database Migrations**
  ```bash
  npx supabase db push
  ```
  ✅ Expected: "Migrations applied" or "Already up to date"

- [ ] **1.8 Deploy Edge Functions**
  ```bash
  npx supabase functions deploy generate-blog
  npx supabase functions deploy seo-analysis
  npx supabase functions deploy generate-content-plan
  npx supabase functions deploy publish-to-wordpress
  ```
  ✅ Expected: "Deployed function XXX" for each

- [ ] **1.9 Test Core Features Locally**
  
  **Test 1: User Registration**
  - Go to: http://localhost:5173/auth
  - Create account with email
  - ✅ Should redirect to profile/dashboard
  
  **Test 2: Blog Generation**
  - Navigate to "Today's Blog" or Create Post
  - Enter topic: "SEO Best Practices 2026"
  - Keywords: "SEO, content marketing, ranking"
  - Click "Generate"
  - ✅ Should generate 1200+ word blog post
  - ✅ Should include FAQ section
  
  **Test 3: Content Calendar**
  - Go to Content Plan page
  - Generate 30-day plan
  - ✅ Should show calendar with blog topics
  
  **Test 4: SEO Analysis**
  - Go to SEO Analysis page
  - Enter niche + keywords
  - ✅ Should analyze competitors
  - ✅ Should show keyword difficulty

---

### ✅ PHASE 2: Google OAuth Setup (20 mins) - OPTIONAL

- [ ] **2.1 Create Google OAuth Credentials**
  - Follow: [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md)
  - Go to: https://console.cloud.google.com/
  - Create OAuth 2.0 Client ID
  - Add redirect URIs:
    ```
    https://envewfudiyxmnuefbdow.supabase.co/auth/v1/callback
    http://localhost:5173
    ```

- [ ] **2.2 Configure in Supabase**
  - Go to: https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/auth/providers
  - Enable Google provider
  - Paste Client ID and Secret
  - Save

- [ ] **2.3 Test Google Login**
  - Go to /auth page
  - Click "Continue with Google"
  - ✅ Should login successfully

---

### ✅ PHASE 3: Production Deployment (30 mins)

- [ ] **3.1 Push Code to GitHub**
  ```bash
  git status
  git add .
  git commit -m "Ready for production deployment"
  git push origin main
  ```

- [ ] **3.2 Deploy to Vercel**
  
  **Option A: Via Vercel Dashboard (Easier)**
  1. Go to: https://vercel.com/new
  2. Import repository: `chetratech98/buddy`
  3. Configure:
     - Framework: Vite
     - Build Command: `npm run build`
     - Output Directory: `dist`
  4. Add environment variables:
     ```
     VITE_SUPABASE_URL=https://envewfudiyxmnuefbdow.supabase.co
     VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci... (from .env file)
     ```
  5. Click "Deploy"
  
  **Option B: Via CLI**
  ```bash
  npm install -g vercel
  vercel
  ```

- [ ] **3.3 Update Google OAuth for Production**
  - Add production domain to Google Console:
    ```
    https://your-app.vercel.app
    https://your-app.vercel.app/auth/callback
    ```

- [ ] **3.4 Test Production Deployment**
  - Visit your Vercel URL
  - Test signup/login
  - Generate a blog post
  - ✅ All features should work

---

### ✅ PHASE 4: WordPress Integration (15 mins) - OPTIONAL

- [ ] **4.1 Set Up WordPress Site**
  - Need a WordPress site with admin access
  - Install "Application Passwords" plugin
  - Or use WordPress.com REST API

- [ ] **4.2 Configure in App**
  - Go to Profile → WordPress Settings
  - Enter:
    - WordPress URL
    - Username
    - Application Password
  - Click "Save Settings"

- [ ] **4.3 Test Publishing**
  - Generate a blog post
  - Click "Publish to WordPress"
  - ✅ Should appear in WordPress dashboard

---

### ✅ PHASE 5: Final Production Checklist

- [ ] **5.1 Security Review**
  - [ ] RLS policies enabled in Supabase
  - [ ] API keys not exposed in frontend
  - [ ] CORS configured correctly
  - [ ] Rate limiting enabled

- [ ] **5.2 Performance**
  - [ ] Lighthouse score > 90
  - [ ] Images optimized
  - [ ] Bundle size reasonable (<500KB)
  - [ ] Edge functions respond < 5 seconds

- [ ] **5.3 Monitoring Setup**
  - [ ] Vercel analytics enabled
  - [ ] Supabase logging checked
  - [ ] Error tracking setup (optional: Sentry)

- [ ] **5.4 User Onboarding**
  - [ ] Test full user journey
  - [ ] Create demo account
  - [ ] Prepare support documentation

---

## 🎯 MINIMUM VIABLE LAUNCH

To go live with core features, you MUST complete:

**Required (Can't skip):**
- ✅ Phase 1.1-1.8 (Local setup + API keys + Edge functions)
- ✅ Phase 1.9 (Testing)
- ✅ Phase 3.1-3.4 (Deployment)

**Optional (Can do later):**
- ⭐ Phase 2 (Google OAuth - improves signup UX)
- ⭐ Phase 4 (WordPress - only if users need it)
- ⭐ Phase 5.2-5.4 (Nice to have)

---

## 📊 CURRENT GAPS SUMMARY

| Feature | Status | Action Needed |
|---------|--------|---------------|
| Core Code | ✅ Complete | None |
| Database Schema | ✅ Complete | Verify migrations applied |
| UI/UX | ✅ Complete | None |
| .env File | ✅ Exists | Already configured |
| OpenAI API | ❌ Missing | Get key + set in Supabase |
| Firecrawl API | ❌ Missing | Get key + set in Supabase |
| Edge Functions | ⚠️ Not deployed | Deploy via Supabase CLI |
| Google OAuth | ❌ Not configured | Optional - follow guide |
| Production Deploy | ❌ Not done | Deploy to Vercel |
| WordPress Setup | ❌ Not done | Optional - user configures |

---

## 🚀 FASTEST PATH TO LAUNCH (1 hour)

If you need to go live TODAY, do this minimal setup:

```bash
# 1. Install dependencies (2 mins)
npm install

# 2. Get OpenAI key (5 mins)
# → https://platform.openai.com/api-keys
# → Set spending limit to $10

# 3. Link Supabase + set keys (5 mins)
npx supabase login
npx supabase link --project-ref envewfudiyxmnuefbdow
npx supabase secrets set OPENAI_API_KEY="sk-proj-YOUR-KEY"

# 4. Deploy edge functions (5 mins)
npx supabase functions deploy generate-blog
npx supabase functions deploy generate-content-plan

# 5. Test locally (10 mins)
npm run dev
# → Visit localhost:5173
# → Create account
# → Generate test blog

# 6. Deploy to Vercel (10 mins)
git push origin main
# → Go to vercel.com
# → Import GitHub repo
# → Add env variables
# → Deploy

# 7. Test production (5 mins)
# → Visit your Vercel URL
# → Test core features

# DONE! 🎉
```

---

## 🐛 COMMON ISSUES & SOLUTIONS

### Issue: "Supabase URL is undefined"
**Solution:** Check `.env` file exists and has correct values

### Issue: "OpenAI API key not found"
**Solution:** 
```bash
npx supabase secrets set OPENAI_API_KEY="sk-proj-YOUR-KEY"
```

### Issue: "Edge function not found"
**Solution:**
```bash
npx supabase functions deploy generate-blog --no-verify-jwt
```

### Issue: "Database migration failed"
**Solution:**
```bash
npx supabase db reset
npx supabase db push
```

### Issue: "Google login doesn't work"
**Solution:** Check redirect URIs match exactly in Google Console

---

## 📞 NEED HELP?

**Documentation:**
- [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md) - Detailed setup
- [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) - OAuth guide
- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) - Deploy guide
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Full checklist

**Supabase Resources:**
- Dashboard: https://supabase.com/dashboard/project/envewfudiyxmnuefbdow
- Auth: https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/auth/users
- Functions: https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/functions

**Your Repository:**
- GitHub: https://github.com/chetratech98/buddy

---

## ✨ NEXT STEPS AFTER LAUNCH

Once live, consider:

1. **Add Analytics** - Track user behavior
2. **Set up Monitoring** - Uptime alerts
3. **Create Documentation** - User guides
4. **Plan Marketing** - See MARKET_STRATEGY.md
5. **Gather Feedback** - From first users
6. **Iterate Features** - Based on data

---

**Your app is almost ready! Just need API keys and deployment. Let's launch! 🚀**
