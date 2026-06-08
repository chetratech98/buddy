-- Fix: org owner couldn't add themselves as the first member
-- because is_org_member() returns false when organization_members is empty.
-- Allow the org owner (from organizations.owner_id) to always insert members.

DROP POLICY IF EXISTS "Owners and admins can invite members" ON public.organization_members;

CREATE POLICY "Owners and admins can invite members"
ON public.organization_members FOR INSERT
WITH CHECK (
  -- Org owner can always add members (including themselves as first member)
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id AND owner_id = auth.uid()
  )
  OR is_org_member(org_id, '{owner,admin}')
);
