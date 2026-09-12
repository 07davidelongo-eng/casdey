import Link from "next/link";

import { ButtonLink, Card, CardTitle } from "@/components/app/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { currencyFor } from "@/lib/countries";
import { formatMoney } from "@/lib/money";
import { TRIAL_DAYS, trialDaysLeft } from "@/lib/plan";
import {
  ACTIVATION_LABELS,
  TRIAL_PRICE_MINOR,
  conversionPricing,
  type StepState,
} from "@/lib/trial";
import type { Gym } from "@/lib/types";
import { cancelTrialAction } from "@/app/app/trial-actions";

/**
 * Where the gym stands in its paid week, and exactly what happens at the end
 * of it.
 *
 * The setup checklist already lists the three steps, so this does not repeat
 * them: it says what is outstanding, what day 7 will do, and how to opt out.
 * Nobody should be able to say they were not told.
 *
 * This used to warn about a setup fee for unfinished steps. That mechanism was
 * removed on 2026-09-12 (see lib/trial.ts), so the thing to be clear about is
 * now the renewal, which is a larger number and matters more. The steps stay
 * on screen because they are still how a gym gets value out of the week, they
 * just no longer carry a price.
 *
 * Three states, and the first matters as much as the others. A gym that
 * abandoned the card step has no week running at all, and without this panel
 * there would be no way back to the offer from inside the product.
 */
export function TrialPanel({ gym, steps }: { gym: Gym; steps: StepState[] }) {
  // Already converted, cancelled and finished, or never on this path.
  if (gym.trial_closed_at) return null;

  const currency = currencyFor(gym.country);
  const outstanding = steps.filter((s) => !s.done);
  const price = formatMoney(TRIAL_PRICE_MINOR, currency);
  const pricing = conversionPricing(currency, gym.early_adopter);
  const monthly =
    pricing == null ? null : formatMoney(pricing.chargedMinor, currency);
  const list =
    pricing == null ? null : formatMoney(pricing.listMinor, currency);

  // Not started: the card was never taken, so no week is running.
  if (!gym.trial_card_setup_at) {
    return (
      <Card>
        <CardTitle>Your week of Pro has not started</CardTitle>
        <p className="mb-4 text-[0.875rem] text-graphite">
          {price} for {TRIAL_DAYS} days with every feature on, including
          WhatsApp and the profit-or-nothing guarantee. Until you start it you
          are on the Free plan, which finds your lapsed members but cannot
          message them.
        </p>
        <ButtonLink href="/app/onboarding/trial">
          Start my week for {price}
        </ButtonLink>
      </Card>
    );
  }

  const left = trialDaysLeft(gym);

  if (gym.trial_cancelled_at) {
    return (
      <Card>
        <CardTitle>Your week is ending</CardTitle>
        <p className="text-[0.875rem] text-graphite">
          You cancelled, so nothing more will be charged. You keep full access
          until the week runs out, then the account moves to the Free plan.
          Changed your mind? Pick a plan from{" "}
          <Link href="/app/settings/billing" className="text-teal underline">
            billing
          </Link>
          .
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>
        {left == null
          ? "Your week of Pro has ended"
          : `${left} ${left === 1 ? "day" : "days"} left of your week of Pro`}
      </CardTitle>

      <p className="mb-4 text-[0.875rem] text-graphite">
        At the end of the week your subscription starts
        {monthly ? (
          <>
            {" "}
            at <span className="literal">{monthly}</span> a month
          </>
        ) : null}
        . Cancel any time before then and nothing else comes off your card.
      </p>

      {/* The charged figure on its own reads as arbitrary, and it hides the
          fact that the gym is holding a permanent discount. Both are worth a
          line. */}
      {pricing?.discounted ? (
        <p className="mb-4 text-[0.875rem] text-stone">
          Pro is <span className="literal">{list}</span>. You are on the launch
          rate for as long as you stay subscribed.
        </p>
      ) : null}

      {outstanding.length > 0 ? (
        <>
          <p className="mb-3 text-[0.875rem] text-graphite">
            Still to do, and the week is worth far more to you with these done:
          </p>
          <ul className="mb-4 space-y-1.5">
            {outstanding.map((s) => (
              <li key={s.step} className="text-[0.9375rem]">
                {ACTIVATION_LABELS[s.step]}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* The opt-out. Prominent on purpose: charging at the end of the week is
          only fair because this is here and easy. */}
      <form id="cancel-trial" action={cancelTrialAction} />
      <ConfirmButton
        formId="cancel-trial"
        title="Cancel your week?"
        confirmLabel="Cancel the week"
        cancelLabel="Keep it running"
        body={
          <>
            You keep full access until the week runs out, then the account
            moves to the Free plan. Your subscription will not start and
            nothing else comes off your card.
          </>
        }
        className="text-[0.875rem] text-stone underline underline-offset-4 hover:text-ink"
      >
        Cancel my week
      </ConfirmButton>
    </Card>
  );
}
