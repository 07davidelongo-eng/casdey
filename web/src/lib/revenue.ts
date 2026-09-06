import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isRecurring, type BillingPeriod } from "./services";

/**
 * What casdey actually recovered, added up one booking at a time.
 *
 * This replaces a flat "typical value of a recovered member" the gym typed
 * into settings, multiplied by how many members came back. Davide killed that
 * number for two good reasons, from the D1 walkthrough (#12 and #13).
 *
 * The first is that it was a lie waiting to happen. A gym that types 10 when
 * its membership is 100 makes casdey look useless; one that types 500 makes it
 * look like a miracle and, on Pro, makes casdey liable for a shortfall against
 * a figure it had no way to check. A promise about money cannot be measured
 * against a number one side of the deal invented.
 *
 * The second is that it was never the truth anyway. A gym does not recover
 * "an average member". It recovers Marco on a 50 euro monthly membership, Sara
 * for one 20 euro yoga class, and somebody else for a 30 euro aquagym session,
 * and that is 100 euros, not three times an average of anything.
 *
 * So the figure is now the sum of what was really booked, each booking valued
 * at the price of the service it was for, frozen at the moment it was booked
 * (bookings.value_minor). And the prices those come from are the same ones
 * members read on the booking page when they pick a time, which is the part
 * that makes the whole thing self-policing: a gym that inflates its prices to
 * flatter its casdey dashboard is quoting those prices to its own members.
 *
 * A booking with no service attached is worth nothing here rather than being
 * guessed at, and is counted separately so the gap is visible instead of
 * silently depressing the number.
 */

export type RecoveredRevenue = {
  totalMinor: number;
  recurringMinor: number;
  oneOffMinor: number;
  /** Recurring bookings projected over a year. An estimate, labelled as one. */
  annualisedRecurringMinor: number;
  bookings: number;
  /** Booked, but with no service picked, so casdey cannot say what it was worth. */
  unpriced: number;
};

export const NO_REVENUE: RecoveredRevenue = {
  totalMinor: 0,
  recurringMinor: 0,
  oneOffMinor: 0,
  annualisedRecurringMinor: 0,
  bookings: 0,
  unpriced: 0,
};

const PER_YEAR: Record<BillingPeriod, number> = {
  one_off: 1,
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
  biannual: 2,
  annual: 1,
};

type BookingRow = {
  value_minor: number | null;
  services:
    | { billing_period: BillingPeriod }
    | { billing_period: BillingPeriod }[]
    | null;
};

function tally(rows: BookingRow[]): RecoveredRevenue {
  return rows.reduce<RecoveredRevenue>(
    (acc, row) => {
      const value = row.value_minor ?? 0;
      // PostgREST types an embedded one-to-one as an array.
      const service = Array.isArray(row.services)
        ? (row.services[0] ?? null)
        : row.services;

      acc.bookings += 1;

      if (!service || value <= 0) {
        acc.unpriced += 1;
        return acc;
      }

      acc.totalMinor += value;

      if (isRecurring(service.billing_period)) {
        acc.recurringMinor += value;
        acc.annualisedRecurringMinor += value * PER_YEAR[service.billing_period];
      } else {
        acc.oneOffMinor += value;
      }
      return acc;
    },
    { ...NO_REVENUE },
  );
}

/**
 * Everything a gym has recovered, all time. The dashboard figure.
 *
 * Anchored on when the booking was MADE, not when the session happens: casdey
 * recovered that member the day they booked, and a class three months out is
 * still a member who came back this week.
 */
export async function recoveredRevenue(
  supabase: SupabaseClient,
  gymId: string,
  window?: { from: Date; to: Date },
): Promise<RecoveredRevenue> {
  let query = supabase
    .from("bookings")
    .select("value_minor, services (billing_period)")
    .eq("gym_id", gymId)
    .in("status", ["booked", "completed"]);

  if (window) {
    query = query
      .gte("created_at", window.from.toISOString())
      .lte("created_at", window.to.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error("[revenue] read failed", error.message);
    return { ...NO_REVENUE };
  }

  return tally((data ?? []) as unknown as BookingRow[]);
}

/**
 * Whether casdey is in a position to say what anything was worth at all.
 *
 * The guard the old typed value needed, kept and redefined. A gym that has
 * never priced a single service has a recovered figure of zero for reasons
 * that have nothing to do with whether casdey worked, and a zero must not
 * hand them an automatic refund. A shortfall there routes to review instead.
 */
export async function hasPricedServices(
  supabase: SupabaseClient,
  gymId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gymId)
    .eq("active", true)
    .gt("price_minor", 0);

  return (count ?? 0) > 0;
}
