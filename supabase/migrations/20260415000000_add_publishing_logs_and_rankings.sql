-- ============================================================
-- publishing_logs  — records every platform publish attempt
-- ============================================================
create table if not exists public.publishing_logs (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.blog_posts(id) on delete cascade,
  platform      text not null check (platform in ('wordpress', 'medium', 'internal')),
  status        text not null check (status in ('success', 'error', 'pending')),
  message       text,
  response_data jsonb,
  created_at    timestamptz not null default now()
);

alter table public.publishing_logs enable row level security;

-- Users can read only their own logs (joined through blog_posts)
create policy "Users can view their publishing logs"
  on public.publishing_logs for select
  using (
    post_id in (
      select id from public.blog_posts where user_id = auth.uid()
    )
  );

-- Only service role / edge functions can insert logs
create policy "Service role can insert publishing logs"
  on public.publishing_logs for insert
  with check (true);

create index idx_publishing_logs_post_id  on public.publishing_logs (post_id);
create index idx_publishing_logs_platform on public.publishing_logs (platform);

-- ============================================================
-- post_rankings  — weekly SERP position snapshots per post
-- ============================================================
create table if not exists public.post_rankings (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.blog_posts(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  keyword       text not null,
  position      integer,             -- null = not in top 100
  url           text,
  checked_at    timestamptz not null default now()
);

alter table public.post_rankings enable row level security;

create policy "Users can view their post rankings"
  on public.post_rankings for select
  using (user_id = auth.uid());

create policy "Service role can manage post rankings"
  on public.post_rankings for all
  using (true) with check (true);

create index idx_post_rankings_post_id    on public.post_rankings (post_id);
create index idx_post_rankings_checked_at on public.post_rankings (checked_at desc);

-- ============================================================
-- Add medium credentials to profiles
-- ============================================================
alter table public.profiles
  add column if not exists medium_integration_token text,
  add column if not exists medium_author_id          text;

-- ============================================================
-- pg_cron: run scheduled-publisher every 5 minutes
-- (requires pg_cron extension to be enabled in Supabase dashboard)
-- ============================================================
-- select cron.schedule(
--   'scheduled-publisher',
--   '*/5 * * * *',
--   $$
--     select net.http_post(
--       url := current_setting('app.supabase_url') || '/functions/v1/scheduled-publisher',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
--         'Content-Type', 'application/json'
--       ),
--       body := '{}'::jsonb
--     );
--   $$
-- );
