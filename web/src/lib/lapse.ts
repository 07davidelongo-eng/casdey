import type { Member, Gym } from "./types";

/**
 * What "lapsed" means.
 *
 * This is the product in one function: a member who came a couple of times and
 * then stopped. Everything else, the dashboard counts, the campaign audience,
 * the members list, is a view onto this rule, so it is defined once, here, and
 * never re-expressed in SQL or in a component.
 *
 * It is deliberately not stored as a flag on the member row. A gym that
 * widens its window from 12 months to 9 would otherwise be reading stale
 * booleans until something recomputed them. Derived at read time, always
 * correct.
 */

export type LapseUnit = "months" | "days";

export type LapseRule = {
  /**
   * The quiet window, in the unit the gym actually thinks in. A traditional
   * gym says "a year"; a studio selling 10-class packs knows someone is gone
   * after six weeks, and rounding that to "two months" is not the same rule.
   */
  window: { value: number; unit: LapseUnit };
  /**
   * The visit ceiling, or null when the gym has switched it off. Null is not
   * "zero" and not "unlimited by default": it is a gym saying the number of
   * times somebody came is none of the rule's business.
   */
  maxVisits: number | null;
};

/**
 * gyms.lapsed_after_days overrides gyms.lapsed_after_months when it is set.
 * Two columns for one window is not elegant, and it is deliberate: local
 * development and production share one database, so the days column had to
 * arrive without disturbing what the deployed app was already reading. See
 * supabase/migrations/0022_lapse_rule_flexibility.sql.
 */
export function ruleFor(gym: Gym): LapseRule {
  return {
    window:
      gym.lapsed_after_days != null
        ? { value: gym.lapsed_after_days, unit: "days" }
        : { value: gym.lapsed_after_months, unit: "months" },
    maxVisits: gym.max_visits,
  };
}

/** The window in days, for anything that needs to compare two windows. */
export function windowInDays(rule: LapseRule): number {
  return rule.window.unit === "days"
    ? rule.window.value
    : rule.window.value * 30;
}

/**
 * The rule as a gym owner would say it out loud.
 *
 * Four screens were building this sentence themselves, which is four chances
 * for the dashboard to describe a rule the campaign audience is not using.
 */
export function describeRule(rule: LapseRule): string {
  const { value, unit } = rule.window;
  const window = `no visit for ${value} ${
    value === 1 ? unit.slice(0, -1) : unit
  }`;
  if (rule.maxVisits == null) return window;
  const visits = rule.maxVisits === 1 ? "visit" : "visits";
  return `${window}, and at most ${rule.maxVisits} ${visits} on record`;
}

/**
 * The date on or before which a last visit counts as lapsed.
 *
 * Month arithmetic is done by hand because JavaScript rolls overflow forward:
 * 31 March minus one month is 31 February, which Date silently turns into
 * 2 or 3 March. Clamping to the last day of the target month is what a person
 * means by "a month ago".
 */
export function lapseCutoff(
  rule: LapseRule,
  now: Date = new Date(),
): string {
  // Days are simple subtraction and must stay that way. Converting 45 days
  // into "one and a half months" and then doing calendar arithmetic would
  // land on a different date depending on the month, which is exactly the
  // imprecision a gym choosing days is trying to avoid.
  if (rule.window.unit === "days") {
    const cutoff = new Date(now.getTime());
    cutoff.setUTCDate(cutoff.getUTCDate() - rule.window.value);
    return cutoff.toISOString().slice(0, 10);
  }

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();

  const targetMonthIndex = month - rule.window.value;
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

type LapseInput = Pick<
  Member,
  "last_visit_at" | "visit_count" | "status"
>;

export function isLapsed(
  member: LapseInput,
  rule: LapseRule,
  now: Date = new Date(),
): boolean {
  // Somebody who asked us to stop is never lapsed. They are done.
  if (member.status === "opted_out") return false;
  if (!member.last_visit_at) return false;
  if (rule.maxVisits != null && member.visit_count > rule.maxVisits) {
    return false;
  }

  return member.last_visit_at.slice(0, 10) <= lapseCutoff(rule, now);
}

type ContactableInput = LapseInput &
  Pick<Member, "email" | "consent_email">;

/**
 * Lapsed is not the same as reachable. A member with no email address still
 * counts in the dashboard total, because the gym may want to ring them,
 * but they can never be added to an email campaign.
 */
export function isContactable(member: ContactableInput): boolean {
  return Boolean(member.email) && member.consent_email;
}

export function isLapsedAndContactable(
  member: ContactableInput,
  rule: LapseRule,
  now: Date = new Date(),
): boolean {
  return isLapsed(member, rule, now) && isContactable(member);
}

/**
 * The same rule expressed as PostgREST filters, so a count does not mean
 * pulling every member into memory.
 *
 * Kept next to `isLapsed` on purpose: if one changes and the other does not,
 * the dashboard and the campaign audience quietly disagree about who is
 * lapsed, and nobody notices until the wrong people are emailed.
 */
export type FilterableQuery<T> = {
  lte(column: string, value: string | number): T;
  neq(column: string, value: string): T;
};

/**
 * The visit ceiling as a number a query can always compare against.
 *
 * A gym with the ceiling switched off needs the filter to match everyone, and
 * `null` cannot express that: PostgREST would send `visit_count=lte.null`,
 * which matches nobody, so the gym that widened its rule would see an empty
 * list. Branching the chain instead is possible but sends the compiler into
 * an excessively-deep instantiation in campaigns.ts (see the note there), so
 * every caller uses int4's own ceiling, which no visit_count can exceed.
 */
export const VISIT_CEILING_OFF = 2_147_483_647;

export function visitCeiling(rule: LapseRule): number {
  return rule.maxVisits ?? VISIT_CEILING_OFF;
}

export function applyLapseFilter<T extends FilterableQuery<T>>(
  query: T,
  rule: LapseRule,
  now: Date = new Date(),
): T {
  return query
    .neq("status", "opted_out")
    .lte("visit_count", visitCeiling(rule))
    .lte("last_visit_at", lapseCutoff(rule, now));
}

/**
 * What "at risk" means.
 *
 * Same recency signal as lapse, just an earlier, configurable window, and
 * only for members nobody has touched yet (status still 'active'). The
 * gyms_at_risk_before_lapse DB constraint guarantees atRiskAfterDays is
 * strictly shorter than the lapse window, so this range and isLapsed's never
 * overlap, a member is one or the other, never both.
 *
 * Deliberately NOT capped by rule.maxVisits, unlike isLapsed. The visit cap
 * exists to keep win-back aimed at people who tried the place and drifted,
 * rather than at long-standing members. A check-in is the opposite errand: a
 * regular of five years going quiet for six weeks is the single most valuable
 * person to catch, and capping them out made the settings copy a lie. So
 * AtRiskRule still carries maxVisits (it shares LapseRule, and lapseCutoff
 * needs the window), and at-risk simply never reads it.
 */

export type AtRiskRule = LapseRule & { atRiskAfterDays: number };

export function atRiskRuleFor(gym: Gym): AtRiskRule {
  return { ...ruleFor(gym), atRiskAfterDays: gym.at_risk_after_days };
}

export function atRiskCutoff(rule: AtRiskRule, now: Date = new Date()): string {
  const cutoff = new Date(now.getTime() - rule.atRiskAfterDays * 86_400_000);
  return cutoff.toISOString().slice(0, 10);
}

export function isAtRisk(
  member: LapseInput,
  rule: AtRiskRule,
  now: Date = new Date(),
): boolean {
  // Only members nobody has campaigned yet: already contacted, returned or
  // opted out means this is not "before cancelling" any more.
  if (member.status !== "active") return false;
  if (!member.last_visit_at) return false;

  const lastVisit = member.last_visit_at.slice(0, 10);
  return lastVisit > lapseCutoff(rule, now) && lastVisit <= atRiskCutoff(rule, now);
}

export function applyAtRiskFilter<
  T extends {
    eq(column: string, value: string): T;
    lte(column: string, value: string | number): T;
    gt(column: string, value: string | number): T;
  },
>(query: T, rule: AtRiskRule, now: Date = new Date()): T {
  return query
    .eq("status", "active")
    .gt("last_visit_at", lapseCutoff(rule, now))
    .lte("last_visit_at", atRiskCutoff(rule, now));
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
