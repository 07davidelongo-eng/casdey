import type { Patient, Practice } from "./types";

/**
 * What "dormant" means.
 *
 * This is the product in one function: a patient who came a couple of times and
 * then stopped. Everything else, the dashboard counts, the campaign audience,
 * the patients list, is a view onto this rule, so it is defined once, here, and
 * never re-expressed in SQL or in a component.
 *
 * It is deliberately not stored as a flag on the patient row. A practice that
 * widens its window from 12 months to 9 would otherwise be reading stale
 * booleans until something recomputed them. Derived at read time, always
 * correct.
 */

export type DormancyRule = {
  dormantAfterMonths: number;
  maxVisits: number;
};

export function ruleFor(practice: Practice): DormancyRule {
  return {
    dormantAfterMonths: practice.dormant_after_months,
    maxVisits: practice.max_visits,
  };
}

/**
 * The date on or before which a last visit counts as dormant.
 *
 * Month arithmetic is done by hand because JavaScript rolls overflow forward:
 * 31 March minus one month is 31 February, which Date silently turns into
 * 2 or 3 March. Clamping to the last day of the target month is what a person
 * means by "a month ago".
 */
export function dormancyCutoff(
  rule: DormancyRule,
  now: Date = new Date(),
): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();

  const targetMonthIndex = month - rule.dormantAfterMonths;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  // Day 0 of the following month is the last day of this one.
  const lastDayOfTarget = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();

  const targetDay = Math.min(day, lastDayOfTarget);

  const mm = String(targetMonth + 1).padStart(2, "0");
  const dd = String(targetDay).padStart(2, "0");
  return `${targetYear}-${mm}-${dd}`;
}

type DormancyInput = Pick<
  Patient,
  "last_visit_at" | "visit_count" | "status"
>;

export function isDormant(
  patient: DormancyInput,
  rule: DormancyRule,
  now: Date = new Date(),
): boolean {
  // Somebody who asked us to stop is never dormant. They are done.
  if (patient.status === "opted_out") return false;
  if (!patient.last_visit_at) return false;
  if (patient.visit_count > rule.maxVisits) return false;

  return patient.last_visit_at.slice(0, 10) <= dormancyCutoff(rule, now);
}

type ContactableInput = DormancyInput &
  Pick<Patient, "email" | "consent_email">;

/**
 * Dormant is not the same as reachable. A patient with no email address still
 * counts in the dashboard total, because the practice may want to ring them,
 * but they can never be added to an email campaign.
 */
export function isContactable(patient: ContactableInput): boolean {
  return Boolean(patient.email) && patient.consent_email;
}

export function isDormantAndContactable(
  patient: ContactableInput,
  rule: DormancyRule,
  now: Date = new Date(),
): boolean {
  return isDormant(patient, rule, now) && isContactable(patient);
}

/**
 * The same rule expressed as PostgREST filters, so a count does not mean
 * pulling every patient into memory.
 *
 * Kept next to `isDormant` on purpose: if one changes and the other does not,
 * the dashboard and the campaign audience quietly disagree about who is
 * dormant, and nobody notices until the wrong people are emailed.
 */
export type FilterableQuery<T> = {
  lte(column: string, value: string | number): T;
  neq(column: string, value: string): T;
};

export function applyDormancyFilter<T extends FilterableQuery<T>>(
  query: T,
  rule: DormancyRule,
  now: Date = new Date(),
): T {
  return query
    .neq("status", "opted_out")
    .lte("visit_count", rule.maxVisits)
    .lte("last_visit_at", dormancyCutoff(rule, now));
}

/** How long they have been away, for display. Never invented, always derived. */
export function monthsSince(
  lastVisit: string | null,
  now: Date = new Date(),
): number | null {
  if (!lastVisit) return null;
  const then = new Date(`${lastVisit.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(then.getTime())) return null;

  const months =
    (now.getUTCFullYear() - then.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - then.getUTCMonth()) -
    (now.getUTCDate() < then.getUTCDate() ? 1 : 0);

  return Math.max(0, months);
}
