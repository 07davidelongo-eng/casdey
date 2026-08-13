import "server-only";

import Stripe from "stripe";

import type { Currency } from "./countries";

/**
 * Stripe wiring.
 *
 * The offer, from the outreach material: a free first week, then £250/mo or
 * €290/mo, or £225/mo and €262/mo when billed annually. The card is taken at
 * signup and charged automatically when the week ends, so nobody has to
 * remember to come back and pay.
 *
 * None of these numbers appear in public marketing copy. The landing page and
 * the waitlist deliberately show the free week and no price. They are shown
 * here because this is where somebody is actually deciding to pay.
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

export const TRIAL_DAYS = 7;

export type PlanInterval = "month" | "year";

export type Plan = {
  currency: Currency;
  interval: PlanInterval;
  /** What the practice sees per month, which is the number they compare. */
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
