import "server-only";

import { supabaseAdmin } from "./supabase";
import { captureServerEvent } from "./posthog-server";
import { TRIAL_DAYS } from "./plan";
import { stripeClient } from "./stripe";

/**
 * Starting the paid week, once Checkout has taken the euro and Stripe has
 * created the subscription.
 *
 * The week starts HERE and not at gym creation. The card is the commitment, so
 * the week it buys cannot begin before it exists. A gym that abandons the card
 * step is not locked out of anything it was promised: it lands on Free, which
 * can still import a list and see who has gone quiet, and the offer to start
 * the week stays open.
 *
 * `trialEnd` comes from Stripe rather than being computed here, which matters
 * more than it looks. Stripe now owns the day 7 charge, so if casdey kept its
 * own idea of when the week ends the two could drift and the product would
 * disagree with the bill. One clock, and it is Stripe's.
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
  subscriptionId,
  trialEnd,
}: {
  gymId: string;
  paymentMethodId: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  /** Stripe's own trial end, as an ISO string. Falls back to seven days from
   *  now only if Stripe somehow returned none. */
  trialEnd?: string | null;
}): Promise<{ started: boolean }> {
  const now = new Date();
  const trialEndsAt =
    trialEnd ??
    new Date(now.getTime() + TRIAL_DAYS * 86_400_000).toISOString();

  const { data, error } = await supabaseAdmin()
    .from("gyms")
    .update({
      trial_card_setup_at: now.toISOString(),
      trial_payment_method_id: paymentMethodId,
      trial_ends_at: trialEndsAt,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
      ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
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
 * Deliberately cheap and deliberately obvious in the UI: the gym that says
 * "not for me" pays nothing beyond the euro it already paid.
 *
 * **This has to reach Stripe, and that is the whole risk in this function.**
 * Stripe now holds the subscription and bills it at the end of the trial by
 * itself. A cancellation that only wrote a row in casdey's database would let
 * that charge go through anyway, and the gym would be billed a few hundred
 * euro after being told plainly it would not be. So Stripe is cancelled first
 * and the local flag is written second: if Stripe fails, this throws and the
 * gym sees an error it can retry, which is recoverable. The other order is
 * not, because it would leave casdey certain the gym had cancelled while the
 * money left anyway.
 */
export async function cancelTrial(gymId: string): Promise<void> {
  const { data: gym } = await supabaseAdmin()
    .from("gyms")
    .select("stripe_subscription_id, trial_cancelled_at")
    .eq("id", gymId)
    .maybeSingle();

  if (gym?.trial_cancelled_at) return; // Already cancelled. Nothing to undo.

  const subscriptionId = gym?.stripe_subscription_id as string | null;
  if (subscriptionId) {
    try {
      await stripeClient().subscriptions.cancel(subscriptionId);
    } catch (err) {
      // Already gone is fine and is not a failure to cancel.
      const code =
        typeof err === "object" && err && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (code !== "resource_missing") {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(`could not cancel the Stripe subscription: ${detail}`);
      }
    }
  }

  const { error } = await supabaseAdmin()
    .from("gyms")
    .update({ trial_cancelled_at: new Date().toISOString() })
    .eq("id", gymId)
    .is("trial_cancelled_at", null);

  if (error) throw new Error(`could not cancel trial: ${error.message}`);

  await captureServerEvent(gymId, "trial_cancelled", {});
}
