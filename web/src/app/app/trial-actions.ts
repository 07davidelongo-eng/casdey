"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/dal";
import { recordAudit } from "@/lib/audit";
import { cancelTrial } from "@/lib/trial-start";

/**
 * The gym opting out of its free week.
 *
 * Owner only, and deliberately a one-click action with no retention flow in
 * front of it. This is the thing that makes the setup fee fair: the fee only
 * ever reaches a gym that said nothing at all, so the way to say something has
 * to be easy to find and easy to use. A cancel button that argues with you is
 * how you end up charging people who tried to leave.
 */
export async function cancelTrialAction(): Promise<void> {
  const { gym, session } = await requireOwner();

  if (gym.trial_cancelled_at) return;

  await cancelTrial(gym.id);

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "trial.cancelled",
    meta: {},
  });

  revalidatePath("/app", "layout");
}
