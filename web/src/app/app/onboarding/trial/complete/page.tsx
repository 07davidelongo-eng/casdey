import { redirect } from "next/navigation";

import { requireGym } from "@/lib/dal";
import { stripeClient } from "@/lib/stripe";
import { recordTrialCard } from "@/lib/trial-start";

export const metadata = { title: "Starting your week" };
export const dynamic = "force-dynamic";

/**
 * Where Stripe sends the gym back after the euro.
 *
 * This starts the week too, and that is not a duplicate of the webhook: it is
 * the path that works when a webhook cannot reach casdey at all, which is
 * every local dev run. Both call recordTrialCard(), which is idempotent on
 * `trial_card_setup_at is null`, so whichever arrives second changes nothing
 * and cannot re-date the week.
 *
 * It reads the session rather than trusting the URL. A gym could put any
 * session id here, so the id is only ever used to ask Stripe what actually
 * happened, and the answer has to be a session belonging to THIS gym that
 * produced a subscription.
 *
 * **Only the webhook attaches the launch coupon.** Doing it here as well would
 * mean two writers racing to discount the same subscription, and Stripe would
 * happily stack them. The webhook is the authoritative path; this one exists
 * so local development works at all.
 */
export default async function TrialCompletePage(
  props: PageProps<"/app/onboarding/trial/complete">,
) {
  const { gym } = await requireGym();
  const params = await props.searchParams;
  const sessionId =
    typeof params.session_id === "string" ? params.session_id : null;

  if (gym.trial_card_setup_at || !sessionId) redirect("/app");

  try {
    const session = await stripeClient().checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    // Belongs to this gym, and actually produced a subscription. Either check
    // failing means the week does not start, which is the safe direction: a
    // gym with no subscription is never billed anything at day 7.
    const ownsIt =
      session.client_reference_id === gym.id ||
      session.metadata?.gym_id === gym.id;

    const subscription =
      session.subscription && typeof session.subscription !== "string"
        ? session.subscription
        : null;

    if (ownsIt && subscription) {
      const defaultPm = subscription.default_payment_method;

      await recordTrialCard({
        gymId: gym.id,
        paymentMethodId:
          typeof defaultPm === "string" ? defaultPm : (defaultPm?.id ?? null),
        customerId:
          typeof session.customer === "string" ? session.customer : null,
        subscriptionId: subscription.id,
        trialEnd: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
      });
    }
  } catch (error) {
    // The webhook is the authoritative writer, so a failure here is not
    // terminal: log it and let the gym into the product. If the webhook also
    // never lands, the gym simply has no trial and is charged nothing.
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[trial] completion read failed", detail);
  }

  redirect("/app?welcome=1");
}
