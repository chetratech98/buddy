# 🎭 Demo Account Setup Guide

**Quick Setup:** Create a demo account to test and develop all features

---

## 🚀 Quick Setup (5 minutes)

### **Step 1: Create Demo User in Supabase (2 mins)**

1. Go to your Supabase Dashboard:
   ```
   https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/auth/users
   ```

2. Click **"Invite User"** or **"Add User"**

3. Enter demo credentials:
   ```
   Email: demo@blitznova.ai
   Password: demo123456
   ```

4. **IMPORTANT:** Uncheck "Send email confirmation" (or confirm the email manually)

5. Click **Create User**

---

### **Step 2: Run SQL Setup Script (2 mins)**

1. Go to SQL Editor:
   ```
   https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/sql
   ```

2. Create a new query

3. Copy and paste the entire contents of `SETUP_DEMO_ACCOUNT.sql`

4. Click **Run** (or press Ctrl/Cmd + Enter)

5. Check the results - you should see:
   ```
   ✅ Blog Posts: 1
   ✅ Content Plans: 1  
   ✅ SEO Analyses: 1
   ```

---

### **Step 3: Test Demo Login (1 min)**

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Go to: http://localhost:5173/auth

3. You should see:
   - Sign In / Sign Up form
   - **"Try Demo Account"** button (new!)
   - Google sign in option
   - Demo credentials info box

4. Click **"Try Demo Account"**

5. You should be redirected to dashboard with sample data! ✅

---

## 🎨 What's New in Auth Page

### **1. Demo Login Button**
- **Gradient purple button** with sparkle icon
- One-click login to demo account
- Pre-filled credentials

### **2. Google OAuth**
- **"Continue with Google"** button
- Colorful Google logo
- One-click social login

### **3. Demo Credentials Info**
- Info box showing demo is available
- Visible only on login page
- Purple accent styling

### **4. Enhanced Design**
- Better spacing and layout
- Clear visual hierarchy
- Smooth transitions

---

## 📊 Demo Account Features

The demo account includes:

### **✅ Sample Blog Post**
- Title: "The Complete Guide to AI Content Creation in 2026"
- Full markdown content (1200+ words)
- Keywords and SEO optimization
- Published status

### **✅ Sample Content Plan**
- 30-day content calendar
- 5 pre-planned blog topics
- Keywords for each topic
- Professional tone

### **✅ Sample SEO Analysis**
- Top 3 competitors analysis
- Keyword difficulty ratings
- Content recommendations
- Created 1 day ago

### **✅ Premium Account**
- Subscription tier: Premium
- Status: Active
- All features unlocked

---

## 🔐 Demo Credentials

**For Development/Testing:**
```
Email: demo@blitznova.ai
Password: demo123456
```

**For Production (Recommended):**
- Change password to something more secure
- Or disable demo login in production
- Add environment variable to toggle demo mode

---

## 🧪 Testing Checklist

After setup, test these flows:

### **Sign Up (New User)**
- [ ] Click "Sign up"
- [ ] Enter email, password, name
- [ ] Submit form
- [ ] Check for email verification message
- [ ] Verify email works

### **Sign In (Existing User)**
- [ ] Enter credentials
- [ ] Click "Sign In"
- [ ] Redirected to home/dashboard
- [ ] Profile loaded correctly

### **Demo Login**
- [ ] Click "Try Demo Account"
- [ ] Auto-login happens
- [ ] Redirected to dashboard
- [ ] Sample data visible

### **Google OAuth**
- [ ] Click "Continue with Google"
- [ ] Google popup appears
- [ ] Select account
- [ ] Redirected back and logged in
- [ ] Profile created automatically

---

## 🎯 Development Workflow

### **When Developing Features:**

1. **Use Demo Account** for quick testing
   ```
   → No need to sign up each time
   → Pre-populated data to work with
   → Faster iteration
   ```

2. **Test with Real Account** before deploying
   ```
   → Create fresh account
   → Test full user journey
   → Verify email flows work
   ```

3. **Test Google OAuth** if needed
   ```
   → Complete Google OAuth setup (see GOOGLE_OAUTH_SETUP.md)
   → Test social login flow
   ```

---

## 🔧 Customizing Demo Account

Want to add more sample data? Edit `SETUP_DEMO_ACCOUNT.sql`:

### **Add More Blog Posts:**
```sql
INSERT INTO blog_posts (user_id, title, content, ...)
SELECT 
  auth.uid(),
  'Your Blog Title',
  'Your content here',
  ...
FROM auth.users
WHERE email = 'demo@blitznova.ai';
```

### **Add More Content Plans:**
```sql
INSERT INTO content_plans (user_id, niche, keywords, items, ...)
-- Add your data
```

### **Change Demo Credentials:**
Update in 2 places:
1. `src/pages/Auth.tsx` - Change `demoEmail` and `demoPassword`
2. Create new user in Supabase with new credentials

---

## 🚫 Disabling Demo in Production

Want to disable demo for production? Add environment check:

```tsx
// In Auth.tsx
const isDemoEnabled = import.meta.env.DEV || 
  import.meta.env.VITE_ENABLE_DEMO === 'true';

// Then conditionally render:
{isDemoEnabled && isLogin && (
  <button onClick={handleDemoLogin}>
    Try Demo Account
  </button>
)}
```

Set in Vercel: `VITE_ENABLE_DEMO=false` for production

---

## ❗ Troubleshooting

### **Demo login fails:**
- Check demo user exists in Supabase Auth
- Verify email is confirmed
- Check password matches exactly

### **No sample data visible:**
- Run the SQL script again
- Check user_id matches in database
- Verify RLS policies allow access

### **Google OAuth not working:**
- Complete setup in GOOGLE_OAUTH_SETUP.md
- Add redirect URIs in Google Console
- Enable Google provider in Supabase

---

## 📈 Next Steps

Once demo is working:

1. **Test all features** with demo account
2. **Develop new features** using demo data
3. **Set up Google OAuth** (optional)
4. **Deploy to production** when ready
5. **Consider disabling demo** in production

---

## ✅ Summary

You now have:
- ✅ Sign Up functionality
- ✅ Sign In functionality  
- ✅ Demo account with one-click login
- ✅ Google OAuth option
- ✅ Sample data for testing
- ✅ Better auth page design

**Demo Credentials:** `demo@blitznova.ai` / `demo123456`

**Start developing with:** `npm run dev` 🚀

---

**Questions?** Check:
- [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) - For Google login
- [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md) - General setup
- [WHAT_TO_DO_NOW.md](./WHAT_TO_DO_NOW.md) - Go-live guide
