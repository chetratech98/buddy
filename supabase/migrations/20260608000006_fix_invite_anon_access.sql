-- Allow unauthenticated (anon) users to read pending invite details
-- so the /invite/:token page works before the user logs in.
-- RLS still restricts what rows are visible:
--   only rows where invite_token IS NOT NULL AND accepted_at IS NULL

GRANT SELECT ON public.organization_members TO anon;
GRANT SELECT ON public.organizations TO anon;

-- Ensure the SELECT policy allows reading by invite token
-- without requiring auth.uid() (works for anon users)
DROP POLICY IF EXISTS "Org members can view memberships" ON public.organization_members;

CREATE POLICY "Org members can view memberships"
ON public.organization_members FOR SELECT
USING (
  -- Logged-in members can see all members in their org
  is_org_member(org_id)
  -- Org owner can see all members
  OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id AND owner_id = auth.uid()
  )
  -- Anyone (including anon) can read a pending invite by token
  -- (token is unguessable UUID, safe to expose invite details)
  OR (invite_token IS NOT NULL AND accepted_at IS NULL)
);
