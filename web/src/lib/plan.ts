import type { Gym, PlanTier, SubscriptionStatus } from "./types";

/**
 * The offer model: trial → free → a paid tier (Standard or Pro).
 *
 * Dictated by Davide (see CLAUDE.md "Offer evolution"; 3-tier move Sept 2026):
 *
 *   - A new gym in the V1/waitlist window gets ONE WEEK of the top tier, free,
 *     no card. It is meant to show the whole product working.
 *   - When that week ends the account drops to a FREE plan that is deliberately
 *     crippled: it can still find lapsed members and see the money sitting on
 *     the table, but it cannot send. The gap is the pitch.
 *   - Upgrading is a real Stripe subscription to Standard or Pro. Gyms who
 *     joined in the V1/waitlist window keep a lifetime 20% discount on either
 *     paid tier.
 *   - In V2 the free week goes away for new signups.
 *
 * The two levers that move with the business, whether new signups get a trial
 * and whether the early-adopter discount is still handed out, are environment
 * flags, not code edits.
 *
 * The access STATE is DERIVED from the gym row, never stored, for the same
 * reason lapse is derived: a stored state goes stale the moment a trial
 * silently expires or a subscription lapses. `effectivePlan` is the one place
 * that decides it. The paid TIER (Standard vs Pro) is the one thing that must
 * be stored (`gyms.plan_tier`), because it comes from the Stripe subscription
 * price and cannot be recomputed from the gym row.
 */

/** trial: a time-boxed top tier. free: the resting state. standard / pro: the
 *  two paid tiers. */
export type Plan = "trial" | "free" | "standard" | "pro";

export const TRIAL_DAYS = 7;

/** True for a paid tier (not trial, not free). */
export function isPaidPlan(plan: Plan): plan is PlanTier {
  return plan === "standard" || plan === "pro";
}

/**
 * How many members a gym can see BY NAME in its list, per plan. It always sees
 * the true total and the dashboard counts, so the size of the opportunity is
 * never hidden, only the individual records past this point. null = no limit.
 */
export const MEMBER_LIST_LIMIT: Record<Plan, number | null> = {
  free: 5,
  standard: null,
  pro: null,
  trial: null,
};

/**
 * How many members a gym can hold in total, per plan. Enforced at import as a
 * cap on NET-NEW members: re-importing to update members already stored is
 * never blocked, only adding beyond the cap is. null = no limit.
 *
 * NOTE (Track F, F0): Standard's 500 is a PROPOSED default pending Davide's
 * tier sheet. Change the one number here when it lands.
 */
export const MEMBER_IMPORT_LIMIT: Record<Plan, number | null> = {
  free: 50,
  standard: 500,
  pro: null,
  trial: null,
};

// Back-compat names for the Free values, still referenced in copy and tests.
export const FREE_MEMBER_LIST_LIMIT = MEMBER_LIST_LIMIT.free as number;
export const FREE_MEMBER_IMPORT_LIMIT = MEMBER_IMPORT_LIMIT.free as number;

/** V1: new signups get the free week. Flip to "false" in Vercel for V2. */
export function trialEnabledForNewSignups(): boolean {
  return (process.env.CASDEY_TRIAL_ENABLED ?? "true") !== "false";
}

/**
 * V1/waitlist window: signups are flagged as early adopters and keep a lifetime
 * 20% discount whenever they upgrade. Flip to "false" in Vercel once V2 starts;
 * gyms already flagged keep their discount, new ones do not get one.
 */
export function earlyAdopterProgramActive(): boolean {
  return (process.env.CASDEY_EARLY_ADOPTER_DISCOUNT ?? "true") !== "false";
}

type PlanInput = Pick<
  Gym,
  "subscription_status" | "trial_ends_at" | "plan_tier"
>;

export function effectivePlan(gym: PlanInput, now: Date = new Date()): Plan {
  // A live (or lapsed-but-in-grace) Stripe subscription: whichever tier it is
  // paying for. plan_tier is written by the webhook; default to the safer
  // (fuller) tier if a subscription somehow exists without one recorded yet.
  if (
    gym.subscription_status === "active" ||
    gym.subscription_status === "past_due"
  ) {
    return gym.plan_tier ?? "pro";
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
   * The WhatsApp channel. PROPOSED (F0): Pro / trial only; Standard is
   * email-only. Consumed by the WhatsApp campaign-create path.
   */
  canUseWhatsApp: boolean;
  /**
   * The profit-or-nothing guarantee. PROPOSED (F0): Pro / trial only. Consumed
   * by the guarantee claim route + its billing-page entry.
   */
  hasGuarantee: boolean;
  /**
   * How many member records the gym may see by name, or null for no limit.
   * Display-only: the true total is still shown, and export is never capped
   * because it is the gym's own data and a GDPR portability right.
   */
  memberListLimit: number | null;
  /** The most members a gym may hold in total, or null for no limit. Enforced
   *  at import against net-new members only. */
  memberImportLimit: number | null;
};

/** Per-plan feature grants, before the past_due send down-gate is applied. */
const GRANTS: Record<
  Plan,
  Pick<Capabilities, "canSendCampaigns" | "canUseWhatsApp" | "hasGuarantee">
> = {
  free: { canSendCampaigns: false, canUseWhatsApp: false, hasGuarantee: false },
  standard: {
    canSendCampaigns: true,
    canUseWhatsApp: false,
    hasGuarantee: false,
  },
  pro: { canSendCampaigns: true, canUseWhatsApp: true, hasGuarantee: true },
  // The trial is a time-boxed Pro, so it grants everything Pro does.
  trial: { canSendCampaigns: true, canUseWhatsApp: true, hasGuarantee: true },
};

export function capabilities(
  gym: PlanInput & { subscription_status: SubscriptionStatus },
  now: Date = new Date(),
): Capabilities {
  const plan = effectivePlan(gym, now);
  const grants = GRANTS[plan];

  // A paid tier that is past_due (card needs fixing) keeps its feature grants
  // but cannot SEND until the payment clears. Trial and a clean active sub
  // send freely. Free never sends.
  const paidAndCurrent =
    isPaidPlan(plan) && gym.subscription_status === "active";
  const canSend =
    plan === "trial" ? true : grants.canSendCampaigns && paidAndCurrent;

  return {
    plan,
    // Importing and seeing lapsed members is open to everyone on purpose: it is
    // what makes upgrading obvious. Exporting is never gated either: it is the
    // gym's own data and a GDPR portability right.
    canImport: true,
    canSendCampaigns: canSend,
    canUseWhatsApp: grants.canUseWhatsApp,
    hasGuarantee: grants.hasGuarantee,
    memberListLimit: MEMBER_LIST_LIMIT[plan],
    memberImportLimit: MEMBER_IMPORT_LIMIT[plan],
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
  if (plan === "standard") return "Standard";
  if (plan === "pro") return "Pro";
  return "Free";
}
