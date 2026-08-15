import type { GuaranteeClaim } from "./types";

/**
 * The profit-or-nothing guarantee, as a rule rather than a promise on a page.
 *
 * "If casdey does not recover more than it costs, you do not pay" (see the
 * billing page) needs three things before it means anything:
 *
 *   1. The practice must be actually paying (see practices.premium_started_at
 *      in migration 0007 — the free week is casdey's to give and is never the
 *      guarantee's clock).
 *   2. Real work must have started: a campaign, approved and sent. Paying
 *      alone is not enough, that would let someone claim a refund having
 *      never actually used the product.
 *   3. 30 days of that work must have passed, so there was time for a patient
 *      to actually rebook.
 *
 * The window is the FIRST campaign a practice starts on or after its first
 * real payment. That is deliberate, not an oversight: under this rule a
 * practice gets exactly one guarantee window, ever, which is what makes a
 * fully self-service, no-review refund safe to offer (see
 * src/app/api/guarantee/claim/route.ts) — there is no way to keep re-arming
 * it by starting more campaigns later.
 *
 * Like `effectivePlan` in ./plan.ts, the window is derived, never stored.
 * What IS stored is the claim itself once one is made, because a refund
 * having happened is a fact, not something to recompute.
 */

export const GUARANTEE_WINDOW_DAYS = 30;

export type GuaranteeWindow = { start: Date; end: Date };

/**
 * The one lifetime guarantee window, or null if it has not started yet.
 *
 * `firstPaidCampaignStartedAt` must already be filtered to campaigns started
 * on or after `premiumStartedAt` — see loadGuaranteeStatus in
 * ./guarantee-data.ts, which is the only real caller. This function does not
 * re-check that ordering itself; it trusts its input, the same way
 * `estimatedRecoveredMinor` trusts the rebooked count it is handed.
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
  // final: the practice sees how it is tracking, not a verdict.
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
  // A claim already exists for this practice's one lifetime window.
  | { state: "claimed"; claim: GuaranteeClaim };

/**
 * The status shown on the billing page and re-checked, authoritatively, by
 * the claim endpoint before it ever calls Stripe.
 *
 * `revenueRecoveredMinor` and `paidMinor` must already be scoped to the
 * window: rebookings and payments from window.start up to whichever is
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

  return met
    ? { state: "met", window, revenueRecoveredMinor, paidMinor }
    : { state: "claimable", window, revenueRecoveredMinor, paidMinor };
}
