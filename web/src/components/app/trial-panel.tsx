import Link from "next/link";

import { ButtonLink, Card, CardTitle } from "@/components/app/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { currencyFor } from "@/lib/countries";
import { formatMoney } from "@/lib/money";
import { TRIAL_DAYS, trialDaysLeft } from "@/lib/plan";
import { ACTIVATION_LABELS, SETUP_FEE_MINOR, type StepState } from "@/lib/trial";
import type { Gym } from "@/lib/types";
import { cancelTrialAction } from "@/app/app/trial-actions";

/**
 * Where the gym stands in its free week, and exactly what happens at the end
 * of it (Track H).
 *
 * The setup checklist already lists the three steps, so this does not repeat
 * them: it says what is outstanding, what day 7 will do about it, and how to
 * opt out. Nobody should be able to say they were not told.
 *
 * Three states, and the first matters as much as the others. A gym that
 * abandoned the card step has no week running at all, and without this panel
 * there would be no way back to the offer from inside the product.
 */
export function TrialPanel({
  gym,
  steps,
}: {
  gym: Gym;
  steps: StepState[];
}) {
  // Already converted, cancelled and finished, or never on this path.
  if (gym.trial_closed_at) return null;

  const currency = currencyFor(gym.country);
  const outstanding = steps.filter((s) => !s.done);
  const perStep = formatMoney(SETUP_FEE_MINOR[currency], currency);
  const owed = formatMoney(
    SETUP_FEE_MINOR[currency] * outstanding.length,
    currency,
  );

  // Not started: the card was never taken, so no week is running.
  if (!gym.trial_card_setup_at) {
    return (
      <Card>
        <CardTitle>Your free week has not started</CardTitle>
        <p className="mb-4 text-[0.875rem] text-graphite">
          {TRIAL_DAYS} days with every feature on, including WhatsApp and the
          profit-or-nothing guarantee. Until you start it you are on the Free
          plan, which finds your lapsed members but cannot message them.
        </p>
        <ButtonLink href="/app/onboarding/trial">
          Start my free week
        </ButtonLink>
      </Card>
    );
  }

  const left = trialDaysLeft(gym);

  if (gym.trial_cancelled_at) {
    return (
      <Card>
        <CardTitle>Your free week is ending</CardTitle>
        <p className="text-[0.875rem] text-graphite">
          You cancelled, so nothing more will be charged and there is no setup
          fee. You keep full access until the week runs out, then the account
          moves to the Free plan. Changed your mind? Pick a plan from{" "}
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
          ? "Your free week has ended"
          : `${left} ${left === 1 ? "day" : "days"} left of your free week`}
      </CardTitle>

      {outstanding.length === 0 ? (
        <p className="text-[0.875rem] text-graphite">
          Setup is done, so there is no setup fee. At the end of the week your
          account moves onto Pro and starts billing monthly. Cancel any time
          before then and you pay nothing.
        </p>
      ) : (
        <>
          <p className="mb-3 text-[0.875rem] text-graphite">
            Still to do, and each one left unfinished at the end of the week is
            a <span className="literal">{perStep}</span> setup fee:
          </p>
          <ul className="mb-4 space-y-1.5">
            {outstanding.map((s) => (
              <li key={s.step} className="text-[0.9375rem]">
                {ACTIVATION_LABELS[s.step]}
              </li>
            ))}
          </ul>
          <p className="mb-4 text-[0.875rem] text-graphite">
            As things stand that is <span className="literal">{owed}</span>.
            Finish them and it is nothing, and your account moves onto Pro.
            Cancel and it is also nothing.
          </p>
        </>
      )}

      {/* The opt-out. Prominent on purpose: the fee is only fair because
          this is here and easy. */}
      <form id="cancel-trial" action={cancelTrialAction} />
      <ConfirmButton
        formId="cancel-trial"
        title="Cancel your free week?"
        confirmLabel="Cancel the week"
        cancelLabel="Keep it running"
        body={
          <>
            You keep full access until the week runs out, then the account
            moves to the Free plan. No setup fee is charged, whatever is left
            unfinished, and nothing else comes off your card.
          </>
        }
        className="text-[0.875rem] text-stone underline underline-offset-4 hover:text-ink"
      >
        Cancel my free week
      </ConfirmButton>
    </Card>
  );
}
