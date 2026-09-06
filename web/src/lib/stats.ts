import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyAtRiskFilter,
  lapseCutoff,
  visitCeiling,
  type AtRiskRule,
  type LapseRule,
} from "./lapse";
import {
  annualisedMinor,
  isRecurring,
  type BillingPeriod,
} from "./services";

/**
 * The numbers on the dashboard.
 *
 * Every one is counted in the database with `head: true`, so a gym with
 * forty thousand members transfers a number and not forty thousand rows of
 * health-adjacent personal data. Reading less of it is both faster and the
 * right instinct.
 *
 * All queries go through the caller's own client, so row level security does
 * the tenant filtering. The explicit gym_id is belt and braces.
 */

export type GymStats = {
  members: number;
  lapsed: number;
  atRisk: number;
  reachable: number;
  contacted: number;
  returned: number;
};

function base(supabase: SupabaseClient, gymId: string) {
  return supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gymId)
    // The gym's own self-test member (see ./self-test.ts) is not a real
    // member and must never count toward its own numbers.
    .eq("is_test", false);
}

/**
 * A filter builder, not a query builder: `from()` returns something that can
 * still insert and delete, and it has no `.neq`. Derived from `base` so it
 * cannot drift.
 */
type CountQuery = ReturnType<typeof base>;

export async function gymStats(
  supabase: SupabaseClient,
  gymId: string,
  rule: LapseRule,
  atRiskRule: AtRiskRule,
  now: Date = new Date(),
): Promise<GymStats> {
  const cutoff = lapseCutoff(rule, now);

  // The lapse predicate, spelled out rather than routed through
  // applyLapseFilter, because these builders are chained per query.
  const lapsedOf = (query: CountQuery) =>
    query
      .neq("status", "opted_out")
      .lte("visit_count", visitCeiling(rule))
      .lte("last_visit_at", cutoff);

  const [members, lapsed, atRisk, reachable, contacted, returned] =
    await Promise.all([
      base(supabase, gymId),
      lapsedOf(base(supabase, gymId)),
      applyAtRiskFilter(base(supabase, gymId), atRiskRule, now),
      lapsedOf(base(supabase, gymId))
        .not("email", "is", null)
        .eq("consent_email", true),
      base(supabase, gymId).eq("status", "contacted"),
      base(supabase, gymId).eq("status", "returned"),
    ]);

  return {
    members: members.count ?? 0,
    lapsed: lapsed.count ?? 0,
    atRisk: atRisk.count ?? 0,
    reachable: reachable.count ?? 0,
    contacted: contacted.count ?? 0,
    returned: returned.count ?? 0,
  };
}

/**
 * What the recovered revenue is actually made of.
 *
 * The headline figure on the dashboard multiplies returns by one typical
 * booking value, which is fine as an estimate and says nothing about the shape
 * of the money. A gym that wins back thirty members on monthly memberships and
 * a gym that sells thirty single sessions have the same headline and
 * completely different businesses.
 *
 * Computed from real bookings, not from the typical-value setting, so it is
 * independent of that number and stays true whatever happens to it. Bookings
 * with no service attached are counted in the total and cannot be classified,
 * which is honest: casdey does not know what they were.
 */
export type RecoveredBreakdown = {
  /** Real booked value, in minor units. */
  totalMinor: number;
  recurringMinor: number;
  oneOffMinor: number;
  /** Recurring bookings projected over a year. An estimate, labelled as one. */
  annualisedRecurringMinor: number;
  bookings: number;
  /** Bookings casdey could not classify, because no service was picked. */
  unclassified: number;
};

export async function recoveredBreakdown(
  client: SupabaseClient,
  gymId: string,
): Promise<RecoveredBreakdown> {
  const { data } = await client
    .from("bookings")
    .select("value_minor, services (billing_period)")
    .eq("gym_id", gymId)
    .in("status", ["booked", "completed"]);

  // PostgREST types an embedded one-to-one as an array, so it is normalised
  // here rather than trusted either way.
  const rows = (data ?? []) as unknown as {
    value_minor: number | null;
    services:
      | { billing_period: BillingPeriod }
      | { billing_period: BillingPeriod }[]
      | null;
  }[];

  const empty: RecoveredBreakdown = {
    totalMinor: 0,
    recurringMinor: 0,
    oneOffMinor: 0,
    annualisedRecurringMinor: 0,
    bookings: 0,
    unclassified: 0,
  };

  return rows.reduce((acc, row) => {
    const value = row.value_minor ?? 0;
    acc.bookings += 1;
    acc.totalMinor += value;

    const embedded = Array.isArray(row.services)
      ? (row.services[0] ?? null)
      : row.services;
    const period = embedded?.billing_period;
    if (!period) {
      acc.unclassified += 1;
      return acc;
    }

    if (isRecurring(period)) {
      acc.recurringMinor += value;
      acc.annualisedRecurringMinor += annualisedMinor({
        price_minor: value,
        billing_period: period,
      });
    } else {
      acc.oneOffMinor += value;
    }
    return acc;
  }, empty);
}
