-- daily-blog-generator now processes at most one user per invocation (see
-- the function's own comments — a full generation run per user is enough
-- compute that doing several in one invocation hit Supabase's per-invocation
-- resource limit). Re-scheduling from a single 06:00 firing to every 10
-- minutes across a 06:00-09:59 morning window so a cron tick picks up each
-- remaining eligible user shortly after the previous one finishes.
--
-- cron.schedule() upserts by job name, so this updates the job created in
-- 20260616000000_enable_cron_automation.sql in place.

SELECT cron.schedule(
  'daily-blog-generator',
  '*/10 6-9 * * *',
  $$
    SELECT net.http_post(
      url := 'https://envewfudiyxmnuefbdow.supabase.co/functions/v1/daily-blog-generator',
      headers := jsonb_build_object(
        'Authorization', 'Bearer sb_publishable_ArH_tDj5BZR-_4lxQ3H8QA_JA2AKuJc',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  $$
);
