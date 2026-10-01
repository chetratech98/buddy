-- daily_blog_generator_runs' admin-read policy was written before the RBAC
-- migration (20260611000000) replaced the single 'admin' role with five
-- internal-staff roles and renamed every existing 'admin' row to
-- 'super_admin'. Since then "role = 'admin'" has matched zero rows ever
-- — the policy has been permanently unsatisfiable, so no one (not even
-- super_admin) could actually read this table through RLS. Re-point it at
-- is_admin_role(), the same helper every other admin-visibility policy
-- added in that migration already uses.
DROP POLICY IF EXISTS "Admins can view daily blog generator runs" ON public.daily_blog_generator_runs;

CREATE POLICY "Admins can view daily blog generator runs"
  ON public.daily_blog_generator_runs FOR SELECT
  USING (is_admin_role(auth.uid()));

-- rank_tracker_runs never had an admin-visibility policy at all — only a
-- per-user "view own rows" policy, which is useless for an admin checking
-- whether the automation is healthy across the whole user base.
CREATE POLICY "Admins can view all rank tracker runs"
  ON public.rank_tracker_runs FOR SELECT
  USING (is_admin_role(auth.uid()));
