-- The default net.http_post timeout (5000ms) is too short for these jobs
-- once there's real data to process: rank-tracker paces ~1.1s between each
-- SerpApi call and can handle up to 50 posts per run, and
-- daily-blog-generator runs a full generate-blog pass (SERP + scrape + 2 LLM
-- passes) per user sequentially. Without an explicit timeout, pg_net gives up
-- waiting on the response well before these can finish.
--
-- cron.schedule() upserts by job name, so re-running this updates the three
-- jobs created in 20260616000000_enable_cron_automation.sql in place rather
-- than creating duplicates.

SELECT cron.schedule(
  'scheduled-publisher',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://envewfudiyxmnuefbdow.supabase.co/functions/v1/scheduled-publisher',
      headers := jsonb_build_object(
        'Authorization', 'Bearer sb_publishable_ArH_tDj5BZR-_4lxQ3H8QA_JA2AKuJc',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $$
);

SELECT cron.schedule(
  'rank-tracker-daily',
  '0 2 * * *',
  $$
    SELECT net.http_post(
      url := 'https://envewfudiyxmnuefbdow.supabase.co/functions/v1/rank-tracker',
      headers := jsonb_build_object(
        'Authorization', 'Bearer sb_publishable_ArH_tDj5BZR-_4lxQ3H8QA_JA2AKuJc',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  $$
);

SELECT cron.schedule(
  'daily-blog-generator',
  '0 6 * * *',
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
