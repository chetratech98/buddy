import { supabase } from "@/integrations/supabase/client";

interface LogAdminActionInput {
  actorUserId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  // deno-lint/TS-Json-compat: kept loose since callers pass arbitrary
  // JSON-serializable shapes; the DB column itself is jsonb.
  metadata?: Record<string, unknown>;
}

/**
 * Records a sensitive admin-portal action to audit_logs.
 *
 * Fire-and-forget by design: a logging failure should never block the
 * underlying action from completing (the RBAC check already gated whether
 * it was allowed), but failures are surfaced to the console so they aren't
 * silently lost. Call this AFTER the action succeeds.
 */
export async function logAdminAction({
  actorUserId,
  actorRole,
  action,
  entityType,
  entityId,
  metadata = {},
}: LogAdminActionInput): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    actor_user_id: actorUserId,
    actor_role: actorRole,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jsonb column, generated Json type is stricter than needed here
    metadata: metadata as any,
  });
  if (error) {
    console.error("[audit] Failed to log admin action:", action, error.message);
  }
}
