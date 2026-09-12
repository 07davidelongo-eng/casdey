import type { Currency } from "./countries";
import { TRIAL_PRICE_MINOR } from "./trial";
import { formatMoney } from "./money";

/**
 * The two words the public offer can be in, in one place.
 *
 * casdey's first week is either free with no card or bought for 1 euro,
 * depending on `paidTrialEnabled()` in ./plan.ts. The product already branches
 * on that flag. The marketing site did not, which meant flipping the flag would
 * have left the hero promising "no card" while the checkout asked for one, and
 * the terms page telling a third story. That is the same fault caught on the
 * day casdey.com was published, when the homepage promised a Pro-only guarantee
 * without the qualifier.
 *
 * Only the strings that appear on more than one surface live here. The prose
 * around them is branched in place, next to the layout it belongs to, because
 * marketing copy that has been lifted into a dictionary is copy nobody edits
 * again.
 *
 * Pure and free of `server-only`, because two of the surfaces that need it are
 * client components. They take the flag as a prop from their server parent
 * rather than reading the environment, which a client component cannot do.
 */

/** The 1 euro, in the currency being shown. */
export function trialPriceDisplay(currency: Currency = "eur"): string {
  return formatMoney(TRIAL_PRICE_MINOR, currency);
}

/**
 * The primary call to action, which appears in the hero, the closing band, the
 * offer panel, the pricing table, the footer and both states of the login form.
 *
 * Naming the price in the button is deliberate under the paid week. The button
 * is the last thing read before a card is asked for, and "start your free week"
 * followed by a payment form is the kind of small surprise that makes people
 * distrust everything after it.
 */
export function startCta(paidTrial: boolean, currency: Currency = "eur"): string {
  return paidTrial
    ? `Start your week for ${trialPriceDisplay(currency)}`
    : "Start your free week";
}

/** The hero pill, which is the first claim about price anyone reads. */
export function offerBadge(paidTrial: boolean, currency: Currency = "eur"): string {
  return paidTrial
    ? `First week of Pro, ${trialPriceDisplay(currency)}`
    : "Free first week, no card";
}

/**
 * The short form, for the site header, where there is room for two or three
 * words and not for a sentence.
 *
 * "Start free" is a price claim, not a generic label, which is why it cannot
 * simply stay put when the first week starts costing something. A visitor who
 * clicks a button saying free and lands on a card form has been told one thing
 * and shown another, in the two seconds where trust is cheapest to lose.
 */
export function startCtaShort(
  paidTrial: boolean,
  currency: Currency = "eur",
): string {
  return paidTrial ? `Start for ${trialPriceDisplay(currency)}` : "Start free";
}
