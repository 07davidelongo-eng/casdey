import { redirect } from "next/navigation";

import { requireGym } from "@/lib/dal";
import { currencyFor } from "@/lib/countries";
import { formatMoney } from "@/lib/money";
import { TRIAL_DAYS, trialPenaltyEnabled } from "@/lib/plan";
import {
  ACTIVATION_LABELS,
  ACTIVATION_STEPS,
  SETUP_FEE_MINOR,
  TRIAL_DEPOSIT_MINOR,
} from "@/lib/trial";
import { TrialStartForm } from "./form";

export const metadata = { title: "Start your free week" };

/**
 * The second half of signup under Trial With Penalty (Track H).
 *
 * Everything a gym is agreeing to is on this one page, in numbers, before it
 * reaches a card field. Hormozi sells this on a call, where a human takes the
 * card and explains the fee clauses after it is down (MM pg 126). casdey's
 * signup is self-serve, so that texture is gone and plain terms up front are
 * what replaces it. Stating the fee this clearly probably costs a few
 * signups; a gym billed on day 7 by something it never read would cost more.
 */
export default async function TrialStartPage(
  props: PageProps<"/app/onboarding/trial">,
) {
  const { gym } = await requireGym();
  const params = await props.searchParams;

  // With the flag off the free week is granted at signup and no card is
  // taken, so this page has nothing to ask for.
  if (!trialPenaltyEnabled()) redirect("/app");
  // Already started. Refreshing this must never charge a second euro.
  if (gym.trial_card_setup_at) redirect("/app");

  const currency = currencyFor(gym.country);
  const deposit = formatMoney(TRIAL_DEPOSIT_MINOR, currency);
  const perStep = formatMoney(SETUP_FEE_MINOR[currency], currency);
  const cap = formatMoney(
    SETUP_FEE_MINOR[currency] * ACTIVATION_STEPS.length,
    currency,
  );

  const error = typeof params.error === "string" ? params.error : null;

  return (
    <div className="mx-auto max-w-[34rem] py-4">
      <p className="label mb-2 text-teal">Step 2 of 2</p>
      <h1 className="display text-[2rem]">Start your free week</h1>
      <p className="mt-2 mb-8 text-[0.9375rem] text-graphite">
        {TRIAL_DAYS} days with every feature on, including the ones that cost
        casdey money to run. We take {deposit} today to check the card works,
        and nothing else.
      </p>

      <div className="card mb-6 p-6">
        <h2 className="mb-1 text-[1.0625rem] font-semibold">
          What the week is for
        </h2>
        <p className="mb-4 text-[0.875rem] text-stone">
          Three things, and casdey is set up. They are the same three the
          checklist walks you through, and they take about ten minutes
          together.
        </p>
        <ol className="space-y-2.5">
          {ACTIVATION_STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 text-[0.9375rem]">
              <span className="literal shrink-0 text-stone">
                {index + 1}.
              </span>
              <span>{ACTIVATION_LABELS[step]}</span>
            </li>
          ))}
        </ol>
      </div>

      <TrialStartForm
        deposit={deposit}
        perStep={perStep}
        cap={cap}
        error={error}
      />

      <p className="mt-5 text-[0.8125rem] text-stone">
        Card details go straight to Stripe. casdey never sees them.
      </p>
    </div>
  );
}
