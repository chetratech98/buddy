#!/bin/bash

# ============================================
# Supabase Production Deployment Script
# ============================================
# This script deploys your database and edge functions to Supabase

set -e  # Exit on error

echo "🚀 Starting Supabase Production Deployment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Installing Supabase CLI..."
    npm install -g supabase
    echo -e "${GREEN}✅ Supabase CLI installed${NC}"
fi

# Check if already logged in
echo "Checking Supabase login status..."
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Supabase${NC}"
    echo "Please login to Supabase..."
    supabase login
    echo -e "${GREEN}✅ Logged in successfully${NC}"
else
    echo -e "${GREEN}✅ Already logged in${NC}"
fi

# Link to project if not already linked
echo ""
echo "Linking to Supabase project..."
supabase link --project-ref envewfudiyxmnuefbdow || {
    echo -e "${YELLOW}⚠️  Project already linked or failed to link${NC}"
}

# Push database migrations
echo ""
echo "📦 Deploying database migrations..."
supabase db push || {
    echo -e "${RED}❌ Failed to push database migrations${NC}"
    echo "Please check your migrations for errors"
    exit 1
}
echo -e "${GREEN}✅ Database migrations deployed${NC}"

# Deploy edge functions
echo ""
echo "⚡ Deploying edge functions..."

cd supabase/functions

echo "  Deploying generate-blog..."
supabase functions deploy generate-blog --no-verify-jwt || {
    echo -e "${RED}❌ Failed to deploy generate-blog${NC}"
}

echo "  Deploying generate-content-plan..."
supabase functions deploy generate-content-plan --no-verify-jwt || {
    echo -e "${RED}❌ Failed to deploy generate-content-plan${NC}"
}

echo "  Deploying seo-analysis..."
supabase functions deploy seo-analysis --no-verify-jwt || {
    echo -e "${RED}❌ Failed to deploy seo-analysis${NC}"
}

echo "  Deploying publish-to-wordpress..."
supabase functions deploy publish-to-wordpress --no-verify-jwt || {
    echo -e "${RED}❌ Failed to deploy publish-to-wordpress${NC}"
}

cd ../..

echo ""
echo -e "${GREEN}✅ Edge functions deployed${NC}"

# Reminder about secrets
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}⚠️  IMPORTANT: Set Edge Function Secrets${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Go to: https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/settings/functions"
echo ""
echo "Add these secrets:"
echo "  1. OPENAI_API_KEY (required) - Get from: https://platform.openai.com/api-keys"
echo "  2. SERP_API_KEY (optional) - Get from: https://serpapi.com/manage-api-key"
echo ""
echo "After adding secrets, redeploy functions:"
echo "  supabase functions deploy generate-blog --no-verify-jwt"
echo "  supabase functions deploy generate-content-plan --no-verify-jwt"
echo "  supabase functions deploy seo-analysis --no-verify-jwt"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Reminder about demo account
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}📝 Optional: Create Demo Account${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Create demo user:"
echo "   https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/auth/users"
echo "   Email: demo@blitznova.ai"
echo "   Password: demo123456"
echo ""
echo "2. Run SETUP_DEMO_ACCOUNT.sql in SQL Editor:"
echo "   https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/sql/new"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Set OPENAI_API_KEY in Supabase dashboard (required)"
echo "  2. Create demo user (optional)"
echo "  3. Test your app: https://buddy-ruddy-omega.vercel.app"
echo ""
