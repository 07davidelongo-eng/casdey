"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";

export type AgreementState = { error: string | null };

/**
 * Records that the gym has confirmed it is the data controller for the
 * members it is about to upload, and that it has a lawful basis to contact
 * them.
 *
 * This gate is the reason /api/import refuses to accept a file until it is set.
 * casdey processes this data on the gym's instructions; without the
 * gym saying so, we are processing health-adjacent personal data on no
 * stated basis at all.
 */
export async function agreeToProcessingAction(
  _previous: AgreementState,
  formData: FormData,
): Promise<AgreementState> {
  const { gym, session } = await requireOwner();

  if (formData.get("confirm") !== "yes") {
    return { error: "Tick the box to confirm before importing members." };
  }

  const { error } = await supabaseAdmin()
    .from("gyms")
    .update({
      processing_agreed_at: new Date().toISOString(),
      processing_agreed_by: session.userId,
    })
    .eq("id", gym.id);

  if (error) {
    console.error("[import] agreement failed", error.message);
    return { error: "We could not record that. Try again." };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "processing.agreed",
  });

  revalidatePath("/app/import");
  return { error: null };
}
