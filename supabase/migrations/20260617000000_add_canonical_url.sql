-- blog_posts.canonical_url was already read by rank-tracker and
-- scheduled-publisher (used for domain-accurate rank matching and Medium's
-- canonicalUrl field) but was never added to the schema — every
-- rank-tracker run was hard-failing with "column does not exist" because
-- its query explicitly selects it.

ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS canonical_url text;
