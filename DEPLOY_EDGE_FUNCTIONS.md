# Deploy Edge Functions to Supabase

## 🎯 What Changed

**Content Intelligence Integration** - The content plan generation now automatically fetches AI-powered insights before creating the plan.

### Updated Edge Functions
1. **generate-content-plan** - Now accepts and uses `contentIntelligence` data
2. **content-intelligence** - Already deployed (no changes needed)

---

## 🚀 Deployment Steps

### Option 1: Using Supabase Dashboard (Recommended)

1. **Login to Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to Edge Functions**
   - Click "Edge Functions" in the left sidebar
   - Find `generate-content-plan` function

3. **Deploy Updated Function**
   - Click "Deploy new version"
   - Copy the contents of `supabase/functions/generate-content-plan/index.ts`
   - Paste into the editor
   - Click "Deploy"

### Option 2: Using Supabase CLI

```bash
# Make sure you're logged in
npx supabase login

# Link your project (if not already linked)
npx supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
npx supabase functions deploy generate-content-plan
```

---

## 🔧 Required Environment Variables

Make sure these are set in your Supabase project:

1. **OPENAI_API_KEY** - For AI generation (required)
2. **SERP_API_KEY** - For SERP analysis (optional)

To set them:
1. Go to Project Settings > Edge Functions
2. Add/update environment variables
3. Restart functions if needed

---

## ✅ Testing After Deployment

### Test Content Plan Generation with Intelligence

1. **Open Content Plan Page** (`/content-plan`)
2. **Enter your niche** (e.g., "Medical Accreditation")
3. **Add keywords** (e.g., "medical certification")
4. **Click "Generate Plan"**

### Expected Behavior

**Before (without intelligence):**
```
Generating... 90%
✅ Real content plan ready!
30 posts from live Google data (openai_only).
```

**After (with intelligence):**
```
Generating... 10% (Fetching AI insights)
Generating... 30% (Analyzing SERP data)
Generating... 50% (Creating content plan)
Generating... 100%
✅ Real content plan ready!
30 posts from live Google data (content_intelligence + openai).
```

### What Intelligence Provides

1. **Search Intent** - Primary intent and confidence
2. **Content Structure** - Recommended outline with 8-10 sections
3. **FAQ Questions** - AI-generated answers from PAA
4. **Semantic Entities** - Required and recommended keywords
5. **Competitor Headings** - Common patterns from top 10
6. **Content Gaps** - Missing topics to cover
7. **Benchmarks** - Target word count and H2 count

---

## 🔍 Verification Checklist

After deployment, verify:

- [ ] Content plan generates successfully
- [ ] Progress bar shows "10%" at start (intelligence fetch)
- [ ] Toast message shows "content_intelligence + openai" as data source
- [ ] Generated plan includes FAQ-based topics
- [ ] Long-tail keywords are populated automatically
- [ ] No error messages in browser console
- [ ] Supabase logs show no errors

### Check Supabase Logs

1. Go to Logs > Edge Functions
2. Filter for `generate-content-plan`
3. Look for:
   ```
   [content-plan] Using content intelligence insights
   [content-plan] ✅ Generated 30 items. With content intelligence.
   ```

---

## 🐛 Troubleshooting

### Issue: "content-intelligence" not found (404)

**Cause:** First edge function not deployed  
**Solution:** Deploy content-intelligence first:
```bash
npx supabase functions deploy content-intelligence
```

### Issue: OpenAI API key error

**Cause:** Missing OPENAI_API_KEY environment variable  
**Solution:** 
1. Go to Project Settings > Edge Functions
2. Add OPENAI_API_KEY with your API key
3. Redeploy function

### Issue: Progress stuck at 10%

**Cause:** Content intelligence fetch failing  
**Solution:** Check browser console and Supabase logs for errors

### Issue: Plan still shows "openai_only" data source

**Cause:** Content intelligence not being passed  
**Solution:** 
1. Clear browser cache
2. Hard refresh (Cmd+Shift+R)
3. Try generating plan again

---

## 📊 What You'll See

### In Content Plan Page

**Progress Stages:**
1. **0-10%** - Fetching content intelligence
2. **10-30%** - Analyzing SERP data (if available)
3. **30-50%** - Calling OpenAI
4. **50-100%** - Processing and validating plan

**Success Toast:**
```
✅ Real content plan ready!
30 posts from live Google data (content_intelligence + openai).
```

**Plan Quality Improvements:**
- ✅ Topics based on FAQ questions
- ✅ Long-tail keywords from entities
- ✅ Content structure matches competitors
- ✅ Covers identified content gaps
- ✅ Follows recommended outline

---

## 🎉 Success Indicators

1. **Intelligence Fetch**
   - Progress bar reaches 10% quickly
   - No error messages

2. **Plan Generation**
   - Toast shows "content_intelligence + openai"
   - Plan has 30 unique items
   - Long-tail keywords are diverse

3. **Content Quality**
   - Titles match FAQ questions
   - Topics align with niche
   - Descriptions mention unique angles

---

## 📝 Notes

- **Fallback Behavior:** If content intelligence fetch fails, plan still generates using SERP data or niche/keywords only
- **Performance:** Adds 3-5 seconds to plan generation (intelligence fetch)
- **Cost:** ~$0.01 per content plan generation (OpenAI API usage)
- **Cache:** Intelligence data is cached in component state

---

## 🔗 Related Documentation

- [CONTENT_INTELLIGENCE_SYSTEM.md](./CONTENT_INTELLIGENCE_SYSTEM.md) - Full system overview
- [PRODUCTION_VALIDATION.md](./PRODUCTION_VALIDATION.md) - Production readiness checklist
- [test-content-intelligence.sh](./test-content-intelligence.sh) - Testing script

---

**Deployment Status:** Ready ✅  
**Last Updated:** May 15, 2026  
**Version:** 1.1.0
