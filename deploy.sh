#!/bin/bash
# ============================================================
# BlitzNova AI — One-Time Setup & Deploy Script
# Run this once to deploy all edge functions + set secrets
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
# ============================================================

set -e

PROJECT_REF="envewfudiyxmnuefbdow"

echo "🔗 Linking to Supabase project $PROJECT_REF..."
npx supabase link --project-ref "$PROJECT_REF"

echo ""
echo "🔑 Setting secrets..."
echo "   (You will be prompted for each key if not set)"

# ── REQUIRED: OpenAI ─────────────────────────────────────────────────────────
# Get from: https://platform.openai.com/api-keys
read -p "Enter your OPENAI_API_KEY (sk-...): " OPENAI_KEY
npx supabase secrets set OPENAI_API_KEY="$OPENAI_KEY"

# ── REQUIRED: SerpApi ────────────────────────────────────────────────────────
# Already provided — hardcoded below (change if needed)
SERP_KEY="bb97db36eacb2b5529a4a54521bd6567417945faa8901409a231a6be4b4b1179"
npx supabase secrets set SERP_API_KEY="$SERP_KEY"
echo "   ✅ SERP_API_KEY set"

# ── OPTIONAL: Firecrawl (for SEO competitor scraping) ────────────────────────
read -p "Enter FIRECRAWL_API_KEY (or press Enter to skip): " FIRECRAWL_KEY
if [ -n "$FIRECRAWL_KEY" ]; then
  npx supabase secrets set FIRECRAWL_API_KEY="$FIRECRAWL_KEY"
fi

echo ""
echo "📦 Deploying all edge functions..."

FUNCTIONS=(
  "generate-content-plan"
  "generate-blog"
  "seo-analysis"
  "rank-tracker"
  "check-duplicate"
  "content-gap"
  "scheduled-publisher"
  "analyze-site"
)

for fn in "${FUNCTIONS[@]}"; do
  echo "   → Deploying $fn..."
  npx supabase functions deploy "$fn" --no-verify-jwt 2>/dev/null || \
  npx supabase functions deploy "$fn" && echo "   ✅ $fn deployed"
done

echo ""
echo "✅ All done!"
echo ""
echo "Next steps:"
echo "  1. Add these env vars to Vercel dashboard (vercel.com/dashboard):"
echo "     VITE_SUPABASE_URL=https://envewfudiyxmnuefbdow.supabase.co"
echo "     VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
echo ""
echo "  2. Redeploy on Vercel:"
echo "     npx vercel --prod"
echo ""
echo "  3. Test: go to Content Plan page → click Generate Plan"
echo "     You should see 'SERP: X keywords researched' in the browser console"
