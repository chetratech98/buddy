-- ============================================
-- SETUP DEMO ACCOUNT
-- ============================================
-- Run this in Supabase SQL Editor to create demo account
-- Dashboard: https://supabase.com/dashboard/project/envewfudiyxmnuefbdow/editor

-- Note: You need to create the demo user through Supabase Auth first!
-- Go to: Authentication > Users > Invite user
-- Email: demo@blitznova.ai
-- Password: demo123456
-- Then run this SQL to set up the profile

-- ============================================
-- Create Demo Profile (run after user is created)
-- ============================================

-- Insert demo profile if not exists
INSERT INTO profiles (user_id, display_name, role, subscription_tier, subscription_status, niche, keywords)
SELECT 
  auth.uid() as user_id,
  'Demo User' as display_name,
  'user' as role,
  'premium' as subscription_tier,
  'active' as subscription_status,
  'AI & Technology' as niche,
  ARRAY['AI tools', 'content marketing', 'SEO automation', 'blog writing', 'ChatGPT alternatives'] as keywords
FROM auth.users
WHERE email = 'demo@blitznova.ai'
ON CONFLICT (user_id) DO UPDATE
SET 
  display_name = EXCLUDED.display_name,
  subscription_tier = EXCLUDED.subscription_tier,
  subscription_status = EXCLUDED.subscription_status,
  niche = EXCLUDED.niche,
  keywords = EXCLUDED.keywords;

-- ============================================
-- Create Sample Content Plan for Demo
-- ============================================

INSERT INTO content_plans (user_id, niche, keywords, items, tone, created_at)
SELECT 
  auth.uid() as user_id,
  'AI & Technology' as niche,
  ARRAY['AI tools', 'content marketing', 'SEO automation'] as keywords,
  jsonb_build_array(
    jsonb_build_object('day', 1, 'topic', 'Top 10 AI Content Writing Tools in 2026', 'keywords', ARRAY['AI writing', 'content tools']),
    jsonb_build_object('day', 2, 'topic', 'How to Use ChatGPT for SEO Content', 'keywords', ARRAY['ChatGPT', 'SEO tips']),
    jsonb_build_object('day', 3, 'topic', 'Content Marketing Automation Best Practices', 'keywords', ARRAY['automation', 'marketing']),
    jsonb_build_object('day', 4, 'topic', 'AI vs Human: Who Writes Better Content?', 'keywords', ARRAY['AI content', 'comparison']),
    jsonb_build_object('day', 5, 'topic', 'SEO Optimization with AI Tools', 'keywords', ARRAY['SEO', 'AI optimization'])
  ) as items,
  'professional' as tone,
  NOW() - INTERVAL '5 days' as created_at
FROM auth.users
WHERE email = 'demo@blitznova.ai'
ON CONFLICT (user_id, created_at) DO NOTHING;

-- ============================================
-- Create Sample Blog Posts for Demo
-- ============================================

INSERT INTO blog_posts (user_id, title, excerpt, content, keywords, status, created_at)
SELECT 
  auth.uid() as user_id,
  'The Complete Guide to AI Content Creation in 2026' as title,
  'Discover how AI is revolutionizing content creation and learn the best practices for leveraging AI tools in your content marketing strategy.' as excerpt,
  '# The Complete Guide to AI Content Creation in 2026

## Introduction

Artificial Intelligence has transformed the content creation landscape. In this comprehensive guide, we''ll explore how you can leverage AI tools to create high-quality content efficiently.

## Why AI Content Creation Matters

- **Speed**: Generate content 10x faster
- **Consistency**: Maintain brand voice across all content
- **SEO Optimization**: Built-in keyword optimization
- **Cost-Effective**: Reduce content production costs by 70%

## Top AI Content Tools

### 1. ChatGPT
The most popular AI writing assistant that can help with brainstorming, drafting, and editing.

### 2. Jasper AI
Specialized in marketing copy and long-form content.

### 3. Copy.ai
Perfect for social media and ad copy.

## Best Practices

1. **Start with a clear brief**: Define your topic, audience, and goals
2. **Review and edit**: AI is a tool, not a replacement for human creativity
3. **Add your unique perspective**: Inject personal insights and experiences
4. **Optimize for SEO**: Use keyword research to guide content creation

## Conclusion

AI content creation is here to stay. By following these best practices, you can harness the power of AI while maintaining authenticity and quality.

---

*Last updated: April 2026*' as content,
  ARRAY['AI content', 'content creation', 'ChatGPT', 'AI tools'] as keywords,
  'published' as status,
  NOW() - INTERVAL '2 days' as created_at
FROM auth.users
WHERE email = 'demo@blitznova.ai';

-- ============================================
-- Create Sample SEO Analysis for Demo
-- ============================================

INSERT INTO serp_analyses (user_id, niche, keywords, analysis, created_at)
SELECT 
  auth.uid() as user_id,
  'AI & Technology' as niche,
  ARRAY['AI writing tools', 'content automation', 'SEO software'] as keywords,
  jsonb_build_object(
    'top_competitors', jsonb_build_array(
      jsonb_build_object('domain', 'jasper.ai', 'position', 1, 'score', 95),
      jsonb_build_object('domain', 'copy.ai', 'position', 2, 'score', 92),
      jsonb_build_object('domain', 'writesonic.com', 'position', 3, 'score', 88)
    ),
    'keyword_difficulty', jsonb_build_object(
      'AI writing tools', 'medium',
      'content automation', 'easy',
      'SEO software', 'hard'
    ),
    'content_recommendations', jsonb_build_array(
      'Focus on long-form content (2000+ words)',
      'Include case studies and examples',
      'Add comparison tables',
      'Use FAQ sections for featured snippets'
    )
  ) as analysis,
  NOW() - INTERVAL '1 day' as created_at
FROM auth.users
WHERE email = 'demo@blitznova.ai';

-- ============================================
-- VERIFICATION
-- ============================================

-- Check if demo user exists
SELECT 
  u.email,
  p.display_name,
  p.subscription_tier,
  p.subscription_status,
  p.niche,
  p.keywords
FROM auth.users u
LEFT JOIN profiles p ON p.user_id = u.id
WHERE u.email = 'demo@blitznova.ai';

-- Check demo content
SELECT 
  'Blog Posts' as type,
  COUNT(*) as count
FROM blog_posts
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'demo@blitznova.ai')
UNION ALL
SELECT 
  'Content Plans' as type,
  COUNT(*) as count
FROM content_plans
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'demo@blitznova.ai')
UNION ALL
SELECT 
  'SEO Analyses' as type,
  COUNT(*) as count
FROM serp_analyses
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'demo@blitznova.ai');

-- ============================================
-- CLEANUP (Optional - use to reset demo data)
-- ============================================

-- Uncomment to delete all demo data and start fresh
/*
DELETE FROM blog_posts WHERE user_id = (SELECT id FROM auth.users WHERE email = 'demo@blitznova.ai');
DELETE FROM content_plans WHERE user_id = (SELECT id FROM auth.users WHERE email = 'demo@blitznova.ai');
DELETE FROM serp_analyses WHERE user_id = (SELECT id FROM auth.users WHERE email = 'demo@blitznova.ai');
-- Note: Don't delete the profile, just reset the data
*/
