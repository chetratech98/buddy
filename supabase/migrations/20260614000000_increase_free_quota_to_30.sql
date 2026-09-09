-- Increase the free-tier monthly post quota from 15 to 30 (testing).

ALTER TABLE public.profiles ALTER COLUMN posts_quota_monthly SET DEFAULT 30;
ALTER TABLE public.organizations ALTER COLUMN posts_quota_monthly SET DEFAULT 30;

-- Bump existing free-tier accounts still on an old default (5 or 15) up to 30.
UPDATE public.profiles
SET posts_quota_monthly = 30
WHERE subscription_tier = 'free' AND posts_quota_monthly <= 15;

UPDATE public.organizations
SET posts_quota_monthly = 30
WHERE subscription_tier = 'free' AND posts_quota_monthly <= 15;
