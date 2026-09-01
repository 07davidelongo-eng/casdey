import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyAtRiskFilter,
  lapseCutoff,
  type AtRiskRule,
  type LapseRule,
} from "./lapse";

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
      .lte("visit_count", rule.maxVisits)
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
