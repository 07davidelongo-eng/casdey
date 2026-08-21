import "server-only";

import { supabaseAdmin } from "./supabase";
import type { Gym } from "./types";

/**
 * The gym's stand-in for itself: roadmap #4, "send yourself a test".
 *
 * A test send has to go through the real pipeline (composeBody, the
 * configured provider, a real unsubscribe token) or it proves nothing, and
 * that pipeline is built around a member row. Rather than special-case a
 * member-less send everywhere, one synthetic member per gym plays the
 * part, flagged `is_test` so every real query (lapse stats, the member
 * list, campaign audiences, CSV export) can filter it back out.
 *
 * Reused across every test send: the fixed external_ref makes this an upsert,
 * not a new row each time. `last_visit_at` and `visit_count` are set so it
 * reliably reads as lapsed under the gym's own rule, whatever that
 * currently is.
 */

const TEST_EXTERNAL_REF = "__self_test__";

export type TestMember = {
  id: string;
  first_name: string | null;
  last_visit_at: string | null;
  booking_token: string;
};

export async function ensureTestMember(
  gym: Gym,
  email: string,
): Promise<TestMember> {
  const client = supabaseAdmin();

  const lastVisit = new Date();
  lastVisit.setUTCMonth(
    lastVisit.getUTCMonth() - (gym.lapsed_after_months + 1),
  );

  const { data, error } = await client
    .from("members")
    .upsert(
      {
        gym_id: gym.id,
        external_ref: TEST_EXTERNAL_REF,
        first_name: null,
        last_name: null,
        email: email.toLowerCase(),
        last_visit_at: lastVisit.toISOString().slice(0, 10),
        visit_count: 1,
        // Reset on every test, so an earlier test of the unsubscribe link
        // cannot silently make the next test send disappear.
        status: "active",
        consent_email: true,
        is_test: true,
        source: "test",
      },
      { onConflict: "gym_id,external_ref" },
    )
    .select("id, first_name, last_visit_at, booking_token")
    .single();

  if (error || !data) {
    // The one realistic way this upsert can fail on its own conflict target:
    // the tester's email is already on file as an actual member's address
    // (the gym owner is, unusually, also their own member). Surfacing
    // that plainly beats a generic failure.
    if (error?.code === "23505") {
      throw new Error(
        "That address is already on your member list, so a test cannot use it. Try a different inbox you have access to.",
      );
    }
    throw new Error(`could not prepare test member: ${error?.message}`);
  }

  // A previous test may have exercised the unsubscribe link on purpose. Clear
  // it so this send is not quietly suppressed by the gym's own trial.
  await client
    .from("suppressions")
    .delete()
    .eq("gym_id", gym.id)
    .eq("email", email.toLowerCase());

  return data as TestMember;
}
