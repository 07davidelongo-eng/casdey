import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { dormancyCutoff, type DormancyRule } from "./dormancy";

/**
 * The numbers on the dashboard.
 *
 * Every one is counted in the database with `head: true`, so a practice with
 * forty thousand patients transfers a number and not forty thousand rows of
 * health-adjacent personal data. Reading less of it is both faster and the
 * right instinct.
 *
 * All queries go through the caller's own client, so row level security does
 * the tenant filtering. The explicit practice_id is belt and braces.
 */

export type PracticeStats = {
  patients: number;
  dormant: number;
  reachable: number;
  contacted: number;
  rebooked: number;
};

function base(supabase: SupabaseClient, practiceId: string) {
  return supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("practice_id", practiceId);
}

/**
 * A filter builder, not a query builder: `from()` returns something that can
 * still insert and delete, and it has no `.neq`. Derived from `base` so it
 * cannot drift.
 */
type CountQuery = ReturnType<typeof base>;

export async function practiceStats(
  supabase: SupabaseClient,
  practiceId: string,
  rule: DormancyRule,
  now: Date = new Date(),
): Promise<PracticeStats> {
  const cutoff = dormancyCutoff(rule, now);

  // The dormancy predicate, spelled out rather than routed through
  // applyDormancyFilter, because these builders are chained per query.
  const dormantOf = (query: CountQuery) =>
    query
      .neq("status", "opted_out")
      .lte("visit_count", rule.maxVisits)
      .lte("last_visit_at", cutoff);

  const [patients, dormant, reachable, contacted, rebooked] = await Promise.all(
    [
      base(supabase, practiceId),
      dormantOf(base(supabase, practiceId)),
      dormantOf(base(supabase, practiceId))
        .not("email", "is", null)
        .eq("consent_email", true),
      base(supabase, practiceId).eq("status", "contacted"),
      base(supabase, practiceId).eq("status", "reactivated"),
    ],
  );

  return {
    patients: patients.count ?? 0,
    dormant: dormant.count ?? 0,
    reachable: reachable.count ?? 0,
    contacted: contacted.count ?? 0,
    rebooked: rebooked.count ?? 0,
  };
}
