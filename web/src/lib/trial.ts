import type { Gym } from "./types";
import { TRIAL_DAYS } from "./plan";

/**
 * Trial With Penalty: what a trial is worth, what is still unfinished, and
 * what happens at day 7.
 *
 * Track H of web/SAAS_V1_1_PLAN.md. Pure and dependency-free on purpose, the
 * same way src/lib/lapse.ts is: this is the one place that decides whether a
 * real card gets charged, so it has to be readable end to end and testable
 * without a database, a Stripe key or a clock.
 *
 * Two rules run through all of it.
 *
 * The fee is not revenue. $100M Money Models pg 130: "You make money by
 * getting people results and turning them into customers, not nickeling and
 * diming people with fees." It exists to move the share of trials that get
 * set up. A week where every gym activates and no fee fires is the mechanism
 * working perfectly, not failing.
 *
 * And every uncertainty resolves in the gym's favour. A missing activation
 * stamp, an unreadable count, no saved card, a trial that was cancelled: all
 * of them mean no fee. Charging somebody €20 because casdey lost track of a
 * timestamp is exactly the 1-star review the book warns about (MM pg 128).
 */

/** The three things that turn a signup into a gym casdey can actually help. */
export type ActivationStep = "import" | "prices" | "campaign";

export const ACTIVATION_STEPS: readonly ActivationStep[] = [
  "import",
  "prices",
  "campaign",
];

/**
 * What the gym is told each step is, in its own words. "Setup fee" is the
 * customer-facing word for the charge, and "free trial" is the only name the
 * trial itself ever gets (MM pg 129). Never "penalty", anywhere a gym reads.
 */
export const ACTIVATION_LABELS: Record<ActivationStep, string> = {
  import: "Import your member list",
  prices: "Add what you charge",
  campaign: "Approve your first campaign",
};

/**
 * The fee per unfinished step, and the cap.
 *
 * Sized against what the gym actually sat on: a week of Pro is roughly €72
 * (€289/mo), so €60 at the cap sits just under it, and €20 a step is a
 * cleaner number than €24. GBP keeps its own round figure rather than a live
 * conversion, which is how every other price in casdey works.
 */
export const SETUP_FEE_MINOR: Record<"eur" | "gbp", number> = {
  eur: 2000,
  gbp: 2000,
};

/** The cap, expressed as steps rather than a second number to keep in step. */
export const SETUP_FEE_MAX_STEPS = 3;

/**
 * The trial deposit: charged at signup, which is also what saves the card.
 *
 * €1 is Hormozi's own hedge (MM pg 129) for exactly the worry this raises,
 * that asking for a card on a free trial costs signups. It is small enough to
 * be a formality and real enough to prove the card works, which a €0
 * authorisation does not.
 */
export const TRIAL_DEPOSIT_MINOR = 100;

/** How long after being billed a gym can still finish a step and be refunded. */
export const MAKE_GOOD_DAYS = 7;

/** Trial days on which a nudge goes out, ascending. */
export const NUDGE_DAYS: readonly number[] = [2, 5, 6];

/**
 * Whether a gym has finished each step.
 *
 * `evidence` is the live state (does a member exist, is anything priced, has a
 * campaign been approved), and it is not redundant with the timestamps. The
 * stamps are written at three separate action sites, and a step that is
 * plainly done must never cost a gym money because one of those writes was
 * missed. So a step counts as done if EITHER source says so, and only the
 * stamp is trusted for "when".
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
 * The fee a gym would owe right now, in minor units.
 *
 * Capped at SETUP_FEE_MAX_STEPS, which with three steps means the cap can
 * never actually bind. It is written as a cap anyway so that adding a fourth
 * step is a one-line change rather than a silent price rise.
 */
export function feeForUnfinished(
  unfinished: ActivationStep[],
  currency: "eur" | "gbp",
): number {
  const billable = Math.min(unfinished.length, SETUP_FEE_MAX_STEPS);
  return billable * SETUP_FEE_MINOR[currency];
}

/**
 * What the day-7 job should do with a trial.
 *
 * Deliberately exhaustive and deliberately boring, because every branch here
 * either charges a card or decides not to.
 *
 *   wait       Not day 7 yet, or the trial is already closed.
 *   convert    Three steps done, not cancelled, card on file. Becomes Pro.
 *   release    Drop to Free and charge nothing. Every "we are not sure"
 *              answer lands here: cancelled, no card, nothing owed.
 *   charge     Drop to Free and bill the unfinished steps.
 */
export type TrialOutcome =
  | { kind: "wait"; reason: string }
  | { kind: "convert" }
  | { kind: "release"; reason: string }
  | { kind: "charge"; steps: ActivationStep[] };

export function trialOutcome(
  gym: TrialGym,
  evidence: ActivationEvidence,
  now: Date = new Date(),
): TrialOutcome {
  if (gym.trial_closed_at) {
    return { kind: "wait", reason: "already closed" };
  }
  if (!gym.trial_ends_at) {
    return { kind: "wait", reason: "no trial" };
  }
  if (new Date(gym.trial_ends_at).getTime() > now.getTime()) {
    return { kind: "wait", reason: "still running" };
  }

  // Opting out is not the same as ghosting, and this is the difference.
  // It leaves a loophole (use Pro for six days, cancel, pay €1) which is
  // accepted: the card and the commitment ask at signup filter most of it,
  // and the fee is not revenue anyway.
  if (gym.trial_cancelled_at) {
    return { kind: "release", reason: "cancelled during the trial" };
  }

  const states = activationFor(gym, evidence);
  const unfinished = unfinishedSteps(states);

  if (unfinished.length === 0) {
    // Converting needs a card. A trial that somehow ran without one (the flag
    // was off at signup, or the €1 never completed) simply ends.
    if (!gym.trial_card_setup_at) {
      return { kind: "release", reason: "set up, but no card on file" };
    }
    return { kind: "convert" };
  }

  if (!gym.trial_card_setup_at) {
    return { kind: "release", reason: "no card on file" };
  }

  return { kind: "charge", steps: unfinished };
}

/**
 * Which nudge, if any, is due today.
 *
 * Returns the highest nudge day that has passed and has not been sent, so a
 * job that misses a day (the cron runs once daily on Vercel's Hobby plan)
 * catches up with one message rather than three.
 *
 * A card on file is required, and that is not a technicality. The nudges say
 * what happens at day 7, including the setup fee, and a gym with no card
 * agreed to no fee and will never be charged one (see trialOutcome, which
 * releases it). Telling it otherwise would be a false statement about its own
 * bill. This was found the hard way: the first run of this job emailed
 * casdey's only real customer, a gym that signed up weeks before Trial With
 * Penalty existed, to tell it about a fee it had never agreed to.
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
  // Nothing to nudge about.
  if (unfinished.length === 0) return null;

  const day = trialDayNumber(gym.trial_ends_at, now);
  if (day == null) return null;

  const sent = gym.trial_last_nudge_day ?? 0;
  const due = NUDGE_DAYS.filter((d) => d <= day && d > sent);
  return due.length > 0 ? Math.max(...due) : null;
}

/**
 * Which day of the trial it is, 1-based, or null once the trial is over.
 *
 * Derived from trial_ends_at because that is the column that exists; the
 * start is trial_ends_at minus TRIAL_DAYS.
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
 * Whether a charged fee should be refunded because the gym went and did the
 * thing. MM pg 128, "make up for goofs".
 *
 * Needs the stamp, not the evidence: this asks when the step was completed,
 * and evidence cannot answer that. A gym whose stamp is missing keeps its fee
 * charged, which is the one place the defensive reading does not apply, and
 * the waiver exists for it.
 */
export function madeGood(
  chargedAt: string,
  doneAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!doneAt) return false;
  const charged = new Date(chargedAt).getTime();
  const done = new Date(doneAt).getTime();
  if (Number.isNaN(charged) || Number.isNaN(done)) return false;
  if (done < charged) return false;
  if (done > now.getTime()) return false;
  return done - charged <= MAKE_GOOD_DAYS * 86_400_000;
}
