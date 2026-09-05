import type { GuaranteeClaim, PlanTier } from "./types";

/**
 * The profit-or-nothing guarantee, as a rule rather than a promise on a page.
 *
 * "If casdey does not recover more than it costs, you do not pay" (see the
 * billing page) needs three things before it means anything:
 *
 *   1. The gym must be actually paying (see gyms.premium_started_at
 *      in migration 0007 — the free week is casdey's to give and is never the
 *      guarantee's clock).
 *   2. Real work must have started: a campaign, approved and sent. Paying
 *      alone is not enough, that would let someone claim a refund having
 *      never actually used the product.
 *   3. 30 days of that work must have passed, so there was time for a member
 *      to actually return.
 *
 * The window is the FIRST campaign a gym starts on or after its first
 * real payment. That is deliberate, not an oversight: under this rule a
 * gym gets exactly one guarantee window, ever, which is what makes a
 * fully self-service, no-review refund safe to offer (see
 * src/app/api/guarantee/claim/route.ts) — there is no way to keep re-arming
 * it by starting more campaigns later.
 *
 * Like `effectivePlan` in ./plan.ts, the window is derived, never stored.
 * What IS stored is the claim itself once one is made, because a refund
 * having happened is a fact, not something to recompute.
 */

export const GUARANTEE_WINDOW_DAYS = 30;

/**
 * Whether a settled payment should start the gym's one lifetime guarantee
 * clock.
 *
 * Two conditions, and the second is the one that was missing. It must be the
 * first time, so that cancelling and resubscribing cannot re-arm the window,
 * AND it must be a payment on a tier that actually carries the guarantee.
 *
 * Stamping it on a Standard payment spent the window on a plan with no
 * guarantee at all: the clock opens at the first campaign on or after that
 * date, running campaigns is exactly what Standard is for, and 30 days later
 * it is gone. A gym upgrading to Pro afterwards would find the guarantee it
 * had just paid for already expired, with nothing on screen explaining why.
 */
export function armsGuaranteeClock(
  premiumStartedAt: string | null,
  paidTier: PlanTier | null,
): boolean {
  if (premiumStartedAt) return false;
  return paidTier === "pro";
}


export type GuaranteeWindow = { start: Date; end: Date };

/**
 * The payments that actually fund the guarantee window.
 *
 * The window opens when the first campaign starts. The billing period covering
 * that moment is the latest payment on or before window.start; that payment,
 * plus anything paid during the window, is what the guarantee is measured
 * against and what a refund hands back. Earlier payments a gym ran up by
 * taking weeks to launch its first campaign fund a period largely before the
 * window, so counting or refunding them would over-pay the gym against
 * revenue that is only ever measured from window.start onward.
 */
export function paymentsFundingWindow<T extends { paid_at: string }>(
  payments: T[],
  windowStart: Date,
): T[] {
  const startMs = windowStart.getTime();
  const priorMs = payments
    .map((p) => new Date(p.paid_at).getTime())
    .filter((t) => t <= startMs);
  // Anchor on the billing period that covers the window's start. If somehow no
  // payment lands on or before it, keep them all rather than exclude everything.
  const anchorMs = priorMs.length ? Math.max(...priorMs) : -Infinity;
  return payments.filter((p) => new Date(p.paid_at).getTime() >= anchorMs);
}

/**
 * The one lifetime guarantee window, or null if it has not started yet.
 *
 * `firstPaidCampaignStartedAt` must already be filtered to campaigns started
 * on or after `premiumStartedAt` — see loadGuaranteeStatus in
 * ./guarantee-data.ts, which is the only real caller. This function does not
 * re-check that ordering itself; it trusts its input, the same way
 * `estimatedRecoveredMinor` trusts the returned count it is handed.
 */
export function guaranteeWindow(
  premiumStartedAt: string | null,
  firstPaidCampaignStartedAt: string | null,
): GuaranteeWindow | null {
  if (!premiumStartedAt || !firstPaidCampaignStartedAt) return null;
  const start = new Date(firstPaidCampaignStartedAt);
  const end = new Date(start.getTime() + GUARANTEE_WINDOW_DAYS * 86_400_000);
  return { start, end };
}

export type GuaranteeStatus =
  // Nothing to show yet: not paying, or paying but no campaign started since.
  | { state: "not_started"; reason: "not_premium" | "no_campaign" }
  // The 30 days are still running. revenue/paid are the figures so far, not
  // final: the gym sees how it is tracking, not a verdict.
  | {
      state: "running";
      window: GuaranteeWindow;
      daysLeft: number;
      revenueRecoveredMinor: number;
      paidMinor: number;
    }
  // The window closed and casdey earned its keep. Nothing to claim.
  | {
      state: "met";
      window: GuaranteeWindow;
      revenueRecoveredMinor: number;
      paidMinor: number;
    }
  // The window closed, the threshold was not met, and no claim exists yet.
  | {
      state: "claimable";
      window: GuaranteeWindow;
      revenueRecoveredMinor: number;
      paidMinor: number;
    }
  // The window closed short, but the gym never set a typical booking
  // value, so there is no honest revenue figure to judge the refund against.
  // A one-click, no-review refund would let any gym claw back a full
  // window simply by leaving that setting blank, so this routes to us instead.
  | {
      state: "needs_review";
      window: GuaranteeWindow;
      revenueRecoveredMinor: number;
      paidMinor: number;
    }
  // A claim already exists for this gym's one lifetime window.
  | { state: "claimed"; claim: GuaranteeClaim };

/**
 * The status shown on the billing page and re-checked, authoritatively, by
 * the claim endpoint before it ever calls Stripe.
 *
 * `revenueRecoveredMinor` and `paidMinor` must already be scoped to the
 * window: returns and payments from window.start up to whichever is
 * earlier of `now` and window.end (see ./guarantee-data.ts), so a still-running
 * window shows honest progress-so-far rather than a number padded with time
 * that has not happened yet.
 */
export function guaranteeStatus(params: {
  premiumStartedAt: string | null;
  firstPaidCampaignStartedAt: string | null;
  revenueRecoveredMinor: number;
  paidMinor: number;
  existingClaim: GuaranteeClaim | null;
  /**
   * Whether the revenue figure can be trusted, i.e. the gym has set a
   * positive typical booking value. Defaults to true for callers (and
   * tests) that only exercise the priced path. When false, a shortfall becomes
   * `needs_review` rather than an auto-refundable `claimable`.
   */
  revenueEstimable?: boolean;
  now?: Date;
}): GuaranteeStatus {
  if (params.existingClaim) {
    return { state: "claimed", claim: params.existingClaim };
  }

  const window = guaranteeWindow(
    params.premiumStartedAt,
    params.firstPaidCampaignStartedAt,
  );
  if (!window) {
    return {
      state: "not_started",
      reason: params.premiumStartedAt ? "no_campaign" : "not_premium",
    };
  }

  const now = params.now ?? new Date();
  const { revenueRecoveredMinor, paidMinor } = params;

  if (now.getTime() < window.end.getTime()) {
    const daysLeft = Math.ceil(
      (window.end.getTime() - now.getTime()) / 86_400_000,
    );
    return {
      state: "running",
      window,
      daysLeft,
      revenueRecoveredMinor,
      paidMinor,
    };
  }

  // Met if the estimate covers what was paid. Also "met" (nothing to refund)
  // if somehow nothing was collected in the window at all — "claimable" only
  // ever means there is a real payment behind it to hand back.
  const met = paidMinor <= 0 || revenueRecoveredMinor >= paidMinor;
  if (met) {
    return { state: "met", window, revenueRecoveredMinor, paidMinor };
  }

  // A genuine shortfall — but only auto-refundable when the revenue figure is
  // trustworthy. Without a set booking value the "recovered" number is a
  // hard zero for any gym, which would make the shortfall automatic and
  // the guarantee free money; send those to review instead.
  if (params.revenueEstimable === false) {
    return { state: "needs_review", window, revenueRecoveredMinor, paidMinor };
  }

  return { state: "claimable", window, revenueRecoveredMinor, paidMinor };
}
