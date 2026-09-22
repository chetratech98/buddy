-- Additional business-intelligence fields extracted from the Analyze Site
-- crawl, feeding both content generation (brand_voice, value_proposition,
-- differentiators) and business intelligence (business_model,
-- team_expertise as an E-E-A-T signal, founded_year).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brand_voice text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS value_proposition text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_model text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS differentiators text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_expertise text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS founded_year text DEFAULT '';
