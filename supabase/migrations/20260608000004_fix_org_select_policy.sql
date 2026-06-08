-- Fix: org owner couldn't read their own org immediately after creation
-- because is_org_member() requires an organization_members row which
-- doesn't exist yet at the moment of INSERT + SELECT.
-- Allow the owner to always see their own org.

DROP POLICY IF EXISTS "Org members can view their org" ON public.organizations;

CREATE POLICY "Org members can view their org"
ON public.organizations FOR SELECT
USING (
  owner_id = auth.uid()
  OR is_org_member(id)
);
