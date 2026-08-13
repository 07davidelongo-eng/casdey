"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";

export type AgreementState = { error: string | null };

/**
 * Records that the practice has confirmed it is the data controller for the
 * patients it is about to upload, and that it has a lawful basis to contact
 * them.
 *
 * This gate is the reason /api/import refuses to accept a file until it is set.
 * casdey processes this data on the practice's instructions; without the
 * practice saying so, we are processing health-adjacent personal data on no
 * stated basis at all.
 */
export async function agreeToProcessingAction(
  _previous: AgreementState,
  formData: FormData,
): Promise<AgreementState> {
  const { practice, session } = await requireOwner();

  if (formData.get("confirm") !== "yes") {
    return { error: "Tick the box to confirm before importing patients." };
  }

  const { error } = await supabaseAdmin()
    .from("practices")
    .update({
      processing_agreed_at: new Date().toISOString(),
      processing_agreed_by: session.userId,
    })
    .eq("id", practice.id);

  if (error) {
    console.error("[import] agreement failed", error.message);
    return { error: "We could not record that. Try again." };
  }

  await recordAudit({
    practiceId: practice.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "processing.agreed",
  });

  revalidatePath("/app/import");
  return { error: null };
}
