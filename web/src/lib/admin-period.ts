import "server-only";

/**
 * Date-bucket maths shared by the two /admin data modules (admin-stats.ts for
 * casdey's own tables, posthog-query.ts for PostHog). Kept in its own file so
 * posthog-query does not have to import admin-stats (which pulls in the Stripe
 * SDK) just to line its visitor chart up with the signup chart.
 *
 * The period itself — how a URL like `?range=30d` becomes a day count — lives
 * in src/app/admin/parts.tsx, which is client-safe. This file only turns a
 * resolved `{ days, bucket }` into a gap-free list of anchors.
 */

/** Monday of the week containing this date, in UTC. */
export function weekStartOf(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

/** Midnight UTC of this date. */
export function startOfDayUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "5 Sept" — reads fine for both a day and a week-starting-Monday. */
export const DATE_LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export type PeriodPoint = { key: string; label: string };

/**
 * A gap-free list of bucket anchors covering the window AND the equal window
 * immediately before it, oldest first. `perSide` is how many anchors belong to
 * each half, so a caller slices `all.slice(perSide)` for "now" and
 * `all.slice(0, perSide)` for "before".
 */
export function periodBuckets(
  days: number,
  bucket: "day" | "week",
  now: Date = new Date(),
): { all: PeriodPoint[]; perSide: number } {
  const stepDays = bucket === "day" ? 1 : 7;
  const perSide = bucket === "day" ? days : Math.ceil(days / 7);
  const total = perSide * 2;
  const anchor = bucket === "day" ? startOfDayUTC(now) : weekStartOf(now);
  const from = new Date(anchor);
  from.setUTCDate(from.getUTCDate() - (total - 1) * stepDays);

  const all: PeriodPoint[] = [];
  for (let i = 0; i < total; i += 1) {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() + i * stepDays);
    all.push({ key: dayKey(d), label: DATE_LABEL.format(d) });
  }
  return { all, perSide };
}

/** Which bucket key an ISO timestamp falls into, in the same key space
 *  `periodBuckets` uses. */
export function bucketKeyFor(iso: string, bucket: "day" | "week"): string {
  const d = new Date(iso);
  return bucket === "day" ? dayKey(startOfDayUTC(d)) : dayKey(weekStartOf(d));
}
