import "server-only";

import { supabaseAdmin } from "./supabase";

/**
 * Accountability trail for anything that touches member data.
 *
 * GDPR asks a controller to be able to show who did what. The gym is the
 * controller, so this log is theirs: it is visible to them in settings, and it
 * is append only (the migration grants no update or delete on the table).
 *
 * Never record the member data itself here, only what happened and to which
 * record. A log of who read an email address must not itself become a second
 * copy of the email address.
 */

export type AuditAction =
  | "gym.created"
  | "gym.updated"
  | "gym.services_updated"
  | "processing.agreed"
  | "members.imported"
  | "member.deleted"
  | "members.purged"
  | "members.exported"
  | "campaign.created"
  | "campaign.test_sent"
  | "campaign.approved"
  | "campaign.paused"
  | "campaign.cancelled"
  | "member.unsubscribed"
  | "booking.settings_updated"
  | "calendar.connected"
  | "calendar.disconnected"
  | "booking.booked"
  | "booking.cancelled"
  | "billing.started"
  | "billing.updated"
  | "guarantee.claimed";

export async function recordAudit(entry: {
  gymId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  target?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("audit_log").insert({
    gym_id: entry.gymId,
    actor_id: entry.actorId ?? null,
    actor_email: entry.actorEmail ?? null,
    action: entry.action,
    target: entry.target ?? null,
    meta: entry.meta ?? {},
  });

  // Deliberately does not throw. Losing an audit line is bad, but failing a
  // gym's deletion request because the log was unreachable is worse: the
  // erasure is the legal obligation, the record of it is the evidence.
  if (error) {
    console.error("[audit] write failed", entry.action, error.message);
  }
}
