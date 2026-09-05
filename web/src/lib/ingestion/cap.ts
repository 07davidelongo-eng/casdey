import type { RawMember } from "./types";

/**
 * Enforces a plan's total-member cap at import time.
 *
 * The cap is on NET-NEW members, never on updates: a gym re-importing its list
 * to refresh members it already has must always go through, whatever plan it is
 * on. Only members that do not already exist (by the gym's reference, by email,
 * or by phone) count against the remaining capacity, and any beyond it are dropped
 * and reported so the gym knows to upgrade. The trial passes `limit: null` and
 * nothing is capped; Free / Standard / Pro pass 50 / 200 / 2,000.
 *
 * Pure and framework-free so the decision is unit tested directly; the import
 * route supplies the existing keys and current total from the database.
 */
export function applyImportCap(
  members: RawMember[],
  opts: {
    limit: number | null;
    /** Non-test members the gym already stores. */
    currentTotal: number;
    /** external_ref values already stored for this gym. */
    existingRefs: Set<string>;
    /** Lowercased email addresses already stored for this gym. */
    existingEmails: Set<string>;
    /** E.164 phone numbers already stored, for members with no email or ref. */
    existingPhones?: Set<string>;
  },
): { toWrite: RawMember[]; droppedNew: number } {
  if (opts.limit == null) return { toWrite: members, droppedNew: 0 };

  const isExisting = (m: RawMember): boolean =>
    (!!m.externalRef && opts.existingRefs.has(m.externalRef)) ||
    (!!m.email && opts.existingEmails.has(m.email.toLowerCase())) ||
    // Only when there is nothing better to match on: phone is the conflict key
    // for exactly those members, so without this a phone-only member counts as
    // net-new on every re-import and eats the cap again each month.
    (!m.externalRef &&
      !m.email &&
      !!m.phone &&
      Boolean(opts.existingPhones?.has(m.phone)));

  const updates: RawMember[] = [];
  const news: RawMember[] = [];
  for (const member of members) {
    (isExisting(member) ? updates : news).push(member);
  }

  const allowedNew = Math.max(0, opts.limit - opts.currentTotal);
  const keptNew = news.slice(0, allowedNew);

  return {
    toWrite: [...updates, ...keptNew],
    droppedNew: news.length - keptNew.length,
  };
}
