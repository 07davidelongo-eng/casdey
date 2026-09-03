import type { Gym, SubscriptionStatus } from "./types";

/**
 * The offer model: trial → free → premium.
 *
 * Dictated by Davide, Aug 2026 (see CLAUDE.md "Offer evolution"). The shape:
 *
 *   - A new gym in the V1/waitlist window gets ONE WEEK of Premium, free,
 *     no card. It is meant to show the whole product working.
 *   - When that week ends the account drops to a FREE plan that is deliberately
 *     crippled: it can still find lapsed members and see the money sitting on
 *     the table, but it cannot send. The gap is the pitch.
 *   - Upgrading to Premium is a real Stripe subscription. Gyms who joined
 *     in the V1/waitlist window keep a lifetime discount whenever they upgrade.
 *   - In V2 the free week goes away for new signups; it is just Free vs Premium.
 *
 * The offer is expected to keep changing, so the two levers that move with the
 * business, whether new signups get a trial and whether the early-adopter
 * discount is still being handed out, are environment flags, not code edits.
 *
 * The plan is DERIVED from the gym row, never stored as its own field, for
 * the same reason lapse is derived: a stored plan goes stale the moment a
 * trial silently expires or a subscription lapses. There is exactly one place
 * that decides what plan a gym is on, and it is `effectivePlan`.
 */

export type Plan = "trial" | "free" | "premium";

export const TRIAL_DAYS = 7;

/**
 * How many members a Free gym can actually see by name in its list. It still
 * sees the true total (and the dashboard counts), so the size of the
 * opportunity is never hidden, only the individual records past this point are.
 * Trial and Premium see everyone. Dictated by Davide, Sept 2026: Free should be
 * "a lot" more limited than just the send gate.
 */
export const FREE_MEMBER_LIST_LIMIT = 5;

/**
 * How many members a Free gym can hold in total. A gym can try casdey on a
 * slice of its list, but bringing the whole list in (where the real
 * opportunity is) needs Premium. Enforced at import as a cap on NET-NEW
 * members: re-importing to update the members already stored is never blocked,
 * only adding beyond the cap is. Trial and Premium are uncapped. Dictated by
 * Davide, Sept 2026, alongside the list-view lock above.
 */
export const FREE_MEMBER_IMPORT_LIMIT = 50;

/** V1: new signups get the free week. Flip to "false" in Vercel for V2. */
export function trialEnabledForNewSignups(): boolean {
  return (process.env.CASDEY_TRIAL_ENABLED ?? "true") !== "false";
}

/**
 * V1/waitlist window: signups are flagged as early adopters and keep a lifetime
 * discount whenever they upgrade. Flip to "false" in Vercel once V2 starts;
 * gyms already flagged keep their discount, new ones do not get one.
 */
export function earlyAdopterProgramActive(): boolean {
  return (process.env.CASDEY_EARLY_ADOPTER_DISCOUNT ?? "true") !== "false";
}

type PlanInput = Pick<
  Gym,
  "subscription_status" | "trial_ends_at"
>;

export function effectivePlan(gym: PlanInput, now: Date = new Date()): Plan {
  // A live (or lapsed-but-in-grace) Stripe subscription is Premium.
  if (
    gym.subscription_status === "active" ||
    gym.subscription_status === "past_due"
  ) {
    return "premium";
  }
  // No subscription, but the free week has not run out yet.
  if (
    gym.trial_ends_at &&
    new Date(gym.trial_ends_at).getTime() > now.getTime()
  ) {
    return "trial";
  }
  // The default resting state: after the trial, or for anyone with no trial.
  return "free";
}

export type Capabilities = {
  plan: Plan;
  /** Free can bring its list in and see who is lapsed. That is the teaser. */
  canImport: boolean;
  /** The gated action. Only paying (or trialing) gyms actually send. */
  canSendCampaigns: boolean;
  /**
   * How many member records the gym may see by name, or null for no limit.
   * Free is capped (see FREE_MEMBER_LIST_LIMIT); Trial and Premium are not.
   * Display-only: the true total is still shown, and export is never capped
   * because it is the gym's own data and a GDPR portability right.
   */
  memberListLimit: number | null;
  /**
   * The most members a gym may hold in total, or null for no limit. Free is
   * capped (see FREE_MEMBER_IMPORT_LIMIT); Trial and Premium are not. Enforced
   * at import against net-new members only.
   */
  memberImportLimit: number | null;
};

export function capabilities(
  gym: PlanInput & { subscription_status: SubscriptionStatus },
  now: Date = new Date(),
): Capabilities {
  const plan = effectivePlan(gym, now);
  const premiumAndPaidUp =
    plan === "premium" && gym.subscription_status === "active";

  return {
    plan,
    // Importing and seeing lapsed members is open to Free on purpose: it is
    // what makes the Premium upgrade obvious. Exporting the list is not gated
    // either, but for a different reason: it is the gym's own data and a
    // GDPR portability right, so it is never behind the paywall.
    canImport: true,
    // Free cannot send, full stop. Trial can (it is Premium for a week). A
    // past_due Premium cannot send until the card is fixed.
    canSendCampaigns: plan === "trial" || premiumAndPaidUp,
    // Only Free is capped. A past_due Premium (plan still "premium") keeps the
    // full list: they had Premium and only need to fix a card, not re-earn it.
    memberListLimit: plan === "free" ? FREE_MEMBER_LIST_LIMIT : null,
    memberImportLimit: plan === "free" ? FREE_MEMBER_IMPORT_LIMIT : null,
  };
}

/** Whole days left in the free week, or null once it is over / never started. */
export function trialDaysLeft(
  gym: Pick<Gym, "trial_ends_at">,
  now: Date = new Date(),
): number | null {
  if (!gym.trial_ends_at) return null;
  const ms = new Date(gym.trial_ends_at).getTime() - now.getTime();
  if (ms <= 0) return null;
  return Math.ceil(ms / 86_400_000);
}

export function planLabel(plan: Plan): string {
  if (plan === "trial") return "Free week";
  if (plan === "premium") return "Premium";
  return "Free";
}
