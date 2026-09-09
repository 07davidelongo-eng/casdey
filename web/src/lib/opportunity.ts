import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { annualisedMinor, isRecurring, type BillingPeriod } from "./services";

/**
 * The forward figure on the Overview: roughly what the gym's currently-lapsed
 * members represent in monthly membership revenue.
 *
 * "Revenue recovered" (src/lib/revenue.ts) looks backward and is exact, summed
 * one real booking at a time. This looks forward and is an estimate, and it is
 * built to stay honest about that.
 *
 * Where the per-member number comes from, without inventing it: the gym's own
 * priced recurring memberships. Each active recurring service is reduced to a
 * monthly figure, and the MEDIAN of those is taken as "a typical membership".
 * That number is then multiplied by the count of lapsed members.
 *
 *   - It is not a value the gym typed into a box. D1 #12/#13 removed that field
 *     because an unverifiable input made casdey look useless or miraculous
 *     depending on the guess, and on Pro it created guarantee liability against
 *     a made-up number. The median here is computed from prices the gym also
 *     quotes to its own members on the booking page, so inflating it is not
 *     free.
 *   - It never touches the guarantee or "Revenue recovered". It is a display
 *     figure and nothing reads it back.
 *   - The median, not the mean: one €400 corporate plan among €40 memberships
 *     should not drag the typical figure upward.
 *
 * A gym with no recurring membership priced gets `priced: false` and the
 * Overview shows a prompt to add one rather than a fabricated number.
 */

export type LapsedOpportunity = {
  /** The gym has at least one active, recurring, priced membership. */
  priced: boolean;
  /** Median monthly value of those memberships, in minor units. */
  typicalMonthlyMinor: number;
  /** How many lapsed members the figure is spread across. */
  lapsedMembers: number;
  /** typicalMonthlyMinor × lapsedMembers. The headline. */
  monthlyMinor: number;
};

export const NO_OPPORTUNITY: LapsedOpportunity = {
  priced: false,
  typicalMonthlyMinor: 0,
  lapsedMembers: 0,
  monthlyMinor: 0,
};

/** Middle value; mean of the two middle values for an even count. Rounded. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

type ServiceRow = {
  price_minor: number | null;
  billing_period: BillingPeriod;
  billing_interval: number | null;
};

export async function lapsedOpportunity(
  supabase: SupabaseClient,
  gymId: string,
  lapsedMembers: number,
): Promise<LapsedOpportunity> {
  const { data, error } = await supabase
    .from("services")
    .select("price_minor, billing_period, billing_interval")
    .eq("gym_id", gymId)
    .eq("active", true)
    .gt("price_minor", 0);

  if (error) {
    console.error("[opportunity] services read failed", error.message);
    return { ...NO_OPPORTUNITY };
  }

  const monthlyValues = ((data ?? []) as ServiceRow[])
    .filter((service) => isRecurring(service.billing_period))
    .map((service) =>
      Math.round(
        annualisedMinor({
          price_minor: service.price_minor ?? 0,
          billing_period: service.billing_period,
          billing_interval: service.billing_interval,
        }) / 12,
      ),
    )
    .filter((value) => value > 0);

  if (monthlyValues.length === 0) return { ...NO_OPPORTUNITY };

  const typicalMonthlyMinor = median(monthlyValues);

  return {
    priced: true,
    typicalMonthlyMinor,
    lapsedMembers,
    monthlyMinor: typicalMonthlyMinor * lapsedMembers,
  };
}
