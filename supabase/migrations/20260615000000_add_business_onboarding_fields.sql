-- Business onboarding fields, collected on the Analyze Site page: ICP, offers,
-- regions served, top services, main CTA, and trust assets. These feed the
-- content-generation pipeline with concrete business context beyond the
-- AI-inferred niche/keywords.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS icp text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS offers text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS regions text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS top_services text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS main_cta text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trust_assets text[] NOT NULL DEFAULT '{}'::text[];
