import { redirect } from "next/navigation";

import { requireGym } from "@/lib/dal";
import { currencyFor } from "@/lib/countries";
import { formatMoney } from "@/lib/money";
import { TRIAL_DAYS, paidTrialEnabled } from "@/lib/plan";
import {
  ACTIVATION_LABELS,
  ACTIVATION_STEPS,
  TRIAL_PRICE_MINOR,
  conversionAmountMinor,
} from "@/lib/trial";
import { TrialStartForm } from "./form";

export const metadata = { title: "Start your week of Pro" };

/**
 * The second half of signup: buying the first week.
 *
 * Everything a gym is agreeing to is on this one page, in numbers, before it
 * reaches a card field. That includes the figure it will be charged at the end
 * of the week, which is the number people actually care about and the one most
 * trials bury.
 *
 * The week is sold rather than given, which is the whole design. A gym that
 * pays something, even 1 euro, and answers "yes, I'll stay if this works" is a
 * different gym from one that clicked a button. It probably costs a few
 * signups. The ones it costs were never going to import a member list.
 */
export default async function TrialStartPage(
  props: PageProps<"/app/onboarding/trial">,
) {
  const { gym } = await requireGym();
  const params = await props.searchParams;

  // With the flag off the free week is granted at signup and no card is
  // taken, so this page has nothing to ask for.
  if (!paidTrialEnabled()) redirect("/app");
  // Already started. Refreshing this must never charge a second euro.
  if (gym.trial_card_setup_at) redirect("/app");

  const currency = currencyFor(gym.country);
  const price = formatMoney(TRIAL_PRICE_MINOR, currency);
  const after = conversionAmountMinor(currency, gym.early_adopter);
  const monthly = after == null ? null : formatMoney(after, currency);

  const error = typeof params.error === "string" ? params.error : null;

  return (
    <div className="mx-auto max-w-[34rem] py-4">
      <p className="label mb-2 text-teal">Step 2 of 2</p>
      <h1 className="display text-[2rem]">Start your week of Pro</h1>
      <p className="mt-2 mb-8 text-[0.9375rem] text-graphite">
        {price} for {TRIAL_DAYS} days with every feature on, including the ones
        that cost casdey money to run. After that it becomes a normal
        subscription{monthly ? ` at ${monthly} a month` : ""}, and you can
        cancel any time during the week without paying it.
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

      <TrialStartForm price={price} monthly={monthly} error={error} />

      <p className="mt-5 text-[0.8125rem] text-stone">
        Card details go straight to Stripe. casdey never sees them.
      </p>
    </div>
  );
}
