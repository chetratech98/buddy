# 🔐 Google OAuth Setup Guide

Your app already has Google login implemented! Just needs configuration.

---

## 📋 Step-by-Step Setup

### **Step 1: Create Google OAuth Credentials**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **Credentials**
4. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
5. Configure OAuth consent screen if prompted:
   - User Type: **External**
   - App name: **BlitzNova AI**
   - User support email: Your email
   - Developer contact: Your email
   - Click **Save and Continue**

6. Create OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Name: **BlitzNova Auth**
   - Authorized JavaScript origins:
     ```
     http://localhost:8080
     https://envewfudiyxmnuefbdow.supabase.co
     https://your-domain.com
     ```
   - Authorized redirect URIs:
     ```
     https://envewfudiyxmnuefbdow.supabase.co/auth/v1/callback
     http://localhost:8080
     https://your-domain.com/auth/callback
     ```
   - Click **Create**

7. **Copy Your Credentials:**
   - Client ID (looks like: `123456789-abc.apps.googleusercontent.com`)
   - Client Secret (looks like: `GOCSPX-abc123xyz`)

---

### **Step 2: Configure Supabase**

1. Go to your Supabase project: [Auth Providers](https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/auth/providers)

2. Find **Google** in the providers list

3. Click **Enable** or **Configure**

4. Enter your credentials:
   - **Client ID**: Paste your Google Client ID here
   - **Client Secret**: Paste your Google Client Secret here
   - **Authorized Client IDs**: (optional)

5. Verify the **Callback URL** from Supabase matches:
   ```
   https://envewfudiyxmnuefbdow.supabase.co/auth/v1/callback
   ```

6. Make sure this matches in Google Console redirect URIs

7. Click **Save**

---

### **Step 3: Test Google Login**

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Go to: `http://localhost:8080/auth`

3. Click **"Continue with Google"**

4. Select your Google account

5. Grant permissions

6. You should be redirected back and logged in! ✅

---

## 🎯 Quick Checklist

- [ ] Create Google Cloud Project
- [ ] Enable OAuth consent screen
- [ ] Create OAuth 2.0 Client ID
- [ ] Copy Client ID and Secret
- [ ] Enable Google provider in Supabase
- [ ] Paste credentials in Supabase
- [ ] Add redirect URIs (both in Google & Supabase)
- [ ] Test login flow
- [ ] Verify user appears in Supabase Auth

---

## 🔗 Important URLs

### Google Cloud Console:
- Main: https://console.cloud.google.com/
- Credentials: https://console.cloud.google.com/apis/credentials
- OAuth Consent: https://console.cloud.google.com/apis/credentials/consent

### Supabase:
- Auth Providers: https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/auth/providers
- Users: https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/auth/users

---

## 🖼️ What Your Users Will See

```
┌─────────────────────────────────────┐
│      🌟 BlitzNova AI               │
│                                     │
│       Welcome back                  │
│   Sign in to your dashboard         │
│                                     │
│   ┌───────────────────────────┐    │
│   │  [G] Continue with Google │ ← Click here!
│   └───────────────────────────┘    │
│                                     │
│   ──── or continue with email ────  │
│                                     │
│   📧 Email address                  │
│   🔒 Password                       │
└─────────────────────────────────────┘
```

After clicking:
1. Google login popup appears
2. User selects account
3. Grants permissions
4. Redirected back to app (logged in)
5. Profile created automatically in database

---

## 🎨 Code Already Implemented

Your [Auth.tsx](src/pages/Auth.tsx) already has:

```tsx
{/* Google Sign In */}
<button
  type="button"
  onClick={async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ 
        title: "Google sign in failed", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  }}
  className="w-full flex items-center justify-center gap-3..."
>
  {/* Google Logo SVG */}
  Continue with Google
</button>
```

✅ **No code changes needed!** Just configuration.

---

## 🐛 Troubleshooting

### Error: "redirect_uri_mismatch"
- ✅ Check redirect URIs match exactly in both Google Console and Supabase
- ✅ Include both `http://localhost:8080` and your production domain
- ✅ Must include Supabase callback URL: `https://envewfudiyxmnuefbdow.supabase.co/auth/v1/callback`

### Error: "OAuth client not found"
- ✅ Verify Client ID is correct in Supabase
- ✅ Client ID should end with `.apps.googleusercontent.com`

### User not created in database
- ✅ Check `handle_new_user()` trigger exists in Supabase (from DATABASE_SETUP.sql)
- ✅ Verify profiles table exists
- ✅ Check RLS policies allow profile creation

### Google popup doesn't appear
- ✅ Check browser pop-up blocker
- ✅ Verify Supabase URL in `.env` is correct
- ✅ Test in incognito mode

---

## 🚀 Production Deployment

When deploying to production:

1. **Add production domain to Google Console:**
   ```
   https://your-domain.com
   https://your-domain.com/auth/callback
   ```

2. **Update Supabase redirect URLs:**
   - Add production domain
   - Keep localhost for development

3. **Update environment variables:**
   - Set production Supabase URL
   - Set production domain in redirect URIs

---

## ✨ Benefits of Google Login

- 🚀 **Faster signup** - Users skip email verification
- 🔒 **More secure** - No password to remember/manage
- 📈 **Higher conversion** - Reduces signup friction
- 👤 **Auto profile** - Gets name and avatar from Google
- ✅ **Verified emails** - Google emails are pre-verified

---

## 📊 Expected Flow

```
User clicks "Continue with Google"
         ↓
Google login popup
         ↓
User grants permissions
         ↓
Redirected to Supabase callback
         ↓
Supabase creates auth.users entry
         ↓
Database trigger creates profiles entry
         ↓
User redirected back to app (logged in)
         ↓
Navigate to /profile or /dashboard
```

---

## 🎯 Next Steps

1. Follow Step 1: Create Google OAuth credentials
2. Follow Step 2: Configure in Supabase
3. Follow Step 3: Test the flow
4. Done! Your users can now sign in with Google 🎉

---

**Need help?** Check the Supabase docs:
- [Google OAuth Guide](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [OAuth Flow](https://supabase.com/docs/guides/auth/social-login)
