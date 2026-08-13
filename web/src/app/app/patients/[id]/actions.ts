"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requirePractice } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";

export type PatientActionState = { error: string | null };

/**
 * Records that a patient booked again.
 *
 * Manual on purpose. casdey sends the message, but the booking happens in the
 * practice's own diary, which casdey cannot see. Inferring a rebooking from a
 * reply would mean inventing a number, and the brand rule on that is absolute:
 * if it is not real, it does not go on the page.
 */
export async function markRebookedAction(
  _previous: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  const { practice, session } = await requirePractice();
  const patientId = String(formData.get("patientId") ?? "");
  if (!patientId) return { error: "Missing patient." };

  const now = new Date().toISOString();
  const client = supabaseAdmin();

  // practice_id in the filter is what stops one practice writing to another's
  // patient by posting a guessed id.
  const { data, error } = await client
    .from("patients")
    .update({ status: "reactivated", reactivated_at: now })
    .eq("id", patientId)
    .eq("practice_id", practice.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("[patient] rebook failed", error?.message);
    return { error: "We could not save that. Try again." };
  }

  await client.from("patient_events").insert({
    practice_id: practice.id,
    patient_id: patientId,
    type: "rebooked",
    meta: { recorded_by: session.email },
  });

  revalidatePath("/app", "layout");
  return { error: null };
}

/**
 * Erasure. Actually deletes, and cannot be undone.
 *
 * The suppression row is written first and deliberately survives: forgetting
 * that somebody asked us to stop, and then emailing them again after a
 * re-import, is the one mistake that turns a deletion request into a second
 * complaint.
 */
export async function deletePatientAction(
  _previous: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  const { practice, session } = await requirePractice();
  const patientId = String(formData.get("patientId") ?? "");
  if (!patientId) return { error: "Missing patient." };

  const client = supabaseAdmin();

  const { data: patient } = await client
    .from("patients")
    .select("email")
    .eq("id", patientId)
    .eq("practice_id", practice.id)
    .maybeSingle();

  if (patient?.email) {
    await client.from("suppressions").upsert(
      {
        practice_id: practice.id,
        email: patient.email,
        reason: "manual",
      },
      { onConflict: "practice_id,email" },
    );
  }

  const { error } = await client
    .from("patients")
    .delete()
    .eq("id", patientId)
    .eq("practice_id", practice.id);

  if (error) {
    console.error("[patient] delete failed", error.message);
    return { error: "We could not delete that record. Try again." };
  }

  await recordAudit({
    practiceId: practice.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "patient.deleted",
    target: patientId,
  });

  revalidatePath("/app", "layout");
  redirect("/app/patients?deleted=1");
}
