-- Nothing recorded what a generated post actually costs in OpenAI spend, so
-- cost increases (e.g. a second image per post) were invisible until the
-- invoice arrived. One row per paid AI call, with an estimated USD cost
-- computed from a price table in _shared/ai-usage.ts (an estimate, not
-- billing data — reconcile against the OpenAI usage dashboard).
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid,
  post_id           uuid,
  function_name     text NOT NULL,
  kind              text NOT NULL,            -- 'chat' | 'image'
  purpose           text NOT NULL,            -- generation | expansion | qa_review | targeted_fix | featured_image | body_image
  model             text NOT NULL,
  prompt_tokens     integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  image_count       integer NOT NULL DEFAULT 0,
  est_cost_usd      numeric(10,5) NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Written only by edge functions using the service-role key (bypasses RLS);
-- readable only by internal admin roles.
CREATE POLICY "Admins can view AI usage log"
  ON public.ai_usage_log FOR SELECT
  USING (is_admin_role(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at
  ON public.ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_created
  ON public.ai_usage_log (user_id, created_at DESC);
