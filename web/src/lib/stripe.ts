import "server-only";

import Stripe from "stripe";

import type { Currency } from "./countries";
import type { PlanTier } from "./types";
import { PRICE_PLANS, type PricePlan } from "./pricing";

/**
 * Stripe wiring for the two paid tiers (Track F).
 *
 * casdey's market is Europe, so prices lead in EUR; GBP keeps its own round
 * numbers for the UK, not a live conversion. See SAAS_V1_PLAN.md §F0.
 *
 *   Standard  €99/mo   (£89)    €990/yr    (£890)    — email win-back + at-risk
 *   Pro       €289/mo  (£249)   €2,890/yr  (£2,490)  — + WhatsApp + guarantee
 *
 * Annual is "two months free" — 10x the monthly rate, billed once.
 *
 * The free week that precedes a paid tier is casdey's to give and never
 * touches Stripe (see src/lib/plan.ts). A gym flagged early_adopter carries a
 * lifetime 20% discount coupon on its subscription, on either tier.
 *
 * These figures are public as of the V1 landing page: /pricing renders them
 * from the same catalogue this module charges against, so the two cannot
 * drift.
 */

let client: Stripe | null = null;

export function stripeClient(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe is not configured: set STRIPE_SECRET_KEY");
  }

  client = new Stripe(key, {
    // Pinned rather than left to the account default, so a dashboard-side
    // version bump cannot quietly change the shape of a webhook payload.
    apiVersion: "2026-07-29.dahlia",
    appInfo: { name: "casdey", url: "https://casdey.com" },
  });
  return client;
}

/**
 * The catalogue itself now lives in ./pricing, which carries no server-only
 * marker, because the public pricing page has to render the same figures the
 * checkout charges, and two copies of a price list is how a site ends up
 * advertising a number the card is never charged. Re-exported here so the
 * checkout and billing paths already importing from this module keep working
 * unchanged.
 */
export {
  PRICE_PLANS,
  pricePlansFor,
  findPricePlan,
  type PricePlan,
  type PlanInterval,
} from "./pricing";

/**
 * Price ids live in the environment, not in code: the test-mode and live-mode
 * ids differ, and hardcoding either one guarantees the wrong one ships.
 * Run `node scripts/stripe-setup.mjs` to create the test-mode ids and print
 * the values; live ids are created by hand in the dashboard.
 */
export function priceIdFor(plan: PricePlan): string {
  const id = process.env[plan.envVar];
  if (!id) {
    throw new Error(
      `Stripe price is not configured: set ${plan.envVar}. Run "node scripts/stripe-setup.mjs" to create the test-mode prices.`,
    );
  }
  return id;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * The lifetime early-adopter discount coupon. Track F moved this to a single
 * flat 20% percent-off coupon (`STRIPE_COUPON_PERCENT`), which is
 * currency-agnostic and applies to both paid tiers — replacing the old
 * per-currency fixed-amount coupons (£50 / €59). The `currency` argument is
 * kept for the legacy fallback only.
 */
export function couponIdFor(currency: Currency): string | undefined {
  return (
    process.env.STRIPE_COUPON_PERCENT ||
    (currency === "gbp"
      ? process.env.STRIPE_COUPON_GBP || undefined
      : process.env.STRIPE_COUPON_EUR || undefined)
  );
}

/**
 * Track F: which paid tier a Stripe price id belongs to, or null if it does
 * not match a configured tier price. The env vars are set by
 * `scripts/stripe-setup.mjs` (test) or by hand in the dashboard (live); until
 * then this returns null and effectivePlan() falls back to treating any active
 * subscription as Pro.
 */
export function planTierForPriceId(
  priceId: string | null | undefined,
): PlanTier | null {
  if (!priceId) return null;
  for (const plan of PRICE_PLANS) {
    if (process.env[plan.envVar] && process.env[plan.envVar] === priceId) {
      return plan.tier;
    }
  }
  return null;
}
