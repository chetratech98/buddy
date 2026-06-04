-- serp_briefs — stores Auto Blog SaaS cluster briefs from the serp-layer function
--
-- Schema matches the serp-layer output spec:
--   keyword_cluster   → primary_keyword, secondary_keywords, serp_cluster_id
--   serp_summary      → country, language, top_urls, dominant_intent, shared_patterns
--   content_recommendation → article_type, title_angles, outline, must_cover_topics, faq, gaps
--   scoring           → opportunity_score, difficulty_proxy, business_relevance
--   action            → decision (write_new_article | refresh_existing | skip), reason
--
-- Each row = one keyword cluster from one analysis run.
-- The full JSON brief is stored in `brief_json` for easy retrieval,
-- with indexed scalar columns for fast filtering.

CREATE TABLE public.serp_briefs (
  id                  UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche               TEXT NOT NULL DEFAULT '',

  -- Cluster identity (from keyword_cluster)
  serp_cluster_id     TEXT NOT NULL,
  primary_keyword     TEXT NOT NULL,
  secondary_keywords  TEXT[] NOT NULL DEFAULT '{}',

  -- SERP summary scalars (for indexed filtering)
  country             TEXT NOT NULL DEFAULT 'us',
  language            TEXT NOT NULL DEFAULT 'en',
  dominant_intent     TEXT NOT NULL DEFAULT 'informational',
  serp_date           DATE NOT NULL,

  -- Content recommendation
  article_type        TEXT NOT NULL DEFAULT 'guide',

  -- Scores (for indexed sorting)
  opportunity_score   INTEGER NOT NULL DEFAULT 0,
  difficulty_proxy    INTEGER NOT NULL DEFAULT 0,
  business_relevance  INTEGER NOT NULL DEFAULT 0,

  -- Decision engine output
  decision            TEXT NOT NULL DEFAULT 'write_new_article'
                        CHECK (decision IN ('write_new_article', 'refresh_existing', 'skip')),
  decision_reason     TEXT NOT NULL DEFAULT '',

  -- Full nested JSON brief (complete output)
  brief_json          JSONB NOT NULL DEFAULT '{}',

  created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.serp_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own SERP briefs"
  ON public.serp_briefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own SERP briefs"
  ON public.serp_briefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own SERP briefs"
  ON public.serp_briefs FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
-- Standard lookup indexes
CREATE INDEX idx_serp_briefs_user_id      ON public.serp_briefs(user_id);
CREATE INDEX idx_serp_briefs_user_created ON public.serp_briefs(user_id, created_at DESC);
CREATE INDEX idx_serp_briefs_primary_kw   ON public.serp_briefs(primary_keyword);

-- Decision queue: find highest-opportunity write_new_article tasks first
CREATE INDEX idx_serp_briefs_action       ON public.serp_briefs(user_id, decision, opportunity_score DESC);

-- JSONB index for deep queries into the brief
CREATE INDEX idx_serp_briefs_json         ON public.serp_briefs USING gin(brief_json);

-- ─────────────────────────────────────────────────────────────────────────────
-- Convenience view: article candidates ready to write, highest priority first
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.serp_write_queue AS
SELECT
  id,
  user_id,
  niche,
  serp_cluster_id,
  primary_keyword,
  secondary_keywords,
  article_type,
  opportunity_score,
  difficulty_proxy,
  business_relevance,
  decision,
  decision_reason,
  brief_json -> 'content_recommendation' -> 'suggested_title_angles'  AS suggested_titles,
  brief_json -> 'content_recommendation' -> 'recommended_outline'     AS outline,
  brief_json -> 'content_recommendation' -> 'must_cover_topics'       AS must_cover,
  brief_json -> 'content_recommendation' -> 'faq_questions'           AS faq_questions,
  brief_json -> 'content_recommendation' -> 'content_gaps_to_win'     AS content_gaps,
  brief_json -> 'serp_summary'           -> 'shared_patterns'         AS shared_patterns,
  brief_json -> '_meta'                  ->> 'notes_for_planner'      AS notes_for_planner,
  serp_date,
  created_at
FROM public.serp_briefs
WHERE decision IN ('write_new_article', 'refresh_existing')
ORDER BY opportunity_score DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- Documentation
-- ─────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.serp_briefs
  IS 'Auto Blog SaaS cluster briefs from the serp-layer 8-module pipeline. One row per keyword cluster per run.';

COMMENT ON COLUMN public.serp_briefs.serp_cluster_id
  IS 'Zero-padded cluster identifier e.g. cluster_001, cluster_002';

COMMENT ON COLUMN public.serp_briefs.decision
  IS 'Decision engine output: write_new_article | refresh_existing | skip';

COMMENT ON COLUMN public.serp_briefs.brief_json
  IS 'Full nested JSON brief: keyword_cluster, serp_summary, content_recommendation, scoring, action, _meta';

COMMENT ON COLUMN public.serp_briefs.opportunity_score
  IS '0-100: inverse of difficulty + commercial intent bonus + cluster breadth';

COMMENT ON COLUMN public.serp_briefs.difficulty_proxy
  IS '0-100: based on DA of domains in top 10, SERP features present, and ad count';

COMMENT ON COLUMN public.serp_briefs.business_relevance
  IS '0-100: keyword-niche overlap + intent type + opportunity magnitude';
