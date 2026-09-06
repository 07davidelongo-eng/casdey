import "server-only";

import { supabaseAdmin } from "../supabase";

/**
 * How casdey learns that somebody actually came back.
 *
 * Until now it knew exactly two things: a member booked through casdey's own
 * link, or a staff member ticked them by hand. Both are real, and between them
 * they miss the most ordinary way a win-back ends, which is that the member
 * reads the message, turns up on Thursday, and nobody tells casdey anything.
 * Those returns were invisible, which made the dashboard understate the one
 * number the product is judged on.
 *
 * The signal is already in the gym's own data. A member casdey wrote to, whose
 * last visit has since moved to a date AFTER casdey wrote, came back. The gym's
 * own system says so. That matters more than it sounds: on Pro the guarantee
 * pays real money out against these numbers, and evidence from the customer's
 * records is worth more in that conversation than anything casdey could assert
 * about itself.
 *
 * Deliberately separate from upsertMembers. That function's contract is that
 * it writes only the columns an import owns and never touches status, so a
 * re-import cannot resurrect somebody who unsubscribed. Return detection is a
 * different judgement made after the facts have landed, and keeping it out of
 * the upsert keeps that promise intact and readable.
 */

export type ReturnCandidate = {
  id: string;
  status: string;
  contacted_at: string | null;
  last_visit_at: string | null;
};

/**
 * The rule, on its own, so it can be tested without a database.
 *
 * Three conditions, and each one is doing work:
 *
 *   - status is 'contacted'. Not 'active' (nobody wrote to them, so their
 *     visit proves nothing about casdey), not 'returned' (already counted),
 *     and never 'opted_out', because somebody who asked us to stop is not a
 *     win to claim.
 *   - there is a contact date to compare against.
 *   - the last visit is strictly after the day casdey wrote. Same-day is
 *     excluded on purpose: a member who came in the morning and was written to
 *     that afternoon did not come back because of the message, and a
 *     guarantee that counts them is a guarantee casdey cannot defend.
 */
export function hasReturnedSinceContact(member: ReturnCandidate): boolean {
  if (member.status !== "contacted") return false;
  if (!member.contacted_at || !member.last_visit_at) return false;
  return member.last_visit_at.slice(0, 10) > member.contacted_at.slice(0, 10);
}

export type ReturnSweep = {
  /** Members newly marked returned by this sweep. */
  returned: number;
  ids: string[];
};

/**
 * Look at everyone this gym has written to, and mark the ones whose visits
 * have moved on.
 *
 * Runs over every contacted member rather than only the rows in this file,
 * because the condition is a fact about the member, not about the upload, and
 * a gym that imports a partial list should not get a partial answer. The set is
 * small by construction: only members casdey has actually written to.
 *
 * Comparison happens here rather than in the query because PostgREST cannot
 * compare two columns of the same row against each other.
 */
export async function detectReturnsFromVisits(
  gymId: string,
  now: Date = new Date(),
): Promise<ReturnSweep> {
  const client = supabaseAdmin();

  const { data, error } = await client
    .from("members")
    .select("id, status, contacted_at, last_visit_at")
    .eq("gym_id", gymId)
    .eq("is_test", false)
    .eq("status", "contacted")
    .not("contacted_at", "is", null)
    .not("last_visit_at", "is", null);

  if (error) {
    throw new Error(`return sweep failed: ${error.code} ${error.message}`);
  }

  const returned = (data ?? []).filter((member) =>
    hasReturnedSinceContact(member as ReturnCandidate),
  ) as ReturnCandidate[];

  if (returned.length === 0) return { returned: 0, ids: [] };

  const stamp = now.toISOString();

  // Updated in one statement per member rather than one bulk update, because
  // returned_at is the member's own visit date, not the moment the sweep ran.
  // A gym importing three months of history at once would otherwise have every
  // return share a timestamp and the "most recent return" card would be
  // meaningless.
  for (const member of returned) {
    const visitedAt = `${member.last_visit_at!.slice(0, 10)}T12:00:00.000Z`;
    await client
      .from("members")
      .update({
        status: "returned",
        // Never in the future, however odd the export's dates are.
        returned_at: visitedAt > stamp ? stamp : visitedAt,
      })
      .eq("id", member.id)
      // Re-checked in the write itself: two imports running at once must not
      // both claim the same member.
      .eq("status", "contacted");
  }

  await client.from("member_events").insert(
    returned.map((member) => ({
      gym_id: gymId,
      member_id: member.id,
      type: "returned",
      meta: {
        source: "import",
        last_visit_at: member.last_visit_at,
        contacted_at: member.contacted_at,
      },
    })),
  );

  return { returned: returned.length, ids: returned.map((m) => m.id) };
}
