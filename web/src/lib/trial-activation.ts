import "server-only";

import { supabaseAdmin } from "./supabase";
import { captureServerEvent } from "./posthog-server";
import type { ActivationStep } from "./trial";

/**
 * Records that a gym finished one of the three trial activation steps.
 *
 * Called from the three places the work actually happens: the import route,
 * the services form, and campaign approval. It is deliberately fire-and-forget
 * and deliberately never throws: none of those three actions should fail
 * because a bookkeeping stamp could not be written. The trial logic reads
 * these stamps alongside the live state for exactly that reason, so a lost
 * write costs the accuracy of a timestamp and never costs a gym money. See
 * activationFor() in ./trial.ts.
 *
 * Written once and never overwritten: the first time is when the gym
 * activated, and the make-good refund measures against that date.
 */
const COLUMN: Record<ActivationStep, string> = {
  import: "activated_import_at",
  prices: "activated_prices_at",
  campaign: "activated_campaign_at",
};

export async function stampActivation(
  gymId: string,
  step: ActivationStep,
): Promise<void> {
  const column = COLUMN[step];

  try {
    // `.is(column, null)` is what makes this first-write-wins without reading
    // first, so a second import cannot move the date forward. `.select()`
    // then reports whether a row actually changed, which is the difference
    // between "the gym just activated" and "the gym imported again": without
    // it the event below would fire on every subsequent import and the
    // activation funnel would count the same step over and over.
    const { data, error } = await supabaseAdmin()
      .from("gyms")
      .update({ [column]: new Date().toISOString() })
      .eq("id", gymId)
      .is(column, null)
      .select("id");

    if (error) {
      console.error(`[trial] could not stamp ${step}`, error.message);
      return;
    }
    if (!data || data.length === 0) return; // Already stamped. Nothing new.
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[trial] could not stamp ${step}`, detail);
    return;
  }

  // Activation is the funnel V1.1 exists to move, and it was invisible: the
  // only signal was a gym signing up and then never appearing again.
  await captureServerEvent(gymId, "trial_step_completed", { step });
}
