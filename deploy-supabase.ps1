# ============================================
# Supabase Production Deployment Script (Windows)
# ============================================
# This script deploys your database and edge functions to Supabase

Write-Host "🚀 Starting Supabase Production Deployment..." -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
$supabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCmd) {
    Write-Host "❌ Supabase CLI not found" -ForegroundColor Red
    Write-Host "Installing Supabase CLI..." -ForegroundColor Yellow
    npm install -g supabase
    Write-Host "✅ Supabase CLI installed" -ForegroundColor Green
}

# Check if already logged in
Write-Host "Checking Supabase login status..."
$loginCheck = supabase projects list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Not logged in to Supabase" -ForegroundColor Yellow
    Write-Host "Please login to Supabase..." -ForegroundColor Yellow
    supabase login
    Write-Host "✅ Logged in successfully" -ForegroundColor Green
} else {
    Write-Host "✅ Already logged in" -ForegroundColor Green
}

# Link to project if not already linked
Write-Host ""
Write-Host "Linking to Supabase project..." -ForegroundColor Cyan
supabase link --project-ref envewfudiyxmnuefbdow 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Project linked" -ForegroundColor Green
} else {
    Write-Host "⚠️  Project already linked or failed to link" -ForegroundColor Yellow
}

# Push database migrations
Write-Host ""
Write-Host "📦 Deploying database migrations..." -ForegroundColor Cyan
supabase db push
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push database migrations" -ForegroundColor Red
    Write-Host "Please check your migrations for errors" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Database migrations deployed" -ForegroundColor Green

# Deploy edge functions
Write-Host ""
Write-Host "⚡ Deploying edge functions..." -ForegroundColor Cyan

Push-Location supabase\functions

Write-Host "  Deploying generate-blog..." -ForegroundColor Gray
supabase functions deploy generate-blog --no-verify-jwt 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ generate-blog deployed" -ForegroundColor Green
} else {
    Write-Host "  ❌ Failed to deploy generate-blog" -ForegroundColor Red
}

Write-Host "  Deploying generate-content-plan..." -ForegroundColor Gray
supabase functions deploy generate-content-plan --no-verify-jwt 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ generate-content-plan deployed" -ForegroundColor Green
} else {
    Write-Host "  ❌ Failed to deploy generate-content-plan" -ForegroundColor Red
}

Write-Host "  Deploying seo-analysis..." -ForegroundColor Gray
supabase functions deploy seo-analysis --no-verify-jwt 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ seo-analysis deployed" -ForegroundColor Green
} else {
    Write-Host "  ❌ Failed to deploy seo-analysis" -ForegroundColor Red
}

Write-Host "  Deploying publish-to-wordpress..." -ForegroundColor Gray
supabase functions deploy publish-to-wordpress --no-verify-jwt 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ publish-to-wordpress deployed" -ForegroundColor Green
} else {
    Write-Host "  ❌ Failed to deploy publish-to-wordpress" -ForegroundColor Red
}

Pop-Location

Write-Host ""
Write-Host "✅ Edge functions deployed" -ForegroundColor Green

# Reminder about secrets
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "⚠️  IMPORTANT: Set Edge Function Secrets" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""
Write-Host "Go to: https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/settings/functions"
Write-Host ""
Write-Host "Add these secrets:"
Write-Host "  1. OPENAI_API_KEY (required) - Get from: https://platform.openai.com/api-keys" -ForegroundColor White
Write-Host "  2. SERP_API_KEY (optional) - Get from: https://serpapi.com/manage-api-key" -ForegroundColor White
Write-Host ""
Write-Host "After adding secrets, redeploy functions:" -ForegroundColor Cyan
Write-Host "  supabase functions deploy generate-blog --no-verify-jwt" -ForegroundColor Gray
Write-Host "  supabase functions deploy generate-content-plan --no-verify-jwt" -ForegroundColor Gray
Write-Host "  supabase functions deploy seo-analysis --no-verify-jwt" -ForegroundColor Gray
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

# Reminder about demo account
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📝 Optional: Create Demo Account" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Create demo user:"
Write-Host "   https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/auth/users"
Write-Host "   Email: demo@blitznova.ai" -ForegroundColor White
Write-Host "   Password: demo123456" -ForegroundColor White
Write-Host ""
Write-Host "2. Run SETUP_DEMO_ACCOUNT.sql in SQL Editor:"
Write-Host "   https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/sql/new"
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

Write-Host ""
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Set OPENAI_API_KEY in Supabase dashboard (required)" -ForegroundColor White
Write-Host "  2. Create demo user (optional)" -ForegroundColor White
Write-Host "  3. Test your app: https://buddy-ruddy-omega.vercel.app" -ForegroundColor White
Write-Host ""
