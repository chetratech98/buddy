-- Free-tier monthly post quota: 30 -> 5. The earlier raises to 15 and then 30
-- were labelled "testing"; at ~$0.15 of OpenAI spend per generated post
-- (text + images) a 30-post free tier costs far more than it converts.
-- Paid tiers are untouched — their quota is set by stripe-webhook.

ALTER TABLE public.profiles ALTER COLUMN posts_quota_monthly SET DEFAULT 5;
ALTER TABLE public.organizations ALTER COLUMN posts_quota_monthly SET DEFAULT 5;

UPDATE public.profiles
SET posts_quota_monthly = 5
WHERE subscription_tier = 'free';

UPDATE public.organizations
SET posts_quota_monthly = 5
WHERE subscription_tier = 'free';
