-- ============================================================
-- daily_blog_generator_runs — one row per cron run, for visibility
-- into whether the daily auto-generation job is actually firing
-- ============================================================
create table if not exists public.daily_blog_generator_runs (
  id                    uuid primary key default gen_random_uuid(),
  success               boolean not null default true,
  "usersWithPlans"      integer not null default 0,
  generated             integer not null default 0,
  "skippedAlreadyPosted" integer not null default 0,
  "skippedNoItemForDay" integer not null default 0,
  "skippedQuota"        integer not null default 0,
  failed                integer not null default 0,
  created_at            timestamptz not null default now()
);

alter table public.daily_blog_generator_runs enable row level security;

-- No per-user ownership on this table (it's a global cron log) — only
-- admins should read it; everyone else is denied by default (no select
-- policy). The service-role key used by the edge function bypasses RLS.
create policy "Admins can view daily blog generator runs"
  on public.daily_blog_generator_runs for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid() and profiles.role = 'admin'
    )
  );

create index idx_daily_blog_generator_runs_created_at
  on public.daily_blog_generator_runs (created_at desc);

-- ============================================================
-- pg_cron: run daily-blog-generator once a day at 6am UTC
-- (Requires pg_cron + pg_net extensions enabled in Supabase dashboard)
-- Uncomment and run manually once extensions are enabled — adjust the
-- hour to whatever local "morning" makes sense for your user base.
-- ============================================================
-- select cron.schedule(
--   'daily-blog-generator',
--   '0 6 * * *',
--   $$
--     select net.http_post(
--       url     := current_setting('app.supabase_url') || '/functions/v1/daily-blog-generator',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
--         'Content-Type',  'application/json'
--       ),
--       body    := '{}'::jsonb
--     );
--   $$
-- );
