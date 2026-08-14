import type { Practice, SubscriptionStatus } from "./types";

/**
 * The offer model: trial → free → premium.
 *
 * Dictated by Davide, Aug 2026 (see CLAUDE.md "Offer evolution"). The shape:
 *
 *   - A new practice in the V1/waitlist window gets ONE WEEK of Premium, free,
 *     no card. It is meant to show the whole product working.
 *   - When that week ends the account drops to a FREE plan that is deliberately
 *     crippled: it can still find dormant patients and see the money sitting on
 *     the table, but it cannot send. The gap is the pitch.
 *   - Upgrading to Premium is a real Stripe subscription. Practices who joined
 *     in the V1/waitlist window keep a lifetime discount whenever they upgrade.
 *   - In V2 the free week goes away for new signups; it is just Free vs Premium.
 *
 * The offer is expected to keep changing, so the two levers that move with the
 * business, whether new signups get a trial and whether the early-adopter
 * discount is still being handed out, are environment flags, not code edits.
 *
 * The plan is DERIVED from the practice row, never stored as its own field, for
 * the same reason dormancy is derived: a stored plan goes stale the moment a
 * trial silently expires or a subscription lapses. There is exactly one place
 * that decides what plan a practice is on, and it is `effectivePlan`.
 */

export type Plan = "trial" | "free" | "premium";

export const TRIAL_DAYS = 7;

/** V1: new signups get the free week. Flip to "false" in Vercel for V2. */
export function trialEnabledForNewSignups(): boolean {
  return (process.env.CASDEY_TRIAL_ENABLED ?? "true") !== "false";
}

/**
 * V1/waitlist window: signups are flagged as early adopters and keep a lifetime
 * discount whenever they upgrade. Flip to "false" in Vercel once V2 starts;
 * practices already flagged keep their discount, new ones do not get one.
 */
export function earlyAdopterProgramActive(): boolean {
  return (process.env.CASDEY_EARLY_ADOPTER_DISCOUNT ?? "true") !== "false";
}

type PlanInput = Pick<
  Practice,
  "subscription_status" | "trial_ends_at"
>;

export function effectivePlan(practice: PlanInput, now: Date = new Date()): Plan {
  // A live (or lapsed-but-in-grace) Stripe subscription is Premium.
  if (
    practice.subscription_status === "active" ||
    practice.subscription_status === "past_due"
  ) {
    return "premium";
  }
  // No subscription, but the free week has not run out yet.
  if (
    practice.trial_ends_at &&
    new Date(practice.trial_ends_at).getTime() > now.getTime()
  ) {
    return "trial";
  }
  // The default resting state: after the trial, or for anyone with no trial.
  return "free";
}

export type Capabilities = {
  plan: Plan;
  /** Free can bring its list in and see who is dormant. That is the teaser. */
  canImport: boolean;
  /** The gated action. Only paying (or trialing) practices actually send. */
  canSendCampaigns: boolean;
};

export function capabilities(
  practice: PlanInput & { subscription_status: SubscriptionStatus },
  now: Date = new Date(),
): Capabilities {
  const plan = effectivePlan(practice, now);
  const premiumAndPaidUp =
    plan === "premium" && practice.subscription_status === "active";

  return {
    plan,
    // Importing and seeing dormant patients is open to Free on purpose: it is
    // what makes the Premium upgrade obvious. Exporting the list is not gated
    // either, but for a different reason: it is the practice's own data and a
    // GDPR portability right, so it is never behind the paywall.
    canImport: true,
    // Free cannot send, full stop. Trial can (it is Premium for a week). A
    // past_due Premium cannot send until the card is fixed.
    canSendCampaigns: plan === "trial" || premiumAndPaidUp,
  };
}

/** Whole days left in the free week, or null once it is over / never started. */
export function trialDaysLeft(
  practice: Pick<Practice, "trial_ends_at">,
  now: Date = new Date(),
): number | null {
  if (!practice.trial_ends_at) return null;
  const ms = new Date(practice.trial_ends_at).getTime() - now.getTime();
  if (ms <= 0) return null;
  return Math.ceil(ms / 86_400_000);
}

export function planLabel(plan: Plan): string {
  if (plan === "trial") return "Free week";
  if (plan === "premium") return "Premium";
  return "Free";
}
