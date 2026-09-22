-- Enable pg_cron + pg_net and actually schedule the three automation jobs
-- that were previously drafted but left commented out:
--   - scheduled-publisher   every 5 minutes  (publishes posts whose scheduled_at has arrived)
--   - rank-tracker-daily    daily at 02:00   (refreshes SERP rank tracking)
--   - daily-blog-generator  daily at 06:00   (generates each user's daily blog post)
--
-- The Authorization header uses the anon/publishable key, not the service
-- role key: Supabase's function gateway only needs a validly-signed project
-- JWT to pass verify_jwt (the anon key satisfies that), and each function
-- separately reads SUPABASE_SERVICE_ROLE_KEY from its own edge-function
-- secrets for actual elevated DB access. The anon key is public by design
-- (already shipped in the frontend bundle), so it's safe to embed here.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

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
      body := '{}'::jsonb
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
      body := '{}'::jsonb
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
      body := '{}'::jsonb
    );
  $$
);
