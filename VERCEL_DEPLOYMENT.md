# 🚀 Vercel Deployment Guide

**Your Supabase is configured! Now deploy to Vercel.**

---

## 📋 Environment Variables for Vercel

Add these **EXACTLY** in your Vercel project settings:

### **Go to:** https://vercel.com/your-project/settings/environment-variables

---

## ✅ Required Variables (Frontend)

### **1. VITE_SUPABASE_URL**
```
https://envewfudiyxmnuefbdow.supabase.co
```
- **Environment:** Production, Preview, Development
- **Purpose:** Supabase project URL

---

### **2. VITE_SUPABASE_PUBLISHABLE_KEY** (Anon Key)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudmV3ZnVkaXl4bW51ZWZiZG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDcxOTUsImV4cCI6MjA5MDYyMzE5NX0.pXAjgEPX-ql2OSJ6U7qxrINfUCj_K3jMAjIlqhyjcIs
```
- **Environment:** Production, Preview, Development
- **Purpose:** Public Supabase anon key (safe to expose)

---

## 🔐 Edge Function Secrets (Supabase - NOT Vercel)

These go in **Supabase CLI**, not Vercel:

### **Set these via terminal:**

```bash
# Login to Supabase
npx supabase login

# Link your project
npx supabase link --project-ref envewfudiyxmnuefbdow

# Set Service Role Key (CRITICAL for Edge Functions)
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# Set OpenAI API key
npx supabase secrets set OPENAI_API_KEY="your-openai-api-key-here"

# Set Firecrawl/SERP API key
npx supabase secrets set FIRECRAWL_API_KEY="your-firecrawl-api-key-here"
```

**Why NOT in Vercel?**
- These run on Supabase Edge Functions (serverless)
- Vercel only hosts your frontend
- Supabase manages the backend secrets

---

## 📊 Summary Table

| Variable | Where to Add | Value |
|----------|--------------|-------|
| `VITE_SUPABASE_URL` | ✅ Vercel | `https://envewfudiyxmnuefbdow.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ Vercel | `eyJhbGci...` (anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Supabase CLI | `sbp_03012bd4...` |
| `OPENAI_API_KEY` | ⚠️ Supabase CLI | `sk-proj-2Zgbp...` |
| `FIRECRAWL_API_KEY` | ⚠️ Supabase CLI | `bb97db36...` |
| Database Password | ❌ Never expose | Only for direct DB access |
| JWT Secret | ❌ Never expose | Supabase internal use only |

---

## 🎯 Step-by-Step Vercel Setup

### **Step 1: Push to GitHub** (Already done ✅)
```bash
git add .
git commit -m "Add Supabase configuration"
git push origin main
```

### **Step 2: Import to Vercel**

1. Go to: https://vercel.com/new
2. Click "Import Git Repository"
3. Select your repo: `chetratech98/buddy`
4. Click "Import"

### **Step 3: Add Environment Variables**

Before deploying, click **"Environment Variables"** and add:

**Variable 1:**
```
Name:  VITE_SUPABASE_URL
Value: https://envewfudiyxmnuefbdow.supabase.co
```
Check: ☑️ Production ☑️ Preview ☑️ Development

**Variable 2:**
```
Name:  VITE_SUPABASE_PUBLISHABLE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudmV3ZnVkaXl4bW51ZWZiZG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDcxOTUsImV4cCI6MjA5MDYyMzE5NX0.pXAjgEPX-ql2OSJ6U7qxrINfUCj_K3jMAjIlqhyjcIs
```
Check: ☑️ Production ☑️ Preview ☑️ Development

### **Step 4: Deploy**

Click **"Deploy"** button and wait ~2 minutes.

---

## 🔐 Set Supabase Secrets (IMPORTANT!)

After Vercel deployment, run these commands:

```bash
# Make sure you're in project directory
cd c:\Users\hp\Downloads\buddy-main\buddy-main

# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref envewfudiyxmnuefbdow

# Set Service Role Key (for Edge Functions admin access)
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# Set OpenAI key (for blog generation)
npx supabase secrets set OPENAI_API_KEY="your-openai-api-key-here"

# Set SERP/Firecrawl key (for SEO analysis)
npx supabase secrets set FIRECRAWL_API_KEY="your-firecrawl-api-key-here"

# Verify secrets are set
npx supabase secrets list
```

**Expected output:**
```
SUPABASE_SERVICE_ROLE_KEY: sbp_03012... (masked)
OPENAI_API_KEY: sk-proj-2Zgbp... (masked)
FIRECRAWL_API_KEY: bb97db... (masked)
```

---

## ✅ Apply Database Migrations

Your Supabase needs the database schema:

```bash
# Push all migrations to Supabase
npx supabase db push
```

**Or if that fails:**
```bash
# Pull remote schema
npx supabase db pull

# Then push local migrations
npx supabase db remote commit
```

---

## 🧪 Test Your Deployment

### **1. Test Locally First:**

```bash
# Start dev server
npm run dev

# Open: http://localhost:5173/auth
# Try signing up with email/password
```

### **2. Test on Vercel:**

After deployment completes:

```
https://your-project.vercel.app/auth
```

**Test Flow:**
1. Click "Create Account"
2. Enter email/password
3. Check email for verification
4. Click verification link
5. Sign in
6. Generate a blog post at `/todays-blog`

---

## 🐛 Common Issues & Fixes

### Issue 1: "Invalid API key" error

**Fix:**
```bash
# Verify .env has correct values
cat .env

# Should show:
# VITE_SUPABASE_URL=https://envewfudiyxmnuefbdow.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
```

### Issue 2: Blog generation fails

**Fix:**
```bash
# Check OpenAI key is set in Supabase
npx supabase secrets list

# If missing, set it:
npx supabase secrets set OPENAI_API_KEY="sk-proj-2Zgbp..."
```

### Issue 3: Can't sign up

**Fix:**
1. Go to Supabase dashboard
2. Authentication → Providers
3. Enable "Email" provider
4. Save changes

### Issue 4: Database errors

**Fix:**
```bash
# Apply migrations
npx supabase db push

# Or reset database (warning: deletes data)
npx supabase db reset
```

---

## 📋 Final Checklist

### Local Development:
- [x] `.env` file updated with new Supabase credentials
- [ ] `npm install` completed
- [ ] Server running at `localhost:5173`
- [ ] Can access login page
- [ ] Can sign up/sign in

### Supabase Configuration:
- [ ] Project linked: `npx supabase link --project-ref envewfudiyxmnuefbdow`
- [ ] OpenAI key set: `npx supabase secrets set OPENAI_API_KEY="..."`
- [ ] Firecrawl key set: `npx supabase secrets set FIRECRAWL_API_KEY="..."`
- [ ] Migrations applied: `npx supabase db push`
- [ ] Email auth enabled in dashboard

### Vercel Deployment:
- [ ] Repository pushed to GitHub
- [ ] Project imported to Vercel
- [ ] `VITE_SUPABASE_URL` added
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` added
- [ ] Deployment successful
- [ ] Site accessible at `your-project.vercel.app`

### Testing:
- [ ] Local signup works
- [ ] Local login works
- [ ] Blog generation works locally
- [ ] Production signup works
- [ ] Production login works
- [ ] Blog generation works in production

---

## 🎉 Quick Deploy Now

Run these commands in order:

```bash
# 1. Link Supabase
npx supabase login
npx supabase link --project-ref envewfudiyxmnuefbdow

# 2. Set secrets
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
npx supabase secrets set OPENAI_API_KEY="your-openai-api-key-here"
npx supabase secrets set FIRECRAWL_API_KEY="your-firecrawl-api-key-here"

# 3. Apply migrations
npx supabase db push

# 4. Test locally
npm run dev

# 5. Commit and push
git add .
git commit -m "Configure Supabase credentials"
git push origin main

# 6. Deploy to Vercel (via dashboard)
# Go to: https://vercel.com/new
# Import: chetratech98/buddy
# Add environment variables (see above)
# Click Deploy
```

---

## 🔒 Security Notes

**✅ Safe to Expose (in Vercel & GitHub):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key)

**❌ NEVER Expose (keep in Supabase only):**
- Database password (`64klzlsgy6W44uFY`)
- JWT secret token (`Y3G2YsNz...`)
- Service role key
- OpenAI API key
- SERP API key

**Your `.env` file is in `.gitignore`** ✅ - Safe!

---

## 📞 Need Help?

**Supabase Dashboard:**
https://supabase.com/dashboard/project/envewfudiyxmnuefbdow

**Vercel Dashboard:**
https://vercel.com/dashboard

**Test Your API Keys:**
- OpenAI: https://platform.openai.com/playground
- Supabase: https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/api

---

**Status:** Environment configured ✅  
**Next:** Deploy to Vercel following steps above 🚀
