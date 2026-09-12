import "server-only";

import { supabaseAdmin } from "./supabase";
import { captureServerEvent } from "./posthog-server";
import { TRIAL_DAYS } from "./plan";

/**
 * Starting the free week, once the €1 has landed and a card is saved.
 *
 * The week starts HERE and not at gym creation, which is the one structural
 * difference Trial With Penalty makes to signup. The card is the commitment,
 * so the week it buys cannot begin before it exists. A gym that abandons the
 * card step is not locked out of anything it was promised: it lands on Free,
 * which can still import a list and see who has gone quiet, and the offer to
 * start the week stays open.
 *
 * Called from two places that can race each other, the Stripe webhook and the
 * browser coming back from Checkout, so it is written to be idempotent: the
 * `.is("trial_card_setup_at", null)` guard means whichever arrives second
 * changes nothing and, importantly, does not re-date the week.
 */
export async function recordTrialCard({
  gymId,
  paymentMethodId,
  customerId,
}: {
  gymId: string;
  paymentMethodId: string | null;
  customerId?: string | null;
}): Promise<{ started: boolean }> {
  const now = new Date();
  const trialEndsAt = new Date(
    now.getTime() + TRIAL_DAYS * 86_400_000,
  ).toISOString();

  const { data, error } = await supabaseAdmin()
    .from("gyms")
    .update({
      trial_card_setup_at: now.toISOString(),
      trial_payment_method_id: paymentMethodId,
      trial_ends_at: trialEndsAt,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
    })
    .eq("id", gymId)
    .is("trial_card_setup_at", null)
    .select("id");

  if (error) {
    throw new Error(`could not start trial: ${error.message}`);
  }

  // No rows changed means it was already started. Not an error, and not an
  // event: the week began once.
  if (!data || data.length === 0) return { started: false };

  await captureServerEvent(gymId, "trial_started", {
    days: TRIAL_DAYS,
    card_saved: Boolean(paymentMethodId),
  });

  return { started: true };
}

/**
 * The gym opting out during its week.
 *
 * Deliberately cheap and deliberately obvious in the UI. A cancelled trial
 * owes no setup fee whatever is unfinished, so this is the escape hatch that
 * makes the fee fair: the gym that says "not for me" pays nothing, and only
 * the gym that says nothing at all is charged.
 */
export async function cancelTrial(gymId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("gyms")
    .update({ trial_cancelled_at: new Date().toISOString() })
    .eq("id", gymId)
    .is("trial_cancelled_at", null);

  if (error) throw new Error(`could not cancel trial: ${error.message}`);

  await captureServerEvent(gymId, "trial_cancelled", {});
}
