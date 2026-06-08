-- ─────────────────────────────────────────────────────────────────────────────
-- Multi-tenancy: Organizations, Members, and WordPress Sites
-- ─────────────────────────────────────────────────────────────────────────────

-- Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'active',
  posts_quota_monthly INTEGER NOT NULL DEFAULT 5,
  posts_used_this_month INTEGER NOT NULL DEFAULT 0,
  quota_reset_date TIMESTAMP WITH TIME ZONE DEFAULT date_trunc('month', now() + interval '1 month'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Organization members (also used for pending invites before acceptance)
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL until invite accepted
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_email TEXT,
  invite_token UUID UNIQUE DEFAULT gen_random_uuid(),
  invite_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- WordPress sites per organization (or per solo user)
CREATE TABLE IF NOT EXISTS public.wordpress_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- for solo users without an org
  name TEXT NOT NULL,
  wp_url TEXT NOT NULL,
  wp_username TEXT NOT NULL,
  wp_app_password_enc TEXT, -- AES-256-GCM encrypted, key = WP_ENCRYPTION_KEY secret
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (org_id IS NOT NULL OR user_id IS NOT NULL)
);

-- Add org_id context to content tables (nullable for backward compat)
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.content_plans ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.serp_analyses ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS org_members_org_idx ON public.organization_members(org_id);
CREATE INDEX IF NOT EXISTS org_members_user_idx ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS org_members_token_idx ON public.organization_members(invite_token) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS wp_sites_org_idx ON public.wordpress_sites(org_id);
CREATE INDEX IF NOT EXISTS wp_sites_user_idx ON public.wordpress_sites(user_id);
CREATE INDEX IF NOT EXISTS blog_posts_org_idx ON public.blog_posts(org_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: check if current user is an org member with a given role
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID, p_roles TEXT[] DEFAULT '{owner,admin,member}')
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
      AND role = ANY(p_roles)
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — organizations
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their org"
ON public.organizations FOR SELECT
USING (is_org_member(id));

CREATE POLICY "Anyone can create an org"
ON public.organizations FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Org owners and admins can update"
ON public.organizations FOR UPDATE
USING (is_org_member(id, '{owner,admin}'));

CREATE POLICY "Org owner can delete"
ON public.organizations FOR DELETE
USING (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — organization_members
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Members can see all members in their org
CREATE POLICY "Org members can view memberships"
ON public.organization_members FOR SELECT
USING (
  is_org_member(org_id)
  OR (invite_token IS NOT NULL AND accepted_at IS NULL) -- pending invites readable by token
);

-- Owners and admins can invite (insert)
CREATE POLICY "Owners and admins can invite members"
ON public.organization_members FOR INSERT
WITH CHECK (is_org_member(org_id, '{owner,admin}'));

-- Users can accept their own invite
CREATE POLICY "Users can accept their invite"
ON public.organization_members FOR UPDATE
USING (invite_token IS NOT NULL AND accepted_at IS NULL)
WITH CHECK (user_id = auth.uid() AND accepted_at IS NOT NULL);

-- Owners/admins can remove members; members can leave
CREATE POLICY "Owners and admins can remove members"
ON public.organization_members FOR DELETE
USING (
  is_org_member(org_id, '{owner,admin}')
  OR user_id = auth.uid() -- self-removal (leave org)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — wordpress_sites
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.wordpress_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view sites"
ON public.wordpress_sites FOR SELECT
USING (
  (org_id IS NOT NULL AND is_org_member(org_id))
  OR (user_id = auth.uid())
);

CREATE POLICY "Owners and admins can manage sites"
ON public.wordpress_sites FOR INSERT
WITH CHECK (
  (org_id IS NOT NULL AND is_org_member(org_id, '{owner,admin}'))
  OR (user_id = auth.uid() AND org_id IS NULL)
);

CREATE POLICY "Owners and admins can update sites"
ON public.wordpress_sites FOR UPDATE
USING (
  (org_id IS NOT NULL AND is_org_member(org_id, '{owner,admin}'))
  OR (user_id = auth.uid() AND org_id IS NULL)
);

CREATE POLICY "Owners and admins can delete sites"
ON public.wordpress_sites FOR DELETE
USING (
  (org_id IS NOT NULL AND is_org_member(org_id, '{owner,admin}'))
  OR (user_id = auth.uid() AND org_id IS NULL)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — extend blog_posts to allow org member access
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Org members can view org posts" ON public.blog_posts;
CREATE POLICY "Org members can view org posts"
ON public.blog_posts FOR SELECT
USING (org_id IS NOT NULL AND is_org_member(org_id));

DROP POLICY IF EXISTS "Org members can insert org posts" ON public.blog_posts;
CREATE POLICY "Org members can insert org posts"
ON public.blog_posts FOR INSERT
WITH CHECK (org_id IS NOT NULL AND is_org_member(org_id));

DROP POLICY IF EXISTS "Org members can update org posts" ON public.blog_posts;
CREATE POLICY "Org members can update org posts"
ON public.blog_posts FOR UPDATE
USING (org_id IS NOT NULL AND is_org_member(org_id));

DROP POLICY IF EXISTS "Org members can delete org posts" ON public.blog_posts;
CREATE POLICY "Org members can delete org posts"
ON public.blog_posts FOR DELETE
USING (org_id IS NOT NULL AND is_org_member(org_id, '{owner,admin}'));

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS organizations_updated_at ON public.organizations;
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS wp_sites_updated_at ON public.wordpress_sites;
CREATE TRIGGER wp_sites_updated_at BEFORE UPDATE ON public.wordpress_sites
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
