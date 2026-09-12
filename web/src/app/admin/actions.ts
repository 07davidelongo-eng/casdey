"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";
import { recordAudit } from "@/lib/audit";
import { supabaseAdmin } from "@/lib/supabase";
import { waiveTrialPenalty } from "@/lib/trial-close";

/**
 * Waives a setup fee: refunds it and records who decided to.
 *
 * $100M Money Models pg 128 treats this as part of the mechanism rather than
 * an exception to it: "I don't like billing non-starters. A small fee isn't
 * worth a 1-star review." The fee exists to get gyms set up, so the moment
 * charging one would cost more goodwill than it is worth, it should go back.
 *
 * Founder-only, checked here and not merely in the UI that calls it: a server
 * action is a public endpoint, and the form it is rendered behind is not a
 * gate.
 */
export async function waiveTrialPenaltyAction(
  formData: FormData,
): Promise<void> {
  const session = await requireAdmin();

  const feeId = formData.get("feeId");
  if (typeof feeId !== "string" || feeId.length === 0) return;

  // Read the gym before refunding, so the audit entry lands on the gym whose
  // fee this was rather than on nobody.
  const { data: fee } = await supabaseAdmin()
    .from("trial_penalties")
    .select("gym_id, step, amount_minor, currency")
    .eq("id", feeId)
    .maybeSingle();

  await waiveTrialPenalty(feeId);

  if (fee) {
    await recordAudit({
      gymId: fee.gym_id as string,
      actorId: session.userId,
      actorEmail: session.email,
      action: "trial.penalty_waived",
      target: feeId,
      meta: {
        step: fee.step,
        amount_minor: fee.amount_minor,
        currency: fee.currency,
      },
    });
  }

  revalidatePath("/admin");
}
