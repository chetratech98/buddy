-- reset_monthly_quota() has existed since the first quota migration but was
-- never scheduled — only the Stripe webhook resets usage, on paid renewals.
-- Free accounts that hit their monthly limit stayed blocked indefinitely, so
-- the daily generator skipped them every run (skippedQuota) long after the
-- month rolled over.

-- quota_reset_date is nullable, and `NULL <= now()` is never true, so a null
-- date would silently never reset. Treat it as due.
CREATE OR REPLACE FUNCTION public.reset_monthly_quota()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET
    posts_used_this_month = 0,
    quota_reset_date = date_trunc('month', now() + interval '1 month')
  WHERE quota_reset_date IS NULL OR quota_reset_date <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply it now: every account's reset date is already in the past.
SELECT public.reset_monthly_quota();

-- Then daily, shortly after midnight UTC. Idempotent — only rows whose reset
-- date has passed are touched, so most runs change nothing.
SELECT cron.schedule(
  'reset-monthly-quota',
  '5 0 * * *',
  $$SELECT public.reset_monthly_quota();$$
);
