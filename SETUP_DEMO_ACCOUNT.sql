-- ============================================
-- SETUP DEMO ACCOUNT
-- ============================================
-- Run this in Supabase SQL Editor AFTER creating the demo user in Auth dashboard.
--
-- STEP 1 (do first): Go to Authentication → Users → Add User
--   Email:    demo@blitznova.ai
--   Password: demo123456
--   ✅ Check "Auto Confirm User" so no email confirmation is needed
--
-- STEP 2: Run this SQL script.
--
-- Dashboard: https://supabase.com/dashboard/project/offwxwpbhxklatnqlbcc/sql/new
-- ============================================

DO $$
DECLARE
  demo_user_id UUID;
BEGIN
  -- Look up the demo user's actual UUID
  SELECT id INTO demo_user_id
  FROM auth.users
  WHERE email = 'demo@blitznova.ai'
  LIMIT 1;

  IF demo_user_id IS NULL THEN
    RAISE EXCEPTION
      'Demo user not found. Please create demo@blitznova.ai in Authentication → Users first.';
  END IF;

  RAISE NOTICE 'Setting up demo account for user_id: %', demo_user_id;

  -- ── Profile ──────────────────────────────────────────────────────────────
  INSERT INTO profiles (
    user_id, display_name, role,
    subscription_tier, subscription_status,
    niche, keywords
  ) VALUES (
    demo_user_id, 'Demo User', 'user',
    'premium', 'active',
    'AI & Technology',
    ARRAY['AI tools', 'content marketing', 'SEO automation', 'blog writing', 'ChatGPT alternatives']
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name       = EXCLUDED.display_name,
    subscription_tier  = EXCLUDED.subscription_tier,
    subscription_status = EXCLUDED.subscription_status,
    niche              = EXCLUDED.niche,
    keywords           = EXCLUDED.keywords;

  -- ── Content Plan ─────────────────────────────────────────────────────────
  INSERT INTO content_plans (user_id, niche, keywords, items, tone, created_at)
  VALUES (
    demo_user_id,
    'AI & Technology',
    ARRAY['AI tools', 'content marketing', 'SEO automation'],
    jsonb_build_array(
      jsonb_build_object('day', 1, 'topic', 'Top 10 AI Content Writing Tools in 2026',      'keywords', ARRAY['AI writing', 'content tools']),
      jsonb_build_object('day', 2, 'topic', 'How to Use ChatGPT for SEO Content',            'keywords', ARRAY['ChatGPT', 'SEO tips']),
      jsonb_build_object('day', 3, 'topic', 'Content Marketing Automation Best Practices',   'keywords', ARRAY['automation', 'marketing']),
      jsonb_build_object('day', 4, 'topic', 'AI vs Human: Who Writes Better Content?',       'keywords', ARRAY['AI content', 'comparison']),
      jsonb_build_object('day', 5, 'topic', 'SEO Optimization with AI Tools',                'keywords', ARRAY['SEO', 'AI optimization'])
    ),
    'professional',
    NOW() - INTERVAL '5 days'
  )
  ON CONFLICT DO NOTHING;

  -- ── Sample Blog Post ──────────────────────────────────────────────────────
  INSERT INTO blog_posts (user_id, title, excerpt, content, keywords, status, created_at)
  VALUES (
    demo_user_id,
    'The Complete Guide to AI Content Creation in 2026',
    'Discover how AI is revolutionizing content creation and learn the best practices for leveraging AI tools in your content marketing strategy.',
    E'# The Complete Guide to AI Content Creation in 2026\n\n## Introduction\n\nArtificial Intelligence has transformed the content creation landscape. In this comprehensive guide, we''ll explore how you can leverage AI tools to create high-quality content efficiently.\n\n## Why AI Content Creation Matters\n\n- **Speed**: Generate content 10x faster\n- **Consistency**: Maintain brand voice across all content\n- **SEO Optimization**: Built-in keyword optimization\n- **Cost-Effective**: Reduce content production costs by 70%\n\n## Top AI Content Tools\n\n### 1. ChatGPT\nThe most popular AI writing assistant that can help with brainstorming, drafting, and editing.\n\n### 2. Jasper AI\nSpecialized in marketing copy and long-form content.\n\n### 3. Copy.ai\nPerfect for social media and ad copy.\n\n## Best Practices\n\n1. **Start with a clear brief**: Define your topic, audience, and goals\n2. **Review and edit**: AI is a tool, not a replacement for human creativity\n3. **Add your unique perspective**: Inject personal insights and experiences\n4. **Optimize for SEO**: Use keyword research to guide content creation\n\n## Conclusion\n\nAI content creation is here to stay. By following these best practices, you can harness the power of AI while maintaining authenticity and quality.\n\n*Last updated: April 2026*',
    ARRAY['AI content', 'content creation', 'ChatGPT', 'AI tools'],
    'published',
    NOW() - INTERVAL '2 days'
  );

  -- ── Sample SEO Analysis ───────────────────────────────────────────────────
  INSERT INTO serp_analyses (user_id, niche, keywords, analysis, created_at)
  VALUES (
    demo_user_id,
    'AI & Technology',
    ARRAY['AI writing tools', 'content automation', 'SEO software'],
    jsonb_build_object(
      'top_competitors', jsonb_build_array(
        jsonb_build_object('domain', 'jasper.ai',       'position', 1, 'score', 95),
        jsonb_build_object('domain', 'copy.ai',         'position', 2, 'score', 92),
        jsonb_build_object('domain', 'writesonic.com',  'position', 3, 'score', 88)
      ),
      'keyword_difficulty', jsonb_build_object(
        'AI writing tools',    'medium',
        'content automation',  'easy',
        'SEO software',        'hard'
      ),
      'content_recommendations', jsonb_build_array(
        'Focus on long-form content (2000+ words)',
        'Include case studies and examples',
        'Add comparison tables',
        'Use FAQ sections for featured snippets'
      )
    ),
    NOW() - INTERVAL '1 day'
  );

  RAISE NOTICE '✅ Demo account setup complete for %', demo_user_id;
END $$;

-- ── Verify setup ──────────────────────────────────────────────────────────────
SELECT
  u.email,
  p.display_name,
  p.subscription_tier,
  p.subscription_status,
  p.niche
FROM auth.users u
LEFT JOIN profiles p ON p.user_id = u.id
WHERE u.email = 'demo@blitznova.ai';

SELECT
  'Blog Posts'    AS type, COUNT(*) AS count FROM blog_posts    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'demo@blitznova.ai')
UNION ALL
SELECT
  'Content Plans' AS type, COUNT(*) AS count FROM content_plans WHERE user_id = (SELECT id FROM auth.users WHERE email = 'demo@blitznova.ai')
UNION ALL
SELECT
  'SEO Analyses'  AS type, COUNT(*) AS count FROM serp_analyses  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'demo@blitznova.ai');
