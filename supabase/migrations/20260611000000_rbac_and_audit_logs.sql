-- ============================================================
-- Phase 1: Granular internal-staff RBAC + audit logging
--
-- Expands profiles.role from a binary user/admin flag into five
-- internal-staff roles. Regular customers stay 'user' — these five
-- are for BlitzNova staff operating the admin portal.
-- ============================================================

alter table public.profiles drop constraint if exists profiles_role_check;

-- Existing 'admin' rows become 'super_admin' — the top of the new hierarchy.
update public.profiles set role = 'super_admin' where role = 'admin';

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'super_admin', 'ops', 'support', 'finance', 'read_only'));

-- ============================================================
-- is_admin_role() — true for ANY internal-staff role. Used for
-- read-visibility policies only. Which internal role may perform
-- which WRITE action is intentionally NOT encoded here — it differs
-- per action (finance can adjust billing but not suspend accounts,
-- support can manage tickets but not change roles) and is enforced
-- in the application layer via src/lib/rbac.ts, matching how this
-- codebase already gates admin routes (ProtectedRoute requireAdmin)
-- rather than pushing per-action logic into RLS.
-- ============================================================
create or replace function public.is_admin_role(p_user_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where user_id = p_user_id
      and role in ('super_admin', 'ops', 'support', 'finance', 'read_only')
  );
$$;

-- Keep the legacy is_admin() working (now: super_admin only) so nothing
-- that already calls it changes behavior — 'admin' no longer exists as
-- a role value, so this must be re-pointed at 'super_admin' to keep working.
create or replace function public.is_admin(user_id uuid)
returns boolean language plpgsql security definer as $$
begin
  return exists (
    select 1 from public.profiles
    where profiles.user_id = is_admin.user_id
      and role = 'super_admin'
  );
end;
$$;

-- Re-point the existing "Admins can view all X" policies at the wider
-- internal-staff check — every internal role needs read access to do
-- their job, even though only some of them can write.
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles for select
using (is_admin_role(auth.uid()));

drop policy if exists "Admins can view all posts" on public.blog_posts;
create policy "Admins can view all posts"
on public.blog_posts for select
using (is_admin_role(auth.uid()));

drop policy if exists "Admins can view all content plans" on public.content_plans;
create policy "Admins can view all content plans"
on public.content_plans for select
using (is_admin_role(auth.uid()));

drop policy if exists "Admins can view all serp analyses" on public.serp_analyses;
create policy "Admins can view all serp analyses"
on public.serp_analyses for select
using (is_admin_role(auth.uid()));

do $$
begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'subscriptions') then
    execute 'drop policy if exists "Admins can view all subscriptions" on public.subscriptions';
    execute 'create policy "Admins can view all subscriptions" on public.subscriptions for select using (is_admin_role(auth.uid()))';
  end if;
end $$;

do $$
begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'publishing_logs') then
    execute 'drop policy if exists "Admins can view all publishing logs" on public.publishing_logs';
    execute 'create policy "Admins can view all publishing logs" on public.publishing_logs for select using (is_admin_role(auth.uid()))';
  end if;
end $$;

-- ============================================================
-- audit_logs — who did what, when, on which entity. Foundation for
-- the Audit & Security tab; every sensitive admin-portal action
-- (role changes, suspensions, plan changes, impersonation, ...)
-- should call logAdminAction() (src/lib/audit.ts) after it succeeds.
-- ============================================================
create table if not exists public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  actor_role    text not null,
  action        text not null,
  entity_type   text not null,
  entity_id     text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.audit_logs is 'Every sensitive admin-portal action, for the Audit & Security tab.';
comment on column public.audit_logs.action is 'e.g. role_changed, org_suspended, plan_changed, user_impersonated';

alter table public.audit_logs enable row level security;

-- Any internal-staff member can read the audit trail — it's an internal
-- portal, not customer-facing, and visibility itself is a normal ops need.
create policy "Internal staff can view audit logs"
  on public.audit_logs for select
  using (is_admin_role(auth.uid()));

-- Staff can only insert rows attributed to themselves — actor_user_id
-- is never client-suppliable as someone else's id, so the log can't be
-- forged to misattribute an action to a different staff member.
create policy "Internal staff can log their own actions"
  on public.audit_logs for insert
  with check (actor_user_id = auth.uid() and is_admin_role(auth.uid()));

create index idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index idx_audit_logs_actor      on public.audit_logs (actor_user_id);
create index idx_audit_logs_entity     on public.audit_logs (entity_type, entity_id);
