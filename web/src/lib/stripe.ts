import "server-only";

import Stripe from "stripe";

import type { Currency } from "./countries";
import type { PlanTier } from "./types";

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
 * None of these numbers appear in public marketing copy. They are shown in the
 * app, at the point somebody is actually deciding to pay.
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

export type PlanInterval = "month" | "year";

export type PricePlan = {
  tier: PlanTier;
  currency: Currency;
  interval: PlanInterval;
  /** Effective per-month figure, which is the number a gym compares. */
  monthlyDisplay: string;
  /** What actually leaves the account, and how often. */
  chargeDisplay: string;
  /** STRIPE_PRICE_<TIER>_<CURRENCY>_<INTERVAL> — the id lives in the env, not
   *  here, because test-mode and live-mode ids differ. */
  envVar: string;
};

export const PRICE_PLANS: PricePlan[] = [
  // Standard
  {
    tier: "standard",
    currency: "eur",
    interval: "month",
    monthlyDisplay: "€99",
    chargeDisplay: "€99 a month",
    envVar: "STRIPE_PRICE_STANDARD_EUR_MONTH",
  },
  {
    tier: "standard",
    currency: "eur",
    interval: "year",
    monthlyDisplay: "€83",
    chargeDisplay: "€990 a year",
    envVar: "STRIPE_PRICE_STANDARD_EUR_YEAR",
  },
  {
    tier: "standard",
    currency: "gbp",
    interval: "month",
    monthlyDisplay: "£89",
    chargeDisplay: "£89 a month",
    envVar: "STRIPE_PRICE_STANDARD_GBP_MONTH",
  },
  {
    tier: "standard",
    currency: "gbp",
    interval: "year",
    monthlyDisplay: "£74",
    chargeDisplay: "£890 a year",
    envVar: "STRIPE_PRICE_STANDARD_GBP_YEAR",
  },
  // Pro
  {
    tier: "pro",
    currency: "eur",
    interval: "month",
    monthlyDisplay: "€289",
    chargeDisplay: "€289 a month",
    envVar: "STRIPE_PRICE_PRO_EUR_MONTH",
  },
  {
    tier: "pro",
    currency: "eur",
    interval: "year",
    monthlyDisplay: "€241",
    chargeDisplay: "€2,890 a year",
    envVar: "STRIPE_PRICE_PRO_EUR_YEAR",
  },
  {
    tier: "pro",
    currency: "gbp",
    interval: "month",
    monthlyDisplay: "£249",
    chargeDisplay: "£249 a month",
    envVar: "STRIPE_PRICE_PRO_GBP_MONTH",
  },
  {
    tier: "pro",
    currency: "gbp",
    interval: "year",
    monthlyDisplay: "£207",
    chargeDisplay: "£2,490 a year",
    envVar: "STRIPE_PRICE_PRO_GBP_YEAR",
  },
];

/** The month + year options for one tier in one currency. */
export function pricePlansFor(tier: PlanTier, currency: Currency): PricePlan[] {
  return PRICE_PLANS.filter((p) => p.tier === tier && p.currency === currency);
}

export function findPricePlan(
  tier: PlanTier,
  currency: Currency,
  interval: PlanInterval,
): PricePlan | undefined {
  return PRICE_PLANS.find(
    (p) => p.tier === tier && p.currency === currency && p.interval === interval,
  );
}

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
