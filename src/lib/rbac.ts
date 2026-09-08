/**
 * Internal-staff RBAC for the admin portal.
 *
 * Regular product users have profiles.role === "user" and never reach
 * this module. These five roles are for BlitzNova staff operating the
 * admin portal (see supabase/migrations/20260611000000_rbac_and_audit_logs.sql).
 */

export type AdminRole = "super_admin" | "ops" | "support" | "finance" | "read_only";

export const ADMIN_ROLES: AdminRole[] = ["super_admin", "ops", "support", "finance", "read_only"];

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  ops: "Ops",
  support: "Support",
  finance: "Finance",
  read_only: "Read Only",
};

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return !!role && (ADMIN_ROLES as string[]).includes(role);
}

export type AdminAction =
  | "view_admin_portal"
  | "manage_users"          // suspend account, reset password
  | "manage_roles"          // grant/revoke internal staff roles — more sensitive than manage_users
  | "manage_organizations"  // suspend org, change plan, add credits
  | "manage_billing"        // refunds, invoices
  | "manage_support"        // tickets
  | "manage_feature_flags"
  | "impersonate_user"
  | "export_data"
  | "view_audit_logs";

// Which internal roles may perform each action. super_admin is included
// everywhere deliberately (not an implicit wildcard) so the full grant
// list is always visible at the call site.
const PERMISSIONS: Record<AdminAction, AdminRole[]> = {
  view_admin_portal:    ["super_admin", "ops", "support", "finance", "read_only"],
  manage_users:         ["super_admin", "ops"],
  manage_roles:         ["super_admin"],
  manage_organizations: ["super_admin", "ops"],
  manage_billing:       ["super_admin", "finance"],
  manage_support:       ["super_admin", "ops", "support"],
  manage_feature_flags: ["super_admin", "ops"],
  impersonate_user:     ["super_admin"],
  export_data:          ["super_admin", "ops", "finance"],
  view_audit_logs:      ["super_admin", "ops", "support", "finance", "read_only"],
};

/** True if `role` is an internal-staff role permitted to perform `action`. */
export function can(role: string | null | undefined, action: AdminAction): boolean {
  if (!isAdminRole(role)) return false;
  return PERMISSIONS[action].includes(role);
}
