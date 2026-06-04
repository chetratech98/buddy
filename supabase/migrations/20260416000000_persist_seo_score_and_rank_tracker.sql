-- ============================================================
-- Persist SEO score + word count on blog_posts
-- ============================================================
alter table public.blog_posts
  add column if not exists seo_score  integer default null,
  add column if not exists word_count integer default null;

comment on column public.blog_posts.seo_score  is 'Cached SEO score (0-100) from seo-scorer; recalculated on save';
comment on column public.blog_posts.word_count is 'Actual word count of content field';

create index if not exists idx_blog_posts_seo_score
  on public.blog_posts (seo_score desc)
  where seo_score is not null;

-- ============================================================
-- rank_tracker_runs — log each batch of ranking checks
-- ============================================================
create table if not exists public.rank_tracker_runs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  posts_checked integer not null default 0,
  keywords_checked integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.rank_tracker_runs enable row level security;

create policy "Users can view own rank tracker runs"
  on public.rank_tracker_runs for select
  using (user_id = auth.uid());

create policy "Service role can manage rank tracker runs"
  on public.rank_tracker_runs for all
  using (true) with check (true);

-- ============================================================
-- Extend post_rankings with more detail
-- ============================================================
alter table public.post_rankings
  add column if not exists change_from_last integer,  -- position diff from previous check
  add column if not exists source_url        text;     -- canonical URL that ranked

comment on column public.post_rankings.change_from_last is 'Positive = fell in rank, negative = rose (e.g. -3 = moved up 3 spots)';

create index if not exists idx_post_rankings_user_checked
  on public.post_rankings (user_id, checked_at desc);

-- ============================================================
-- pg_cron: run rank-tracker every day at 2am UTC
-- (Requires pg_cron + pg_net extensions enabled in Supabase dashboard)
-- Uncomment and run manually once extensions are enabled.
-- ============================================================
-- select cron.schedule(
--   'rank-tracker-daily',
--   '0 2 * * *',
--   $$
--     select net.http_post(
--       url     := current_setting('app.supabase_url') || '/functions/v1/rank-tracker',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
--         'Content-Type',  'application/json'
--       ),
--       body    := '{}'::jsonb
--     );
--   $$
-- );
