-- Increase the free-tier monthly post quota from 5 to 15.

ALTER TABLE public.profiles ALTER COLUMN posts_quota_monthly SET DEFAULT 15;
ALTER TABLE public.organizations ALTER COLUMN posts_quota_monthly SET DEFAULT 15;

-- Bump existing free-tier accounts still on the old default up to the new one.
UPDATE public.profiles
SET posts_quota_monthly = 15
WHERE subscription_tier = 'free' AND posts_quota_monthly <= 5;

UPDATE public.organizations
SET posts_quota_monthly = 15
WHERE subscription_tier = 'free' AND posts_quota_monthly <= 5;
