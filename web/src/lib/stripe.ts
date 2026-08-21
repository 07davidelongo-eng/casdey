import "server-only";

import Stripe from "stripe";

import type { Currency } from "./countries";

/**
 * Stripe wiring: the paid Premium tier.
 *
 * Premium is £250/mo or €290/mo, or £225/mo and €262/mo billed annually. It is
 * a real subscription entered when a gym upgrades from the Free plan; the
 * free week that precedes Free is casdey's to give and never touches Stripe
 * (see src/lib/plan.ts). Gyms flagged early_adopter carry a lifetime
 * discount coupon on that subscription.
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

export type Plan = {
  currency: Currency;
  interval: PlanInterval;
  /** What the gym sees per month, which is the number they compare. */
  monthlyDisplay: string;
  /** What actually leaves the account, and how often. */
  chargeDisplay: string;
  envVar: string;
};

export const PLANS: Plan[] = [
  {
    currency: "gbp",
    interval: "month",
    monthlyDisplay: "£250",
    chargeDisplay: "£250 a month",
    envVar: "STRIPE_PRICE_GBP_MONTH",
  },
  {
    currency: "gbp",
    interval: "year",
    monthlyDisplay: "£225",
    chargeDisplay: "£2,700 a year",
    envVar: "STRIPE_PRICE_GBP_YEAR",
  },
  {
    currency: "eur",
    interval: "month",
    monthlyDisplay: "€290",
    chargeDisplay: "€290 a month",
    envVar: "STRIPE_PRICE_EUR_MONTH",
  },
  {
    currency: "eur",
    interval: "year",
    monthlyDisplay: "€262",
    chargeDisplay: "€3,144 a year",
    envVar: "STRIPE_PRICE_EUR_YEAR",
  },
];

export function plansFor(currency: Currency): Plan[] {
  return PLANS.filter((plan) => plan.currency === currency);
}

export function findPlan(
  currency: Currency,
  interval: PlanInterval,
): Plan | undefined {
  return PLANS.find(
    (plan) => plan.currency === currency && plan.interval === interval,
  );
}

/**
 * Price ids live in the environment, not in code: the test-mode and live-mode
 * ids differ, and hardcoding either one guarantees the wrong one ships.
 * Run `node scripts/stripe-setup.mjs` to create them and print the values.
 */
export function priceIdFor(plan: Plan): string {
  const id = process.env[plan.envVar];
  if (!id) {
    throw new Error(
      `Stripe price is not configured: set ${plan.envVar}. Run "node scripts/stripe-setup.mjs" to create the prices.`,
    );
  }
  return id;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * The lifetime early-adopter discount coupon for a currency, or undefined if
 * none is configured. Fixed-amount coupons are single-currency in Stripe, so
 * there is one per currency (£50 off, €59 off), created by scripts/stripe-setup.mjs.
 */
export function couponIdFor(currency: Currency): string | undefined {
  return currency === "gbp"
    ? process.env.STRIPE_COUPON_GBP || undefined
    : process.env.STRIPE_COUPON_EUR || undefined;
}
