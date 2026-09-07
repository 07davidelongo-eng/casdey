import "server-only";

import { supabaseAdmin } from "./supabase";

/**
 * The last twelve weeks of what casdey actually did, for the dashboard (#48).
 *
 * Three counts, weekly: messages sent, members who came back, and the money
 * those returns were worth. Weekly rather than daily because a gym sends in
 * bursts and a daily chart of a 50-a-day cap is mostly zeroes; twelve because
 * it is a quarter, which is the horizon a gym owner already thinks in.
 *
 * Every series is derived from the same rows the rest of the app counts, not
 * from a summary table. There is no aggregate to drift out of step, and a
 * number on this page can always be traced to the campaign or booking that
 * produced it.
 */

export type WeekPoint = {
  /** Monday of the week, as YYYY-MM-DD. */
  weekStart: string;
  /** Short label for an axis, e.g. "14 Jul". */
  label: string;
  sent: number;
  returned: number;
  revenueMinor: number;
};

/** Monday of the week containing this date, in UTC. */
function weekStartOf(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // getUTCDay is 0 for Sunday, which is the end of the week here, not the start.
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

function key(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export async function weeklyActivity(
  gymId: string,
  weeks = 12,
  now: Date = new Date(),
): Promise<WeekPoint[]> {
  const client = supabaseAdmin();

  const thisWeek = weekStartOf(now);
  const from = new Date(thisWeek);
  from.setUTCDate(from.getUTCDate() - (weeks - 1) * 7);
  const fromIso = from.toISOString();

  // An empty week has to appear as a gap in the bars, not be missing from the
  // axis, so the buckets are built first and the rows dropped into them.
  const buckets = new Map<string, WeekPoint>();
  for (let i = 0; i < weeks; i += 1) {
    const start = new Date(from);
    start.setUTCDate(start.getUTCDate() + i * 7);
    buckets.set(key(start), {
      weekStart: key(start),
      label: LABEL.format(start),
      sent: 0,
      returned: 0,
      revenueMinor: 0,
    });
  }

  const add = (iso: string | null, field: "sent" | "returned", by = 1) => {
    if (!iso) return;
    const bucket = buckets.get(key(weekStartOf(new Date(iso))));
    if (bucket) bucket[field] += by;
  };

  const [messages, returns, bookings] = await Promise.all([
    client
      .from("campaign_messages")
      .select("sent_at")
      .eq("gym_id", gymId)
      .eq("status", "sent")
      .gte("sent_at", fromIso),
    client
      .from("members")
      .select("returned_at")
      .eq("gym_id", gymId)
      .eq("is_test", false)
      .eq("status", "returned")
      .gte("returned_at", fromIso),
    client
      .from("bookings")
      .select("created_at, value_minor, status")
      .eq("gym_id", gymId)
      .neq("status", "cancelled")
      .gte("created_at", fromIso),
  ]);

  for (const row of messages.data ?? []) {
    add(row.sent_at as string | null, "sent");
  }
  for (const row of returns.data ?? []) {
    add(row.returned_at as string | null, "returned");
  }
  for (const row of bookings.data ?? []) {
    const bucket = buckets.get(
      key(weekStartOf(new Date(row.created_at as string))),
    );
    // A booking with no service picked is worth zero rather than a guess, the
    // same rule the headline revenue figure follows. See src/lib/revenue.ts.
    if (bucket) bucket.revenueMinor += (row.value_minor as number | null) ?? 0;
  }

  return [...buckets.values()];
}

export type Totals = { sent: number; returned: number; revenueMinor: number };

export type Period = {
  weeks: WeekPoint[];
  total: Totals;
  /** The same length of time immediately before it, for comparison. */
  previous: Totals;
};

function sum(weeks: WeekPoint[]): Totals {
  return weeks.reduce(
    (acc, week) => ({
      sent: acc.sent + week.sent,
      returned: acc.returned + week.returned,
      revenueMinor: acc.revenueMinor + week.revenueMinor,
    }),
    { sent: 0, returned: 0, revenueMinor: 0 },
  );
}

/**
 * The last N weeks, and the N weeks before them.
 *
 * A number on a dashboard means very little on its own: 14 messages is good or
 * bad depending entirely on what last quarter looked like. Fetching double the
 * window and splitting it is one query's worth of work for a figure that
 * actually tells the gym something.
 */
export async function activityWithComparison(
  gymId: string,
  weeks = 12,
  now: Date = new Date(),
): Promise<Period> {
  const all = await weeklyActivity(gymId, weeks * 2, now);
  const current = all.slice(weeks);
  return {
    weeks: current,
    total: sum(current),
    previous: sum(all.slice(0, weeks)),
  };
}

/**
 * Percentage change, or null when there is nothing to compare against.
 *
 * Null rather than 100%: going from no messages to fourteen is not a 100%
 * improvement, it is the first time casdey did anything, and dressing that up
 * as a percentage is the kind of number that makes a dashboard untrustworthy.
 */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
