import "server-only";

import { supabaseAdmin } from "./supabase";
import type { Practice } from "./types";

/**
 * The practice's stand-in for itself: roadmap #4, "send yourself a test".
 *
 * A test send has to go through the real pipeline (composeBody, the
 * configured provider, a real unsubscribe token) or it proves nothing, and
 * that pipeline is built around a patient row. Rather than special-case a
 * patient-less send everywhere, one synthetic patient per practice plays the
 * part, flagged `is_test` so every real query (dormancy stats, the patient
 * list, campaign audiences, CSV export) can filter it back out.
 *
 * Reused across every test send: the fixed external_ref makes this an upsert,
 * not a new row each time. `last_visit_at` and `visit_count` are set so it
 * reliably reads as dormant under the practice's own rule, whatever that
 * currently is.
 */

const TEST_EXTERNAL_REF = "__self_test__";
const TEST_WHATSAPP_EXTERNAL_REF = "__self_test_whatsapp__";

export type TestPatient = {
  id: string;
  first_name: string | null;
  last_visit_at: string | null;
  booking_token: string;
};

export async function ensureTestPatient(
  practice: Practice,
  email: string,
): Promise<TestPatient> {
  const client = supabaseAdmin();

  const lastVisit = new Date();
  lastVisit.setUTCMonth(
    lastVisit.getUTCMonth() - (practice.dormant_after_months + 1),
  );

  const { data, error } = await client
    .from("patients")
    .upsert(
      {
        practice_id: practice.id,
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
      { onConflict: "practice_id,external_ref" },
    )
    .select("id, first_name, last_visit_at, booking_token")
    .single();

  if (error || !data) {
    // The one realistic way this upsert can fail on its own conflict target:
    // the tester's email is already on file as an actual patient's address
    // (the practice owner is, unusually, also their own patient). Surfacing
    // that plainly beats a generic failure.
    if (error?.code === "23505") {
      throw new Error(
        "That address is already on your patient list, so a test cannot use it. Try a different inbox you have access to.",
      );
    }
    throw new Error(`could not prepare test patient: ${error?.message}`);
  }

  // A previous test may have exercised the unsubscribe link on purpose. Clear
  // it so this send is not quietly suppressed by the practice's own trial.
  await client
    .from("suppressions")
    .delete()
    .eq("practice_id", practice.id)
    .eq("email", email.toLowerCase());

  return data as TestPatient;
}

/**
 * The WhatsApp counterpart to ensureTestPatient. A separate synthetic row
 * (its own fixed external_ref), not a reuse of the email one: the phone
 * number a practice tests with is typed fresh each time rather than read off
 * the signed-in session, and keeping the rows apart means a WhatsApp test
 * can never overwrite the email test patient's address, or vice versa.
 */
export async function ensureTestWhatsAppPatient(
  practice: Practice,
  phone: string,
): Promise<TestPatient> {
  const client = supabaseAdmin();

  const lastVisit = new Date();
  lastVisit.setUTCMonth(
    lastVisit.getUTCMonth() - (practice.dormant_after_months + 1),
  );

  const { data, error } = await client
    .from("patients")
    .upsert(
      {
        practice_id: practice.id,
        external_ref: TEST_WHATSAPP_EXTERNAL_REF,
        first_name: null,
        last_name: null,
        phone,
        last_visit_at: lastVisit.toISOString().slice(0, 10),
        visit_count: 1,
        // Reset on every test, same reasoning as ensureTestPatient: an
        // earlier test of the STOP opt-out must not silently suppress the
        // next one.
        status: "active",
        consent_whatsapp: true,
        is_test: true,
        source: "test",
      },
      { onConflict: "practice_id,external_ref" },
    )
    .select("id, first_name, last_visit_at, booking_token")
    .single();

  if (error || !data) {
    // The one realistic way this upsert can fail on its own conflict target:
    // the tester's number is already on file as an actual patient's number
    // (the practice owner is, unusually, also their own patient).
    if (error?.code === "23505") {
      throw new Error(
        "That number is already on your patient list, so a test cannot use it. Try a different number you have access to.",
      );
    }
    throw new Error(`could not prepare test patient: ${error?.message}`);
  }

  // A previous test may have exercised the STOP opt-out on purpose. Clear it
  // so this send is not quietly suppressed by the practice's own trial.
  await client
    .from("whatsapp_suppressions")
    .delete()
    .eq("practice_id", practice.id)
    .eq("phone", phone);

  return data as TestPatient;
}
