import type { Gym } from "./types";
import { TRIAL_DAYS } from "./plan";
import { findPricePlan } from "./pricing";
import type { Currency } from "./countries";

/**
 * The paid first week: what it costs, what a gym should have done by the end
 * of it, and what happens on day 7.
 *
 * Pure and dependency-free on purpose, the same way src/lib/lapse.ts is: this
 * decides what happens to a real card, so it has to be readable end to end and
 * testable without a database, a Stripe key or a clock.
 *
 * **This replaced Hormozi's Trial With Penalty on 2026-09-12, deliberately.**
 * That design charged a setup fee per activation step left unfinished at day 7.
 * It was built, audited and never switched on. Davide's call was that it does
 * not fit casdey, and the reasoning is in the ledger: the mechanism comes from
 * gym businesses, where an unused trial consumes a coach's hour and the fee
 * recovers a real loss. In SaaS a dormant trial costs almost nothing, so the
 * fee had no cost basis, sat outside every norm a software buyer knows, and
 * carried a legal and chargeback tail that one disputed 20 euro would have made
 * expensive at casdey's size.
 *
 * What replaced it keeps the part that was doing the work. The week is SOLD,
 * not given: 1 euro buys seven days of Pro. A gym that puts a card down and
 * answers "yes, I'll stay if this works" is a different gym from one that
 * clicks a button, and at day 7 the subscription simply begins. The forcing
 * function is that a decision has to be made, which is what the old free week
 * never asked for: it expired quietly, the gym drifted to Free, and nothing
 * happened. That is what BodyActive did.
 *
 * The rule that survives both designs: every uncertainty resolves in the gym's
 * favour. No card, a cancelled week, an unreadable count: all of them mean the
 * week ends and nothing is charged.
 */

/** The three things that turn a signup into a gym casdey can actually help. */
export type ActivationStep = "import" | "prices" | "campaign";

export const ACTIVATION_STEPS: readonly ActivationStep[] = [
  "import",
  "prices",
  "campaign",
];

/**
 * What the gym is told each step is, in its own words.
 *
 * These are no longer billing conditions, which is the point of the change.
 * They are the onboarding checklist and what the nudges chase, so the wording
 * is an instruction rather than an obligation.
 */
export const ACTIVATION_LABELS: Record<ActivationStep, string> = {
  import: "Import your member list",
  prices: "Add what you charge",
  campaign: "Approve your first campaign",
};

/**
 * The price of the first week.
 *
 * 1 euro is Hormozi's own figure (MM pg 129), where it hedges the worry that
 * asking for a card on a free trial costs signups. Here it does more than
 * hedge: the week is not free, it is bought, so the gym is a customer from the
 * first minute rather than a trialist who might become one. Small enough to be
 * a formality, real enough to prove the card works, which a zero-value
 * authorisation does not.
 */
export const TRIAL_PRICE_MINOR = 100;

/** The lifetime early-adopter discount, as a percentage off a paid tier. */
export const EARLY_ADOPTER_DISCOUNT_PERCENT = 20;

/** Days of the week on which a nudge goes out, ascending. */
export const NUDGE_DAYS: readonly number[] = [2, 5, 6];

/**
 * What the gym will actually be charged when the week converts, in minor units.
 *
 * Exists so the day 6 email can name a real figure. That email is now the most
 * important message casdey sends: it is the only warning before a card is
 * charged a few hundred euro, and a charge nobody saw coming is the one outcome
 * worth avoiding. Approximating it there would be a strange place to save
 * effort.
 */
export function conversionAmountMinor(
  currency: Currency,
  earlyAdopter: boolean,
): number | null {
  const plan = findPricePlan("pro", currency, "month");
  if (!plan) return null;
  if (!earlyAdopter) return plan.amountMinor;
  return Math.round(
    (plan.amountMinor * (100 - EARLY_ADOPTER_DISCOUNT_PERCENT)) / 100,
  );
}

/**
 * Whether a gym has finished each step.
 *
 * `evidence` is the live state (does a member exist, is anything priced, has a
 * campaign been approved), and it is not redundant with the timestamps. The
 * stamps are written at three separate action sites, and a missed write should
 * not make casdey nag a gym about something it has plainly already done. So a
 * step counts as done if EITHER source says so, and only the stamp is trusted
 * for "when".
 */
export type ActivationEvidence = {
  hasMembers: boolean;
  hasPricedServices: boolean;
  hasApprovedCampaign: boolean;
};

export type StepState = {
  step: ActivationStep;
  done: boolean;
  /** When it was done, when that is known. Null for a step proved done by
   *  evidence alone, which is why nothing may schedule off this. */
  doneAt: string | null;
};

type TrialGym = Pick<
  Gym,
  | "trial_ends_at"
  | "trial_card_setup_at"
  | "trial_commitment_at"
  | "trial_cancelled_at"
  | "trial_converted_at"
  | "trial_closed_at"
  | "activated_import_at"
  | "activated_prices_at"
  | "activated_campaign_at"
>;

const STAMP: Record<ActivationStep, keyof TrialGym> = {
  import: "activated_import_at",
  prices: "activated_prices_at",
  campaign: "activated_campaign_at",
};

function evidenceFor(
  step: ActivationStep,
  evidence: ActivationEvidence,
): boolean {
  if (step === "import") return evidence.hasMembers;
  if (step === "prices") return evidence.hasPricedServices;
  return evidence.hasApprovedCampaign;
}

export function activationFor(
  gym: TrialGym,
  evidence: ActivationEvidence,
): StepState[] {
  return ACTIVATION_STEPS.map((step) => {
    const stamped = gym[STAMP[step]] as string | null;
    return {
      step,
      done: stamped != null || evidenceFor(step, evidence),
      doneAt: stamped ?? null,
    };
  });
}

export function unfinishedSteps(states: StepState[]): ActivationStep[] {
  return states.filter((s) => !s.done).map((s) => s.step);
}

/**
 * What the day 7 job should do with a paid week.
 *
 * Deliberately exhaustive and deliberately boring, because every branch either
 * starts billing a card or decides not to.
 *
 *   wait     Not day 7 yet, or already closed.
 *   convert  Not cancelled, card on file. The Pro subscription begins.
 *   release  The week ends and nothing is charged. Every "we are not sure"
 *            answer lands here.
 *
 * Note what is NOT a branch any more: how much of the setup got done. Under the
 * old design that decided whether a fee fired. Now it decides nothing, because
 * a gym bought a week of Pro and what it did with the week is its own business.
 * Activation is still tracked and still chased by the nudges, it just no longer
 * touches anyone's money.
 */
export type TrialOutcome =
  | { kind: "wait"; reason: string }
  | { kind: "convert" }
  | { kind: "release"; reason: string };

export function trialOutcome(
  gym: TrialGym,
  now: Date = new Date(),
): TrialOutcome {
  if (gym.trial_closed_at) {
    return { kind: "wait", reason: "already closed" };
  }
  if (!gym.trial_ends_at) {
    return { kind: "wait", reason: "no paid week" };
  }
  if (new Date(gym.trial_ends_at).getTime() > now.getTime()) {
    return { kind: "wait", reason: "still running" };
  }

  // Cancelling is one click and is signposted all week. A gym that used it has
  // said no, and saying no is free.
  if (gym.trial_cancelled_at) {
    return { kind: "release", reason: "cancelled during the week" };
  }

  // Converting needs a card. Gyms that signed up before the paid week existed
  // have none, and were promised a free week on the old terms, so theirs simply
  // ends. This is the branch BodyActive takes.
  if (!gym.trial_card_setup_at) {
    return { kind: "release", reason: "no card on file" };
  }

  return { kind: "convert" };
}

/**
 * What creating the conversion subscription actually achieved.
 *
 * Stripe returning a subscription object is not the same as the gym having
 * paid. When the first payment needs 3-D Secure, which European banks ask for
 * routinely, `subscriptions.create` succeeds and hands back a subscription
 * sitting at `incomplete` with the charge unconfirmed. Treating that as a
 * conversion is how a gym that did everything right ends up on the Free plan
 * holding an unpaid subscription, with casdey's own records claiming it
 * converted and nothing anywhere telling it to go and authenticate.
 *
 * Stripe's test cards never trigger 3-D Secure, so this cannot be caught by
 * driving the test-mode path; it is only reachable with a real card at a real
 * European bank. Hence a named function with its own test rather than an
 * inline status check.
 *
 *   converted             Paid. The gym is on Pro.
 *   needs_authentication  The bank wants the owner to approve the charge.
 *                         Recoverable, and the gym has to be told.
 *   failed                Declined or unusable. Nothing to authenticate.
 */
export type ConversionResult = "converted" | "needs_authentication" | "failed";

export function conversionResultFor(
  subscriptionStatus: string,
): ConversionResult {
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return "converted";
  }
  if (subscriptionStatus === "incomplete") return "needs_authentication";
  return "failed";
}

/**
 * Which nudge, if any, is due today.
 *
 * Returns the highest nudge day that has passed and has not been sent, so a job
 * that misses a day (the cron runs once daily on Vercel's Hobby plan) catches
 * up with one message rather than three.
 *
 * A card on file is required, and that is not a technicality. These emails
 * describe what happens at day 7, and for a gym with no card the honest answer
 * is "nothing": it cannot convert (see trialOutcome) and it was promised a free
 * week on the old terms. Telling it otherwise would be a false statement about
 * its own bill. This was found the hard way: the first run of this job emailed
 * casdey's only real customer, a gym that signed up before any of this existed,
 * about a charge it had never agreed to. The charge in question no longer
 * exists and the guard still does, because the guard was always the right
 * thing.
 */
export function nudgeDue(
  gym: Pick<
    Gym,
    | "trial_ends_at"
    | "trial_cancelled_at"
    | "trial_last_nudge_day"
    | "trial_card_setup_at"
  >,
  unfinished: ActivationStep[],
  now: Date = new Date(),
): number | null {
  if (!gym.trial_ends_at) return null;
  if (!gym.trial_card_setup_at) return null;
  if (gym.trial_cancelled_at) return null;

  const day = trialDayNumber(gym.trial_ends_at, now);
  if (day == null) return null;

  const sent = gym.trial_last_nudge_day ?? 0;
  const due = NUDGE_DAYS.filter((d) => d <= day && d > sent);
  if (due.length === 0) return null;
  const next = Math.max(...due);

  // Days 2 and 5 chase the setup, so a gym that has finished has nothing to
  // hear from them. Day 6 is the conversion warning and goes out regardless: a
  // gym is about to be charged a few hundred euro and is entitled to know,
  // whether or not it ever imported anything. Under the old design this
  // function returned null for a fully set-up gym on every day, which was right
  // when the only thing to warn about was a fee it could no longer incur.
  if (next < 6 && unfinished.length === 0) return null;

  return next;
}

/**
 * Which day of the week it is, 1-based, or null once it is over.
 *
 * Derived from trial_ends_at because that is the column that exists; the start
 * is trial_ends_at minus TRIAL_DAYS.
 */
export function trialDayNumber(
  trialEndsAt: string,
  now: Date = new Date(),
): number | null {
  const end = new Date(trialEndsAt).getTime();
  if (Number.isNaN(end)) return null;
  const start = end - TRIAL_DAYS * 86_400_000;
  const elapsed = now.getTime() - start;
  if (elapsed < 0) return null;
  const day = Math.floor(elapsed / 86_400_000) + 1;
  return day > TRIAL_DAYS ? null : day;
}

/**
 * What the gym will be charged when the week converts, and what that figure is
 * before any discount.
 *
 * Both numbers, deliberately. The in-app screens used to show only the charged
 * amount, which for an early adopter is a number like 231.20 that appears from
 * nowhere: it is neither the advertised price nor a round figure, so it reads
 * as arbitrary. Worse, it silently throws away the good news. A gym holding a
 * permanent 20% discount should be told it is holding one, at the two moments
 * it is looking at the price.
 *
 * Found by Davide walking the live signup on 2026-09-12: "it mentions the
 * 231.20 without saying that it is actually because they're taking advantage
 * of the early user discount".
 */
export function conversionPricing(
  currency: Currency,
  earlyAdopter: boolean,
): { listMinor: number; chargedMinor: number; discounted: boolean } | null {
  const plan = findPricePlan("pro", currency, "month");
  if (!plan) return null;
  const charged = earlyAdopter
    ? Math.round((plan.amountMinor * (100 - EARLY_ADOPTER_DISCOUNT_PERCENT)) / 100)
    : plan.amountMinor;
  return {
    listMinor: plan.amountMinor,
    chargedMinor: charged,
    discounted: earlyAdopter && charged !== plan.amountMinor,
  };
}
